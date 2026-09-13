import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getBookingQuote, submitBookingRequest } from '../lib/api';
import { currency, todayIso } from '../lib/format';
import type { BookingFormValues, BookingQuote, PublicBookingConfig } from '../lib/types';
import { Turnstile } from './Turnstile';

const emptyValues: BookingFormValues = {
  fullName: '', email: '', phone: '', guestsCount: '', checkIn: '', checkOut: '', heatedPool: false,
  promoCode: '', message: '', privacyAccepted: false
};

type Props = { config: PublicBookingConfig | null };

export function BookingForm({ config }: Props) {
  const [values, setValues] = useState<BookingFormValues>(emptyValues);
  const [quote, setQuote] = useState<BookingQuote>();
  const [quoteError, setQuoteError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

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
        setQuoteError(error instanceof Error ? error.message : 'Não foi possível calcular a proposta.');
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
    if (!quote) return setFormError('Escolhe datas válidas para calcular a proposta.');
    if (!values.privacyAccepted) return setFormError('É necessário aceitar a política de privacidade.');
    if (!turnstileToken) return setFormError('Conclui a verificação de segurança antes de enviar.');
    setSubmitting(true);
    setFormError(undefined);
    try {
      await submitBookingRequest(values, turnstileToken);
      setSuccess(true);
      setValues(emptyValues);
      setQuote(undefined);
      setTurnstileToken(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-panel">
      {success ? (
        <div className="booking-success" role="status">
          <span><Check size={30} /></span>
          <p className="eyebrow">Pedido recebido</p>
          <h3>Obrigado pela preferência.</h3>
          <p>Vamos confirmar a disponibilidade e enviar-lhe uma proposta final em menos de 24 horas.</p>
          <button className="button button--outline" onClick={() => setSuccess(false)}>Enviar outro pedido</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="booking-form-grid">
            <label><span>Nome completo *</span><input required value={values.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="Nome completo" /></label>
            <label><span>Email *</span><input required type="email" value={values.email} onChange={(event) => update('email', event.target.value)} placeholder="nome@email.com" /></label>
            <label><span>Telefone *</span><input required type="tel" value={values.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+351 9xx xxx xxx" /></label>
            <label><span>Número de hóspedes *</span><select required value={values.guestsCount} onChange={(event) => update('guestsCount', event.target.value)}><option value="">Selecionar</option>{Array.from({ length: 9 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
            <label><span>Check-in *</span><input required type="date" min={todayIso()} value={values.checkIn} onChange={(event) => update('checkIn', event.target.value)} /></label>
            <label><span>Check-out *</span><input required type="date" min={minimumCheckout} value={values.checkOut} onChange={(event) => update('checkOut', event.target.value)} /></label>
          </div>
          <label className="pool-option"><input type="checkbox" checked={values.heatedPool} onChange={(event) => update('heatedPool', event.target.checked)} /><span><strong>Piscina aquecida</strong><small>{config ? `${currency(config.settings.heatedPoolWeeklyPrice, config.settings.currency)} por semana` : 'Disponível como extra'}</small></span></label>
          <label className="coupon-field"><span>Código de desconto</span><input value={values.promoCode} onChange={(event) => update('promoCode', event.target.value.toUpperCase())} placeholder="Se tiver um código" /></label>
          <label className="message-field"><span>Mensagem</span><textarea value={values.message} onChange={(event) => update('message', event.target.value)} placeholder="Questões ou pedidos especiais" rows={4} /></label>

          {(quote || quoteError) && <div className="quote-summary" aria-live="polite">
            {quote ? <>
              <div><span>{quote.nights} noites</span><strong>{currency(quote.baseAmount, quote.currency)}</strong></div>
              {quote.heatedPoolAmount > 0 && <div><span>Piscina aquecida</span><strong>{currency(quote.heatedPoolAmount, quote.currency)}</strong></div>}
              {quote.promoAmount > 0 && <div className="quote-summary__saving"><span>Desconto {quote.promoDiscountPercent}%</span><strong>−{currency(quote.promoAmount, quote.currency)}</strong></div>}
              <div className="quote-summary__total"><span>Total estimado</span><strong>{currency(quote.totalAmount, quote.currency)}</strong></div>
            </> : <p className="field-help field-help--warning">{quoteError}</p>}
          </div>}

          <label className="privacy-check"><input required type="checkbox" checked={values.privacyAccepted} onChange={(event) => update('privacyAccepted', event.target.checked)} /><span>Li e aceito a <a href="#privacidade">política de privacidade</a>.</span></label>
          <Turnstile onTokenChange={setTurnstileToken} />
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="button button--primary booking-submit" disabled={submitting || !config}>
            {submitting ? <><LoaderCircle size={16} className="spin" /> A enviar...</> : <>Enviar pedido <ShieldCheck size={16} /></>}
          </button>
          <p className="form-footnote">O valor é estimado e a reserva só é confirmada após contacto do gestor.</p>
        </form>
      )}
    </div>
  );
}
