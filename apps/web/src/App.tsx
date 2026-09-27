import { lazy, Suspense, useEffect, useState } from 'react';
import { adminRedirectUrl, currentSurface, isPublicAdminPath, type Surface } from './lib/surface';
import { localeFromPath } from './surfaces/public/i18n/locale';

const AdminApp = lazy(() => import('./surfaces/admin/App'));
const PublicApp = lazy(() => import('./surfaces/public/App'));

export default function App() {
  const [surface, setSurface] = useState<Surface>(() => currentSurface());

  useEffect(() => {
    const onPopState = () => setSurface(currentSurface());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // O index.html declara inglês por ser a língua do site; a gestão é só em português.
  useEffect(() => {
    if (surface === 'admin') document.documentElement.lang = 'pt-PT';
  }, [surface]);

  useEffect(() => {
    if (surface === 'public' && isPublicAdminPath(window.location.pathname)) {
      window.location.replace(adminRedirectUrl(window.location));
    }
  }, [surface]);

  if (surface === 'unknown') {
    return <main className="surface-unknown"><h1>Domínio não reconhecido</h1><p>Use o domínio público ou o subdomínio privado da Villa Valverde.</p></main>;
  }

  if (surface === 'public' && isPublicAdminPath(window.location.pathname)) {
    return <main className="surface-unknown"><p>A abrir a área de gestão…</p></main>;
  }

  const loadingLabel = surface === 'public' && localeFromPath(window.location.pathname) === 'en' ? 'Loading…' : 'A carregar…';
  return <div className={`surface surface--${surface}`}><Suspense fallback={<main className="surface-unknown"><p>{loadingLabel}</p></main>}>{surface === 'admin' ? <AdminApp /> : <PublicApp />}</Suspense></div>;
}
