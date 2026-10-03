import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  createTimeLimitedKey,
  deleteKey,
  generatePasscode,
  listKeypadKeys,
  type SwitchBotCredentials,
  zonedTime
} from './switchbot.ts';

const LIVE_RESERVATION_STATUSES = ['confirmed', 'checked_in'];
// O keypad confirma em ~1 minuto; depois disto damos o pedido como perdido.
const PENDING_TIMEOUT_MS = 15 * 60_000;
// Depois de uma falha (ex.: hub offline) espera antes de tentar outra vez.
const RETRY_AFTER_FAILURE_MS = 60 * 60_000;

type Settings = {
  owner_id: string;
  property_name: string;
  timezone: string;
  access_code_valid_from: string;
  access_code_valid_until: string;
};

type Reservation = {
  id: string;
  status: string;
  check_in: string;
  check_out: string;
};

type Keypad = { id: string; label: string; switchbot_device_id: string };

export type SyncSummary = { issued: number; activated: number; failed: number; revoked: number; deleted: number; notified: number };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export function codeWindow(reservation: Pick<Reservation, 'check_in' | 'check_out'>, settings: Settings) {
  return {
    validFrom: zonedTime(reservation.check_in, settings.access_code_valid_from.slice(0, 5), settings.timezone),
    validUntil: zonedTime(reservation.check_out, settings.access_code_valid_until.slice(0, 5), settings.timezone)
  };
}

// O sufixo aleatório evita colidir com um código antigo da mesma reserva que o
// keypad ainda não acabou de apagar (a SwitchBot não aceita nomes repetidos).
export function keyName(reservation: Pick<Reservation, 'id' | 'check_in'>): string {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(2)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `VV ${reservation.check_in} ${reservation.id.slice(0, 8)}-${suffix}`;
}

async function loadSettings(client: SupabaseClient): Promise<Settings> {
  const { data, error } = await client
    .from('property_settings')
    .select('owner_id, property_name, timezone, access_code_valid_from, access_code_valid_until')
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error('A configuração da villa não está disponível.');
  return data as Settings;
}

async function loadKeypads(client: SupabaseClient, ownerId: string): Promise<Keypad[]> {
  const { data, error } = await client
    .from('access_keypads')
    .select('id, label, switchbot_device_id')
    .eq('owner_id', ownerId)
    .eq('active', true);
  if (error) throw new Error('Não foi possível ler os keypads.');
  return (data ?? []) as Keypad[];
}

async function updateCode(client: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await client.from('access_codes').update(values).eq('id', id);
  if (error) throw new Error('Não foi possível atualizar o código de acesso.');
}

// Cria códigos para todas as reservas confirmadas que ainda não terminaram.
async function issueCodes(client: SupabaseClient, credentials: SwitchBotCredentials, settings: Settings, keypads: Keypad[], summary: SyncSummary) {
  const now = new Date();
  const { data: reservations, error } = await client
    .from('reservations')
    .select('id, status, check_in, check_out')
    .eq('owner_id', settings.owner_id)
    .in('status', LIVE_RESERVATION_STATUSES)
    .not('check_in', 'is', null)
    .gte('check_out', isoDate(now));
  if (error) throw new Error('Não foi possível ler as reservas.');

  for (const reservation of (reservations ?? []) as Reservation[]) {
    const { validFrom, validUntil } = codeWindow(reservation, settings);
    if (validUntil <= now) continue;

    for (const keypad of keypads) {
      // Reaproveita o mesmo código em todas as portas da mesma reserva.
      const { data: existing } = await client
        .from('access_codes')
        .select('passcode, status, keypad_id, updated_at')
        .eq('reservation_id', reservation.id)
        .in('status', ['pending', 'active', 'deleting', 'failed']);
      const recentFailure = existing?.some((code) => code.keypad_id === keypad.id && code.status === 'failed'
        && now.getTime() - new Date(code.updated_at).getTime() < RETRY_AFTER_FAILURE_MS);
      if (recentFailure || existing?.some((code) => code.keypad_id === keypad.id && code.status !== 'failed')) continue;
      const passcode = existing?.find((code) => code.status === 'pending' || code.status === 'active')?.passcode ?? generatePasscode();

      const name = keyName(reservation);
      const { data: inserted, error: insertError } = await client
        .from('access_codes')
        .insert({
          owner_id: settings.owner_id,
          reservation_id: reservation.id,
          keypad_id: keypad.id,
          key_name: name,
          passcode,
          valid_from: validFrom.toISOString(),
          valid_until: validUntil.toISOString()
        })
        .select('id')
        .single();
      // Conflito no índice único: outra execução já está a tratar deste código.
      if (insertError || !inserted) continue;

      try {
        const commandId = await createTimeLimitedKey(credentials, keypad.switchbot_device_id, {
          name, passcode, validFrom, validUntil
        });
        await updateCode(client, inserted.id, { switchbot_command_id: commandId });
        summary.issued++;
      } catch (createError) {
        await updateCode(client, inserted.id, { status: 'failed', last_error: errorMessage(createError) });
        summary.failed++;
      }
    }
  }
}

