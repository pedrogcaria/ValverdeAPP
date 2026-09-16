import { describe, expect, it } from 'vitest';
import { adminRedirectUrl, adminSurfaceUrl, isPublicAdminPath, resolveSurface } from './surface';

describe('resolução de superfícies por hostname', () => {
  it('separa os domínios públicos e de gestão', () => {
    expect(resolveSurface('villavalverde.pt')).toBe('public');
    expect(resolveSurface('qa.villavalverde.pt')).toBe('public');
    expect(resolveSurface('app.villavalverde.pt')).toBe('admin');
    expect(resolveSurface('qa.app.villavalverde.pt')).toBe('admin');
    expect(resolveSurface('untrusted.example')).toBe('unknown');
  });

  it('mantém as duas portas locais para desenvolvimento', () => {
    expect(resolveSurface('localhost', { devSurface: 'public' })).toBe('public');
    expect(resolveSurface('localhost', { devSurface: 'admin' })).toBe('admin');
  });
});

describe('redirecionamento /admin', () => {
  it('preserva query e hash para o subdomínio correto', () => {
    expect(isPublicAdminPath('/admin')).toBe(true);
    expect(isPublicAdminPath('/admin/users')).toBe(true);
    expect(isPublicAdminPath('/')).toBe(false);
    expect(adminRedirectUrl({ hostname: 'qa.villavalverde.pt', protocol: 'https:', port: '', pathname: '/admin', search: '?next=reservas', hash: '#token' })).toBe('https://qa.app.villavalverde.pt/?next=reservas#token');
    expect(adminSurfaceUrl({ hostname: 'qa.app.villavalverde.pt', protocol: 'https:' })).toBe('https://qa.app.villavalverde.pt/');
    expect(adminSurfaceUrl({ hostname: 'localhost', protocol: 'http:' })).toBe('http://localhost:4174/');
  });
});
