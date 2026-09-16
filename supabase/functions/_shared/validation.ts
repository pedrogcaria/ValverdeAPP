import { z } from 'npm:zod@3.24.2';
import type { BookingQuoteInput } from './pricing.ts';

export const MAX_PUBLIC_JSON_BYTES = 16_384;

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const civilDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine(isValidCivilDate, 'Indique uma data válida.');

const optionalPromoCode = z.string()
  .trim()
  .max(32, 'O código de desconto é demasiado longo.')
  .regex(/^[A-Za-z0-9_-]*$/, 'O código de desconto tem caracteres inválidos.')
  .optional()
  .transform((value) => value ? value.toUpperCase() : undefined);

const quoteFields = {
  checkIn: civilDate,
  checkOut: civilDate,
  guestsCount: z.number().int('Indique um número inteiro de hóspedes.').min(1).max(9),
  heatedPool: z.boolean().optional().default(false),
  promoCode: optionalPromoCode
};

function withDateRange<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.strict().superRefine((value, context) => {
    const checkIn = value.checkIn;
    const checkOut = value.checkOut;
    if (typeof checkIn === 'string' && typeof checkOut === 'string' && checkOut <= checkIn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: 'O check-out tem de ser posterior ao check-in.'
      });
    }
  });
}

const quoteSchema = withDateRange(z.object(quoteFields));

const bookingRequestSchema = withDateRange(z.object({
  ...quoteFields,
  fullName: z.string().trim().min(2, 'Indique o nome completo.').max(160, 'O nome é demasiado longo.'),
  email: z.string().trim().email('Indique um email válido.').max(254, 'O email é demasiado longo.').toLowerCase(),
  phone: z.string().trim().min(5, 'Indique um telefone válido.').max(48, 'O telefone é demasiado longo.')
    .regex(/^[0-9+().\s-]+$/, 'O telefone tem caracteres inválidos.'),
  message: z.string().trim().max(2_000, 'A mensagem é demasiado longa.').optional()
    .transform((value) => value || undefined),
  turnstileToken: z.string().trim().min(1, 'Conclua a verificação de segurança.').max(4_096)
}));

export type BookingRequestInput = BookingQuoteInput & {
  fullName: string;
  email: string;
  phone: string;
  message?: string;
  turnstileToken: string;
};

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Os dados enviados não são válidos.';
}

export function parseQuoteInput(payload: unknown): BookingQuoteInput {
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) throw new InputValidationError(firstIssue(parsed.error));
  return parsed.data;
}

export function parseBookingRequestInput(payload: unknown): BookingRequestInput {
  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) throw new InputValidationError(firstIssue(parsed.error));
  return parsed.data;
}

export async function readPublicJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new InputValidationError('O pedido tem de usar JSON.');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_JSON_BYTES) {
    throw new InputValidationError('O pedido é demasiado grande.');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PUBLIC_JSON_BYTES) {
    throw new InputValidationError('O pedido é demasiado grande.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new InputValidationError('O pedido JSON não é válido.');
  }
}
