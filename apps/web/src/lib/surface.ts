export type Surface = 'public' | 'admin' | 'unknown';

type LocationLike = Pick<Location, 'hostname' | 'protocol' | 'port' | 'pathname' | 'search' | 'hash'>;

const publicHosts = new Set(['villavalverde.pt', 'www.villavalverde.pt', 'qa.villavalverde.pt']);
const adminHosts = new Set(['app.villavalverde.pt', 'qa.app.villavalverde.pt']);

function aliases(value?: string): Set<string> {
  return new Set((value ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

export function resolveSurface(hostname: string, options: { devSurface?: string; publicAliases?: string; adminAliases?: string } = {}): Surface {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  const allowedPublic = new Set([...publicHosts, ...aliases(options.publicAliases)]);
  const allowedAdmin = new Set([...adminHosts, ...aliases(options.adminAliases)]);
  if (allowedPublic.has(host)) return 'public';
  if (allowedAdmin.has(host)) return 'admin';
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return options.devSurface === 'admin' ? 'admin' : 'public';
  }
  return 'unknown';
}

export function currentSurface(): Surface {
  return resolveSurface(window.location.hostname, {
    devSurface: import.meta.env.VITE_DEV_SURFACE,
    publicAliases: import.meta.env.VITE_PUBLIC_HOST_ALIASES,
    adminAliases: import.meta.env.VITE_ADMIN_HOST_ALIASES
  });
}

export function isPublicAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function adminSurfaceUrl(location: Pick<LocationLike, 'hostname' | 'protocol'>): string {
  const host = location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return 'http://localhost:4174/';
  }
  const target = host === 'qa.villavalverde.pt' || host === 'qa.app.villavalverde.pt'
    ? 'qa.app.villavalverde.pt'
    : 'app.villavalverde.pt';
  return `${location.protocol}//${target}/`;
}

export function adminRedirectUrl(location: LocationLike): string {
  return `${adminSurfaceUrl(location)}${location.search}${location.hash}`;
}