// Pede a remoção de códigos de reservas canceladas, terminadas ou com datas alteradas.
async function revokeCodes(client: SupabaseClient, credentials: SwitchBotCredentials, settings: Settings, keypadsById: Map<string, Keypad>, summary: SyncSummary) {
  const { data: codes, error } = await client
    .from('access_codes')
    .select('id, reservation_id, keypad_id, valid_from, valid_until, switchbot_key_id, reservations(status, check_in, check_out)')
    .eq('owner_id', settings.owner_id)
    .eq('status', 'active');
  if (error) throw new Error('Não foi possível ler os códigos ativos.');

  const now = Date.now();
  for (const code of codes ?? []) {
    const reservation = (Array.isArray(code.reservations) ? code.reservations[0] : code.reservations) as Omit<Reservation, 'id'> | null;
    const expired = new Date(code.valid_until).getTime() < now;
    const cancelled = !reservation || !LIVE_RESERVATION_STATUSES.includes(reservation.status);
    let datesChanged = false;
    if (reservation && !cancelled) {
      const window = codeWindow(reservation, settings);
      datesChanged = window.validFrom.getTime() !== new Date(code.valid_from).getTime()
        || window.validUntil.getTime() !== new Date(code.valid_until).getTime();
    }
    if (!expired && !cancelled && !datesChanged) continue;

    const keypad = keypadsById.get(code.keypad_id);
    if (!keypad || !code.switchbot_key_id) {
      await updateCode(client, code.id, { status: 'deleted', last_error: 'Sem keypad ou id SwitchBot; removido só na app.' });
      summary.deleted++;
      continue;
    }
    try {
      const commandId = await deleteKey(credentials, keypad.switchbot_device_id, code.switchbot_key_id);
      await updateCode(client, code.id, { status: 'deleting', switchbot_command_id: commandId, last_error: null });
      summary.revoked++;
    } catch (deleteError) {
      await updateCode(client, code.id, { last_error: errorMessage(deleteError) });
    }
  }
}

// Confronta códigos pending/deleting com a lista real do keypad. É a fonte de verdade:
// o webhook só acelera este passo e nunca é confiado sozinho para ativar um código.
export async function reconcileCodes(client: SupabaseClient, credentials: SwitchBotCredentials, summary: SyncSummary) {
  const { data: codes, error } = await client
    .from('access_codes')
    .select('id, keypad_id, key_name, status, created_at, updated_at, access_keypads(switchbot_device_id)')
    .in('status', ['pending', 'deleting']);
  if (error) throw new Error('Não foi possível ler os códigos por confirmar.');
  if (!codes?.length) return;

  const keysByDevice = await listKeypadKeys(credentials);
  const now = Date.now();
  for (const code of codes) {
    const keypad = (Array.isArray(code.access_keypads) ? code.access_keypads[0] : code.access_keypads) as { switchbot_device_id: string } | null;
    const deviceKeys = keypad ? keysByDevice.get(keypad.switchbot_device_id) : undefined;
    const match = deviceKeys?.find((key) => key.name === code.key_name);

    if (code.status === 'pending') {
      if (match) {
        await updateCode(client, code.id, { status: 'active', switchbot_key_id: String(match.id), last_error: null });
        summary.activated++;
      } else if (now - new Date(code.created_at).getTime() > PENDING_TIMEOUT_MS) {
        await updateCode(client, code.id, { status: 'failed', last_error: 'O keypad não confirmou o código. Hub offline?' });
        summary.failed++;
      }
    } else if (deviceKeys && !match) {
      await updateCode(client, code.id, { status: 'deleted', last_error: null });
      summary.deleted++;
    } else if (now - new Date(code.updated_at).getTime() > PENDING_TIMEOUT_MS) {
      // Volta a active para que a próxima execução repita o deleteKey.
      await updateCode(client, code.id, { status: 'active', last_error: 'O keypad não confirmou a remoção.' });
    }
  }
}

