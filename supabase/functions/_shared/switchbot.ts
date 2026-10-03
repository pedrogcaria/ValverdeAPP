// Cliente mínimo da SwitchBot API v1.1 para códigos de keypad.
// https://github.com/OpenWonderLabs/SwitchBotAPI/blob/main/devices/locks-security/keypad.md

const API_BASE = 'https://api.switch-bot.com/v1.1';

export class SwitchBotError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'SwitchBotError';
  }
}

export type SwitchBotCredentials = { token: string; secret: string };

export type KeypadKey = {
  id: number | string;
  name: string;
  type: string;
  status: string;
};

export function switchBotCredentials(): SwitchBotCredentials {
  const token = Deno.env.get('SWITCHBOT_TOKEN');
  const secret = Deno.env.get('SWITCHBOT_SECRET');
  if (!token || !secret) throw new SwitchBotError('As credenciais SwitchBot não estão configuradas.');
  return { token, secret };
}

export async function signHeaders(
  credentials: SwitchBotCredentials,
  timestamp = Date.now().toString(),
  nonce: string = crypto.randomUUID()
): Promise<Record<string, string>> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(credentials.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(credentials.token + timestamp + nonce)
  );
  return {
    Authorization: credentials.token,
    sign: btoa(String.fromCharCode(...new Uint8Array(signature))),
    t: timestamp,
    nonce,
    'Content-Type': 'application/json; charset=utf8'
  };
}

async function call<T>(credentials: SwitchBotCredentials, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method,
    headers: await signHeaders(credentials),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new SwitchBotError(`A SwitchBot respondeu HTTP ${response.status}.`, response.status);
  const payload = await response.json() as { statusCode?: number; message?: string; body?: T };
  if (payload.statusCode !== 100) {
    throw new SwitchBotError(`SwitchBot ${payload.statusCode ?? '?'}: ${payload.message ?? 'erro desconhecido'}`, payload.statusCode);
  }
  return payload.body as T;
}

// O resultado real chega mais tarde por webhook; aqui só recebemos o commandId.
export async function createTimeLimitedKey(
  credentials: SwitchBotCredentials,
  keypadDeviceId: string,
  key: { name: string; passcode: string; validFrom: Date; validUntil: Date }
): Promise<string | null> {
  const body = await call<{ commandId?: string }>(credentials, 'POST', `/devices/${encodeURIComponent(keypadDeviceId)}/commands`, {
    commandType: 'command',
    command: 'createKey',
    parameter: {
      name: key.name,
      type: 'timeLimit',
      password: key.passcode,
      startTime: Math.floor(key.validFrom.getTime() / 1000),
      endTime: Math.floor(key.validUntil.getTime() / 1000)
    }
  });
  return body?.commandId ?? null;
}

export async function deleteKey(credentials: SwitchBotCredentials, keypadDeviceId: string, keyId: string): Promise<string | null> {
  const body = await call<{ commandId?: string }>(credentials, 'POST', `/devices/${encodeURIComponent(keypadDeviceId)}/commands`, {
    commandType: 'command',
    command: 'deleteKey',
    parameter: { id: keyId }
  });
  return body?.commandId ?? null;
}

// Devolve os códigos de cada keypad indicado, por deviceId.
export async function listKeypadKeys(credentials: SwitchBotCredentials): Promise<Map<string, KeypadKey[]>> {
  const body = await call<{ deviceList?: { deviceId: string; keyList?: KeypadKey[] }[] }>(credentials, 'GET', '/devices');
  const keys = new Map<string, KeypadKey[]>();
  for (const device of body?.deviceList ?? []) {
    if (Array.isArray(device.keyList)) keys.set(device.deviceId, device.keyList);
  }
  return keys;
}

// Código de 8 dígitos sem padrões óbvios (todos iguais, sequências).
export function generatePasscode(length = 8): string {
  for (;;) {
    const digits = Array.from(crypto.getRandomValues(new Uint8Array(length * 2)))
      .filter((byte) => byte < 250)
      .slice(0, length)
      .map((byte) => byte % 10);
    if (digits.length < length) continue;
    const passcode = digits.join('');
    if (!isWeakPasscode(passcode)) return passcode;
  }
}

export function isWeakPasscode(passcode: string): boolean {
  if (/^(\d)\1+$/.test(passcode)) return true;
  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  return ascending.includes(passcode) || descending.includes(passcode);
}

// Converte uma data/hora local de um timezone IANA para um instante UTC.
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClock - timeZoneOffset(new Date(wallClock), timeZone);
  // Segunda passagem para acertar quando o palpite cai do outro lado de uma mudança de hora.
  instant = wallClock - timeZoneOffset(new Date(instant), timeZone);
  return new Date(instant);
}

function timeZoneOffset(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(instant).map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
