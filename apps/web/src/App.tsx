import { lazy, Suspense, useEffect, useState } from 'react';
import { adminRedirectUrl, currentSurface, isPublicAdminPath, type Surface } from './lib/surface';

const AdminApp = lazy(() => import('./surfaces/admin/App'));
const PublicApp = lazy(() => import('./surfaces/public/App'));

export default function App() {
  const [surface, setSurface] = useState<Surface>(() => currentSurface());

  useEffect(() => {
    const onPopState = () => setSurface(currentSurface());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  return <div className={`surface surface--${surface}`}><Suspense fallback={<main className="surface-unknown"><p>A carregar…</p></main>}>{surface === 'admin' ? <AdminApp /> : <PublicApp />}</Suspense></div>;
}