async function notifyGuests(client: SupabaseClient, settings: Settings, summary: SyncSummary) {
  if (Deno.env.get('ACCESS_CODE_EMAIL_GUESTS') !== 'true') return;
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!apiKey || !from) return;

  const { data: codes, error } = await client
    .from('access_codes')
    .select('id, reservation_id, passcode, valid_from, valid_until, reservations(guests(full_name, email))')
    .eq('owner_id', settings.owner_id)
    .eq('status', 'active')
    .is('guest_notified_at', null);
  if (error) throw new Error('Não foi possível ler os códigos por enviar.');

  // Uma reserva com várias portas partilha o código; envia um único email.
  const sentReservations = new Set<string>();
  const format = new Intl.DateTimeFormat('pt-PT', { timeZone: settings.timezone, dateStyle: 'long', timeStyle: 'short' });
  for (const code of codes ?? []) {
    const reservation = (Array.isArray(code.reservations) ? code.reservations[0] : code.reservations) as { guests: unknown } | null;
    const guest = (Array.isArray(reservation?.guests) ? reservation?.guests[0] : reservation?.guests) as { full_name: string; email: string | null } | null;
    if (!guest?.email) continue;

    if (!sentReservations.has(code.reservation_id)) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [guest.email],
          bcc: Deno.env.get('BOOKING_NOTIFICATION_TO') ? [Deno.env.get('BOOKING_NOTIFICATION_TO')] : undefined,
          reply_to: Deno.env.get('BOOKING_REPLY_TO') || undefined,
          subject: `${settings.property_name} — código de acesso`,
          text: [
            `Olá ${guest.full_name},`,
            '',
            `O seu código de acesso à ${settings.property_name} é: ${code.passcode}`,
            `Válido de ${format.format(new Date(code.valid_from))} até ${format.format(new Date(code.valid_until))}.`,
            '',
            'Introduza o código no teclado da porta e confirme com ✓.'
          ].join(String.fromCharCode(10))
        })
      });
      if (!response.ok) continue;
      sentReservations.add(code.reservation_id);
    }
    await client.from('access_codes')
      .update({ guest_notified_at: new Date().toISOString() })
      .eq('reservation_id', code.reservation_id)
      .eq('status', 'active')
      .is('guest_notified_at', null);
    summary.notified++;
  }
}

export async function syncAccessCodes(client: SupabaseClient, credentials: SwitchBotCredentials): Promise<SyncSummary> {
  const summary: SyncSummary = { issued: 0, activated: 0, failed: 0, revoked: 0, deleted: 0, notified: 0 };
  const settings = await loadSettings(client);
  const keypads = await loadKeypads(client, settings.owner_id);
  const keypadsById = new Map(keypads.map((keypad) => [keypad.id, keypad]));

  // Ordem: remover o que já não serve antes de emitir, para que uma alteração de datas
  // liberte o slot; depois confirmar com a SwitchBot e só então avisar o hóspede.
  await revokeCodes(client, credentials, settings, keypadsById, summary);
  await reconcileCodes(client, credentials, summary);
  await issueCodes(client, credentials, settings, keypads, summary);
  await notifyGuests(client, settings, summary);
  return summary;
}
