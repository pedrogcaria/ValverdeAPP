import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getBookingQuote, submitBookingRequest } from '../lib/api';
import { currency, todayIso } from '../lib/format';
import type { BookingFormValues, BookingQuote, PublicBookingConfig } from '../lib/types';
import { useI18n } from '../i18n/context';
import type { Messages } from '../i18n/messages';
import { translateServerError } from '../i18n/server-errors';
import { Turnstile } from './Turnstile';

const emptyValues: BookingFormValues = {
  fullName: '', email: '', phone: '', guestsCount: '', checkIn: '', checkOut: '', heatedPool: false,
  promoCode: '', message: '', privacyAccepted: false
};

// Os erros guardam a chave ou a mensagem original do servidor, e só se traduzem
// ao mostrar, para acompanharem a troca de língua.
type FormMessage = { key: keyof Messages['form']['errors'] } | { server: string };

function toFormMessage(error: unknown, fallback: keyof Messages['form']['errors']): FormMessage {
  return error instanceof Error ? { server: error.message } : { key: fallback };
}

type Props = { config: PublicBookingConfig | null };

export function BookingForm({ config }: Props) {
  const { t, intl, locale } = useI18n();
  const [values, setValues] = useState<BookingFormValues>(emptyValues);
  const [quote, setQuote] = useState<BookingQuote>();
  const [quoteError, setQuoteError] = useState<FormMessage>();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<FormMessage>();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const describe = (message: FormMessage) => 'key' in message ? t.form.errors[message.key] : translateServerError(message.server, locale);
  const money = (value: number, code?: string) => currency(value, code, intl);

  const canQuote = Boolean(config && values.checkIn && values.checkOut && values.guestsCount);
  const minimumCheckout = useMemo(() => {
    if (!values.checkIn || !config) return todayIso();
    const date = new Date(`${values.checkIn}T00:00:00`);
    date.setDate(date.getDate() + config.settings.minimumNights);
    return date.toISOString().slice(0, 10);
  }, [config, values.checkIn]);

  useEffect(() => {
    if (!canQuote) {
      setQuote(undefined);
      setQuoteError(undefined);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setQuoteError(undefined);
        setQuote(await getBookingQuote(values));
      } catch (error) {
        setQuote(undefined);
        setQuoteError(toFormMessage(error, 'quote'));
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [canQuote, values]);

  const update = useCallback(<Key extends keyof BookingFormValues>(key: Key, value: BookingFormValues[Key]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setSuccess(false);
    setFormError(undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return setFormError({ key: 'invalidDates' });
    if (!values.privacyAccepted) return setFormError({ key: 'privacy' });
    if (!turnstileToken) return setFormError({ key: 'turnstile' });
    setSubmitting(true);
    setFormError(undefined);
    try {
      await submitBookingRequest(values, turnstileToken);
      setSuccess(true);
      setValues(emptyValues);
      setQuote(undefined);
    } catch (error) {
      setFormError(toFormMessage(error, 'submit'));
    } finally {
      setSubmitting(false);
      setTurnstileToken(null);
      setTurnstileReset((value) => value + 1);
    }
  }

  return (
    <div className="booking-panel">
      {success ? (
        <div className="booking-success" role="status">
          <span><Check size={30} /></span>
          <p className="eyebrow">{t.form.successEyebrow}</p>
          <h3>{t.form.successTitle}</h3>
          <p>{t.form.successBody}</p>
          <button className="button button--outline" onClick={() => setSuccess(false)}>{t.form.sendAnother}</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="booking-form-grid">
            <label><span>{t.form.fullName}</span><input required autoComplete="name" value={values.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder={t.form.fullNamePlaceholder} /></label>
            <label><span>{t.form.email}</span><input required type="email" autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} placeholder={t.form.emailPlaceholder} /></label>
            <label><span>{t.form.phone}</span><input required type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update('phone', event.target.value)} placeholder={t.form.phonePlaceholder} /></label>
            <label><span>{t.form.guests}</span><select required value={values.guestsCount} onChange={(event) => update('guestsCount', event.target.value)}><option value="">{t.form.select}</option>{Array.from({ length: 9 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
            <label><span>{t.form.checkIn}</span><input required type="date" lang={intl} min={todayIso()} value={values.checkIn} onChange={(event) => update('checkIn', event.target.value)} /></label>
            <label><span>{t.form.checkOut}</span><input required type="date" lang={intl} min={minimumCheckout} value={values.checkOut} onChange={(event) => update('checkOut', event.target.value)} /></label>
          </div>
          <label className="pool-option"><input type="checkbox" checked={values.heatedPool} onChange={(event) => update('heatedPool', event.target.checked)} /><span><strong>{t.form.heatedPool}</strong><small>{config ? t.form.heatedPoolPrice(money(config.settings.heatedPoolWeeklyPrice, config.settings.currency)) : t.form.heatedPoolExtra}</small></span></label>
          <label className="coupon-field"><span>{t.form.promoCode}</span><input value={values.promoCode} onChange={(event) => update('promoCode', event.target.value.toUpperCase())} placeholder={t.form.promoPlaceholder} /></label>
          <label className="message-field"><span>{t.form.message}</span><textarea value={values.message} onChange={(event) => update('message', event.target.value)} placeholder={t.form.messagePlaceholder} rows={4} /></label>

          {(quote || quoteError) && <div className="quote-summary" aria-live="polite">
            {quote ? <>
              <div><span>{t.form.nights(quote.nights)}</span><strong>{money(quote.baseAmount, quote.currency)}</strong></div>
              {quote.heatedPoolAmount > 0 && <div><span>{t.form.heatedPool}</span><strong>{money(quote.heatedPoolAmount, quote.currency)}</strong></div>}
              {quote.promoAmount > 0 && <div className="quote-summary__saving"><span>{t.form.promoDiscount(quote.promoDiscountPercent)}</span><strong>−{money(quote.promoAmount, quote.currency)}</strong></div>}
              <div className="quote-summary__total"><span>{t.form.estimatedTotal}</span><strong>{money(quote.totalAmount, quote.currency)}</strong></div>
            </> : quoteError && <p className="field-help field-help--warning">{describe(quoteError)}</p>}
          </div>}

          <label className="privacy-check"><input required type="checkbox" checked={values.privacyAccepted} onChange={(event) => update('privacyAccepted', event.target.checked)} /><span>{t.form.privacyStart} <a href="#privacidade">{t.form.privacyLink}</a>.</span></label>
          <Turnstile onTokenChange={setTurnstileToken} resetSignal={turnstileReset} />
          {formError && <p className="form-error" role="alert">{describe(formError)}</p>}
          <button className="button button--primary booking-submit" disabled={submitting || !config}>
            {submitting ? <><LoaderCircle size={16} className="spin" /> {t.form.submitting}</> : <>{t.form.submit} <ShieldCheck size={16} /></>}
          </button>
          <p className="form-footnote">{t.form.footnote}</p>
        </form>
      )}
    </div>
  );
}
