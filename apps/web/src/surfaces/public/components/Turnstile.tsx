import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/context';
import type { Messages } from '../i18n/messages';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileMessage = keyof Messages['turnstile'];

class TurnstileLoadError extends Error {
  constructor(readonly key: TurnstileMessage) {
    super(key);
  }
}

let loader: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  const pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new TurnstileLoadError('unavailable'));
    script.onerror = () => reject(new TurnstileLoadError('loadFailed'));
    document.head.appendChild(script);
  });
  loader = pending;
  void pending.catch(() => { if (loader === pending) loader = undefined; });
  return pending;
}

type Props = {
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
};

export function Turnstile({ onTokenChange, resetSignal = 0 }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  // Guarda-se a chave e não o texto, para a mensagem acompanhar a troca de língua.
  const [message, setMessage] = useState<TurnstileMessage>();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      setMessage('pending');
      return;
    }

    let disposed = false;
    loadTurnstile()
      .then((turnstile) => {
        if (disposed || !container.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          action: 'booking_request',
          callback: (token: string) => {
            setMessage(undefined);
            onTokenChange(token);
          },
          'expired-callback': () => {
            onTokenChange(null);
            setMessage('expired');
          },
          'error-callback': () => {
            onTokenChange(null);
            setMessage('failed');
          }
        });
      })
      .catch((error: unknown) => setMessage(error instanceof TurnstileLoadError ? error.key : 'loadFailed'));

    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    const id = widgetId.current;
    if (!siteKey || !id || !window.turnstile) return;
    window.turnstile.reset(id);
    onTokenChange(null);
    setMessage(undefined);
  }, [onTokenChange, resetSignal, siteKey]);

  return (
    <div className="turnstile-wrap">
      <div ref={container} />
      {message && <p className="field-help field-help--warning">{t.turnstile[message]}</p>}
    </div>
  );
}
