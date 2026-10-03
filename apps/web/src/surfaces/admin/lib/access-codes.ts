import type { AccessCode, Reservation } from './types';

const LISBON = 'Europe/Lisbon';

// O código que importa mostrar: o ativo, senão o que está a ser criado, senão a última falha.
export function currentAccessCode(reservation: Pick<Reservation, 'access_codes'>): AccessCode | null {
  const codes = reservation.access_codes ?? [];
  const latest = (status: AccessCode['status']) => codes
    .filter((code) => code.status === status)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  return latest('active') ?? latest('pending') ?? latest('failed') ?? null;
}

export function prefersPortuguese(guest: Reservation['guests']): boolean {
  const origin = `${guest?.nationality ?? ''} ${guest?.country ?? ''}`.toLowerCase();
  return /portug|brasil|brazil|\bpt\b|\bbr\b/.test(origin);
}

function dateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: LISBON, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export function accessCodeMessage(reservation: Pick<Reservation, 'guests'>, code: Pick<AccessCode, 'passcode' | 'valid_from' | 'valid_until'>): string {
  const firstName = reservation.guests?.full_name?.trim().split(/\s+/)[0];
  if (prefersPortuguese(reservation.guests)) {
    return [
      `Olá${firstName ? ` ${firstName}` : ''}! 🏡`,
      '',
      `O seu código de acesso à Villa Valverde é: *${code.passcode}*`,
      '',
      `Válido de ${dateTime(code.valid_from, 'pt-PT')} até ${dateTime(code.valid_until, 'pt-PT')}.`,
      'Introduza o código no teclado da porta e confirme com ✓.',
      '',
      'Boa estadia!'
    ].join('\n');
  }
  return [
    `Hello${firstName ? ` ${firstName}` : ''}! 🏡`,
    '',
    `Your access code for Villa Valverde is: *${code.passcode}*`,
    '',
    `Valid from ${dateTime(code.valid_from, 'en-GB')} until ${dateTime(code.valid_until, 'en-GB')} (Portugal time).`,
    'Enter the code on the door keypad and confirm with ✓.',
    '',
    'Enjoy your stay!'
  ].join('\n');
}
