import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  ready: (callback: () => void) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
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
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível.'));
    script.onerror = () => reject(new Error('Não foi possível carregar a proteção de segurança.'));
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
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState<string>();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      setMessage('A verificação de segurança será ativada antes da publicação.');
      return;
    }

    let disposed = false;
    loadTurnstile()
      .then((turnstile) => turnstile.ready(() => {
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
            setMessage('A verificação expirou. Confirma novamente antes de enviar.');
          },
          'error-callback': () => {
            onTokenChange(null);
            setMessage('Não foi possível concluir a verificação.');
          }
        });
      }))
      .catch((error: Error) => setMessage(error.message));

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
      {message && <p className="field-help field-help--warning">{message}</p>}
    </div>
  );
}
