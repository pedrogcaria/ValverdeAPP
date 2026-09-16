import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  CalendarDays, Check, ChevronRight, CircleAlert, ClipboardList, Download, FileText, Home,
  Inbox, KeyRound, LogOut, Menu, MessageCircle, Pencil, Plus, RefreshCw, Settings,
  ShieldCheck, Sparkles, UsersRound, WalletCards, X
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Turnstile } from './components/Turnstile';
import { normalizeCleaningChecklist, serializeCleaningChecklist, type CleaningChecklistItem } from './lib/checklist';
import { date, dateRange, jsonList, money, nights, normalizePhone, shortDate, splitList, today } from './lib/format';
import { calculateMetrics, hasDateConflict, reservationNet } from './lib/metrics';
import { getSupabase, supabase } from './lib/supabase';
import { appError, EXPENSES_SELECT, fetchAllPages } from './lib/data-access';
import type { AdminData, BookingRequest, Expense, Guest, PromoCode, PropertySettings, Reservation, Screen, SeasonalRate } from './lib/types';
import './styles/index.css';

const emptyData: AdminData = { settings: null, guests: [], reservations: [], expenses: [], requests: [], rates: [], promoCodes: [] };

const screenItems: Array<{ id: Screen; label: string; icon: typeof Home }> = [
  { id: 'dashboard', label: 'Visão geral', icon: Home },
  { id: 'requests', label: 'Pedidos', icon: Inbox },
  { id: 'reservations', label: 'Reservas', icon: CalendarDays },
  { id: 'expenses', label: 'Gastos', icon: WalletCards },
  { id: 'guests', label: 'Hóspedes', icon: UsersRound },
  { id: 'reports', label: 'Relatórios', icon: FileText },
  { id: 'settings', label: 'Configuração', icon: Settings }
];

type ToastTone = 'success' | 'error';
type Toast = { tone: ToastTone; message: string } | null;
type ModalState =
  | { kind: 'reservation'; value?: Reservation }
  | { kind: 'expense'; value?: Expense }
  | { kind: 'guest'; value?: Guest }
  | { kind: 'rate'; value?: SeasonalRate }
  | { kind: 'promo'; value?: PromoCode }
  | null;

function sourceLabel(source: Reservation['source']): string {
  return { manual: 'Manual', site: 'Site', booking: 'Booking.com', airbnb: 'Airbnb', direct: 'Direto', other: 'Outro' }[source] ?? source;
}

function reservationStatus(status: Reservation['status']): string {
  return { pending: 'Pendente', confirmed: 'Confirmada', checked_in: 'Em estadia', checked_out: 'Concluída', cancelled: 'Cancelada' }[status];
}

function paymentStatus(status: Reservation['payment_status']): string {
  return { not_paid: 'Por pagar', partial: 'Parcial', paid: 'Pago' }[status];
}

function requestStatus(status: BookingRequest['status']): string {
  return { new: 'Novo', contacted: 'Contactado', accepted: 'Aceite', declined: 'Recusado', spam: 'Spam' }[status];
}

function isActiveReservation(reservation: Reservation): boolean {
  return ['pending', 'confirmed', 'checked_in'].includes(reservation.status);
}

function closeToToday(value: string | null, days = 30): boolean {
  if (!value) return false;
  const now = new Date(`${today()}T00:00:00Z`).getTime();
  const target = new Date(`${value}T00:00:00Z`).getTime();
  return target >= now && target <= now + days * 86_400_000;
}

function isInviteCallback() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return [window.location.search, hash].some((value) => new URLSearchParams(value).get('type') === 'invite');
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [passwordSetup, setPasswordSetup] = useState(false);

  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session && isInviteCallback()) setPasswordSetup(true);
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isInviteCallback())) setPasswordSetup(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabase) return <EnvironmentMissing />;
  if (booting) return <div className="app-loading"><Sparkles size={22} />A preparar a gestão da villa…</div>;
  if (passwordSetup && session) return <PasswordUpdate onDone={() => { setPasswordSetup(false); window.history.replaceState(null, '', window.location.pathname); }} />;
  if (!session) return <Login />;
  return <AdminShell session={session} />;
}

function EnvironmentMissing() {
  return <main className="auth-page"><section className="auth-card auth-card--wide"><p className="eyebrow">Configuração necessária</p><h1>Área de gestão da Villa Valverde</h1><p>Faltam as variáveis públicas do Supabase. Copie <code>.env.example</code> para <code>.env.local</code> e preencha apenas a URL e a chave publicável.</p><p className="form-help">Nunca coloque nesta app a service-role key, o segredo Turnstile ou a chave Resend.</p></section></main>;
}

function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const hasTurnstile = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined); setMessage(undefined);
    if (hasTurnstile && !captchaToken) { setError('Confirme a verificação de segurança antes de continuar.'); return; }
    setSending(true);
    try {
      if (mode === 'login') {
        const { error: authError } = await getSupabase().auth.signInWithPassword({
          email, password,
          options: captchaToken ? { captchaToken } : undefined
        });
        if (authError) throw authError;
      } else {
        const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
          captchaToken: captchaToken ?? undefined
        });
        if (resetError) throw resetError;
        setMessage('Se existir uma conta com este email, enviámos a ligação de recuperação.');
      }
    } catch (nextError) {
      setError(appError(nextError));
    } finally { setSending(false); setCaptchaToken(null); setTurnstileReset((value) => value + 1); }
  };

  const switchMode = (nextMode: 'login' | 'reset') => {
    setMode(nextMode); setCaptchaToken(null); setTurnstileReset((value) => value + 1); setError(undefined); setMessage(undefined);
  };

  return <main className="auth-page"><section className="auth-card"><p className="brand-mark">Villa <em>Valverde</em></p><p className="eyebrow">Gestão privada</p><h1>{mode === 'login' ? 'Bem-vindo de volta.' : 'Recuperar acesso'}</h1><p>{mode === 'login' ? 'Entre para gerir reservas, hóspedes e operação da villa.' : 'Receberá uma ligação segura para definir uma nova palavra-passe.'}</p><form onSubmit={submit} className="stack-form"><Field label="Email"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="gestao@…" /></Field>{mode === 'login' && <Field label="Palavra-passe"><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>}<Turnstile action={mode === 'login' ? 'login' : 'password_reset'} onTokenChange={setCaptchaToken} resetSignal={turnstileReset} />{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<button className="button button--dark" disabled={sending}>{sending ? 'A validar…' : mode === 'login' ? 'Entrar na gestão' : 'Enviar ligação segura'}</button></form><button className="text-button" onClick={() => switchMode(mode === 'login' ? 'reset' : 'login')}>{mode === 'login' ? 'Esqueci-me da palavra-passe' : 'Voltar ao início de sessão'}</button><p className="auth-foot"><ShieldCheck size={14} />Acesso limitado ao gestor autenticado.</p></section></main>;
}

function PasswordUpdate({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(undefined);
    if (password.length < 12) { setError('Escolha pelo menos 12 caracteres.'); return; }
    if (password !== confirm) { setError('As palavras-passe não coincidem.'); return; }
    setBusy(true);
    const { error: updateError } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    onDone();
  };
  return <main className="auth-page"><section className="auth-card"><p className="brand-mark">Villa <em>Valverde</em></p><p className="eyebrow">Recuperação segura</p><h1>Defina uma nova palavra-passe.</h1><form onSubmit={submit} className="stack-form"><Field label="Nova palavra-passe"><input required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Field label="Repetir palavra-passe"><input required type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>{error && <Notice tone="error">{error}</Notice>}<button className="button button--dark" disabled={busy}>{busy ? 'A guardar…' : 'Guardar palavra-passe'}</button></form></section></main>;
}

function AdminShell({ session }: { session: Session }) {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const ownerId = session.user.id;
  const currency = data.settings?.currency ?? 'EUR';

  const tell = useCallback((tone: ToastTone, message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 5_000);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const db = getSupabase();
      const [settingsResult, guests, reservations, expenses, requests, rates, promoCodes] = await Promise.all([
        db.from('property_settings').select('*').maybeSingle(),
        fetchAllPages<Guest>((from, to) => db.from('guests').select('*').order('full_name').range(from, to)),
        fetchAllPages<Reservation>((from, to) => db.from('reservations').select('*, guests(id, full_name, email, phone, nationality)').order('check_in', { ascending: true }).range(from, to)),
        fetchAllPages<Expense>((from, to) => db.from('expenses').select(EXPENSES_SELECT).order('occurred_on', { ascending: false }).range(from, to)),
        fetchAllPages<BookingRequest>((from, to) => db.from('booking_requests').select('*').order('created_at', { ascending: false }).range(from, to)),
        fetchAllPages<SeasonalRate>((from, to) => db.from('seasonal_rates').select('*').order('starts_on').range(from, to)),
        fetchAllPages<PromoCode>((from, to) => db.from('promo_codes').select('*').order('code').range(from, to))
      ]);
      if (settingsResult.error) throw settingsResult.error;
      setData({
        settings: (settingsResult.data ?? null) as PropertySettings | null,
        guests,
        reservations,
        expenses,
        requests,
        rates,
        promoCodes
      });
    } catch (nextError) { setError(appError(nextError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const updateRequestStatus = async (request: BookingRequest, status: BookingRequest['status']) => {
    const { error: updateError } = await getSupabase().from('booking_requests').update({ status }).eq('id', request.id);
    if (updateError) { tell('error', updateError.message); return; }
    tell('success', `Pedido marcado como ${requestStatus(status).toLowerCase()}.`); void reload();
  };

  const acceptRequest = async (request: BookingRequest) => {
    if (request.reservation_id) { tell('error', 'Este pedido já foi convertido numa reserva.'); return; }
    if (!window.confirm(`Criar uma reserva pendente para ${request.full_name}?`)) return;
    try {
      // A RPC bloqueia o pedido, volta a validar autorização/disponibilidade e
      // cria a reserva numa única transação. O estado local é apenas UX.
      const { error } = await getSupabase().rpc('accept_booking_request', { p_request_id: request.id });
      if (error) throw error;
      tell('success', 'Pedido convertido numa reserva pendente.'); void reload(); setScreen('reservations');
    } catch (nextError) { tell('error', appError(nextError)); }
  };

  const cancelReservation = async (reservation: Reservation) => {
    if (!window.confirm(`Cancelar a reserva de ${reservation.guests?.full_name ?? 'hóspede'}? A reserva e o seu histórico serão mantidos.`)) return;
    const { error: updateError } = await getSupabase().from('reservations').update({ status: 'cancelled' }).eq('id', reservation.id);
    if (updateError) { tell('error', updateError.message); return; }
    tell('success', 'Reserva cancelada.'); void reload();
  };

  const exportBackup = () => {
    const documentData = { exportedAt: new Date().toISOString(), version: 2, ...data };
    const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `villa-valverde-backup-${today()}.json`; anchor.click();
    URL.revokeObjectURL(url);
    tell('success', 'Backup exportado. Guarde-o num local seguro.');
  };

  const content = () => {
    if (loading) return <div className="page-state"><RefreshCw className="spin" />A carregar dados da villa…</div>;
    if (error) return <div className="page-state page-state--error"><CircleAlert />{error}<button className="button button--quiet" onClick={() => void reload()}>Tentar novamente</button></div>;
    switch (screen) {
      case 'dashboard': return <DashboardScreen data={data} currency={currency} onScreen={setScreen} />;
      case 'requests': return <RequestsScreen data={data} currency={currency} onAccept={acceptRequest} onStatus={updateRequestStatus} />;
      case 'reservations': return <ReservationsScreen data={data} currency={currency} onNew={() => setModal({ kind: 'reservation' })} onEdit={(value) => setModal({ kind: 'reservation', value })} onCancel={cancelReservation} />;
      case 'expenses': return <ExpensesScreen data={data} currency={currency} onNew={() => setModal({ kind: 'expense' })} onEdit={(value) => setModal({ kind: 'expense', value })} />;
      case 'guests': return <GuestsScreen data={data} onNew={() => setModal({ kind: 'guest' })} onEdit={(value) => setModal({ kind: 'guest', value })} />;
      case 'reports': return <ReportsScreen data={data} currency={currency} onExport={exportBackup} />;
      case 'settings': return <SettingsScreen data={data} ownerId={ownerId} currency={currency} onEditRate={(value) => setModal({ kind: 'rate', value })} onEditPromo={(value) => setModal({ kind: 'promo', value })} onNewRate={() => setModal({ kind: 'rate' })} onNewPromo={() => setModal({ kind: 'promo' })} onReload={reload} onNotice={tell} />;
    }
  };

  return <div className="admin-shell"><aside className="side-nav"><div className="side-nav__brand"><p className="brand-mark">Villa <em>Valverde</em></p><span>Gestão privada</span></div><Nav items={screenItems} active={screen} onChange={setScreen} /><div className="side-nav__bottom"><button className="nav-link" onClick={exportBackup}><Download size={17} />Backup</button><button className="nav-link nav-link--danger" onClick={() => void getSupabase().auth.signOut()}><LogOut size={17} />Sair</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><p className="eyebrow">{screenItems.find((item) => item.id === screen)?.label}</p><h1>{data.settings?.property_name ?? 'Villa Valverde'}</h1></div><div className="topbar-actions"><button className="icon-button" title="Atualizar dados" aria-label="Atualizar dados" onClick={() => void reload()}><RefreshCw size={18} /></button><button className="avatar" title={session.user.email ?? 'Gestor'}>{(session.user.email ?? 'G').slice(0, 1).toUpperCase()}</button></div></header>{!data.settings && !loading && <SetupNotice onSettings={() => setScreen('settings')} />}{content()}</main><nav className="mobile-nav"><Nav items={screenItems} active={screen} onChange={setScreen} compact /></nav>{toast && <div className={`toast toast--${toast.tone}`}>{toast.tone === 'success' ? <Check size={16} /> : <CircleAlert size={16} />}{toast.message}</div>}{modal?.kind === 'reservation' && <ReservationEditor data={data} ownerId={ownerId} value={modal.value} currency={currency} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); tell('success', 'Reserva guardada.'); }} onNotice={tell} />}{modal?.kind === 'expense' && <ExpenseEditor data={data} ownerId={ownerId} value={modal.value} currency={currency} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); tell('success', 'Gasto guardado.'); }} />}{modal?.kind === 'guest' && <GuestEditor ownerId={ownerId} value={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); tell('success', 'Hóspede guardado.'); }} />}{modal?.kind === 'rate' && <RateEditor ownerId={ownerId} value={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); tell('success', 'Preço sazonal guardado.'); }} />}{modal?.kind === 'promo' && <PromoEditor ownerId={ownerId} value={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); tell('success', 'Cupão guardado.'); }} />}</div>;
}

function Nav({ items, active, onChange, compact = false }: { items: typeof screenItems; active: Screen; onChange: (screen: Screen) => void; compact?: boolean }) {
  return <div className={compact ? 'mobile-nav__scroll' : 'nav-list'}>{items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${active === id ? 'is-active' : ''}`} onClick={() => onChange(id)}><Icon size={compact ? 18 : 17} /><span>{compact ? label.replace('Visão geral', 'Início').replace('Configuração', 'Mais') : label}</span></button>)}</div>;
}

function SetupNotice({ onSettings }: { onSettings: () => void }) {
  return <div className="setup-notice"><ShieldCheck size={18} /><div><strong>A villa ainda não foi inicializada.</strong><span>Importe o backup legado ou guarde primeiro a configuração base e os preços sazonais.</span></div><button className="button button--quiet" onClick={onSettings}>Abrir configuração <ChevronRight size={16} /></button></div>;
}

function DashboardScreen({ data, currency, onScreen }: { data: AdminData; currency: string; onScreen: (screen: Screen) => void }) {
  const metrics = calculateMetrics(data.reservations, data.expenses);
  const upcoming = data.reservations.filter((reservation) => isActiveReservation(reservation) && closeToToday(reservation.check_in, 45)).slice(0, 5);
  const requests = data.requests.filter((request) => request.status === 'new');
  return <section className="page-content"><div className="page-intro"><div><h2>Bom dia.</h2><p>A operação da villa, num só lugar.</p></div><button className="button button--quiet" onClick={() => onScreen('reports')}>Ver relatório <ChevronRight size={16} /></button></div><div className="metric-strip"><Metric label="Resultado previsto" value={money(metrics.netRevenue, currency)} emphasis /><Metric label="Receita não confirmada" value={money(metrics.openBalance, currency)} /><Metric label="Gastos" value={money(metrics.expenses, currency)} /><Metric label="Reservas ativas" value={String(metrics.activeReservations)} /></div>{requests.length > 0 && <button className="attention-card" onClick={() => onScreen('requests')}><Inbox size={21} /><span><strong>{requests.length} {requests.length === 1 ? 'pedido novo' : 'pedidos novos'}</strong><small>Reveja disponibilidade e responda ao hóspede.</small></span><ChevronRight size={18} /></button>}<div className="content-grid"><section className="panel"><div className="panel__heading"><div><p className="eyebrow">Próximas entradas</p><h3>Calendário imediato</h3></div><button className="text-button" onClick={() => onScreen('reservations')}>Ver reservas</button></div>{upcoming.length ? <div className="timeline">{upcoming.map((reservation) => <ReservationLine key={reservation.id} reservation={reservation} currency={currency} />)}</div> : <EmptyState text="Ainda não há entradas nas próximas seis semanas." />}</section><section className="panel panel--soft"><p className="eyebrow">Hoje</p><h3>Notas de operação</h3><ul className="check-list"><li><span>✓</span>Confirme reservas pendentes antes de bloquear datas.</li><li><span>✓</span>O gasto de comissão é criado automaticamente quando marca uma reserva como paga.</li><li><span>✓</span>Uma reserva parcial não representa um montante recebido até este ser registado.</li></ul></section></div></section>;
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? 'metric metric--emphasis' : 'metric'}><span>{label}</span><strong>{value}</strong></div>;
}

function RequestsScreen({ data, currency, onAccept, onStatus }: { data: AdminData; currency: string; onAccept: (request: BookingRequest) => void; onStatus: (request: BookingRequest, status: BookingRequest['status']) => void }) {
  const [filter, setFilter] = useState<'all' | BookingRequest['status']>('all');
  const requests = data.requests.filter((request) => filter === 'all' || request.status === filter);
  return <section className="page-content"><div className="page-intro"><div><h2>Pedidos de reserva</h2><p>O valor apresentado foi calculado no servidor.</p></div></div><div className="filter-row">{(['all', 'new', 'contacted', 'accepted', 'declined'] as const).map((status) => <button key={status} className={filter === status ? 'filter is-active' : 'filter'} onClick={() => setFilter(status)}>{status === 'all' ? 'Todos' : requestStatus(status)}</button>)}</div><div className="request-list">{requests.length ? requests.map((request) => <article key={request.id} className="request-card"><div className="request-card__head"><div><p className="eyebrow">{date(request.created_at)}</p><h3>{request.full_name}</h3></div><StatusBadge type="request" value={request.status} /></div><div className="request-facts"><span>{dateRange(request.check_in, request.check_out)} · {nights(request.check_in, request.check_out)} noites</span><strong>{money(request.estimated_total_amount, currency)}</strong></div><p className="request-contact"><a href={`mailto:${request.email}`}>{request.email}</a><a href={`tel:${request.phone}`}>{request.phone}</a> · {request.guests_count} hóspedes</p>{request.heated_pool && <p className="inline-note">Piscina aquecida incluída</p>}{request.promo_code && <p className="inline-note">Cupão: {request.promo_code}</p>}{request.guest_message && <blockquote>{request.guest_message}</blockquote>}<div className="request-card__foot"><span className={request.notification_status === 'failed' ? 'notification notification--fail' : 'notification'}>{request.notification_status === 'sent' ? 'Email enviado ao gestor' : request.notification_status === 'failed' ? 'Pedido guardado; email falhou' : 'Notificação pendente'}</span>{request.status === 'new' && <div className="row-actions"><button className="button button--quiet" onClick={() => onStatus(request, 'contacted')}>Marcar contactado</button><button className="button button--dark" onClick={() => onAccept(request)}>Aceitar e criar reserva</button></div>}{request.status === 'contacted' && <div className="row-actions"><button className="button button--quiet" onClick={() => onStatus(request, 'declined')}>Recusar</button><button className="button button--dark" onClick={() => onAccept(request)}>Criar reserva</button></div>}</div></article>) : <EmptyState text="Não existem pedidos neste filtro." />}</div></section>;
}

function ReservationsScreen({ data, currency, onNew, onEdit, onCancel }: { data: AdminData; currency: string; onNew: () => void; onEdit: (reservation: Reservation) => void; onCancel: (reservation: Reservation) => void }) {
  const [filter, setFilter] = useState<'active' | 'all' | Reservation['status']>('active');
  const rows = data.reservations.filter((reservation) => filter === 'all' || (filter === 'active' ? isActiveReservation(reservation) : reservation.status === filter));
  return <section className="page-content"><div className="page-intro"><div><h2>Reservas</h2><p>Datas, pagamentos, depósitos e comunicação.</p></div><button className="button button--dark" onClick={onNew}><Plus size={17} />Nova reserva</button></div><div className="filter-row"><button className={filter === 'active' ? 'filter is-active' : 'filter'} onClick={() => setFilter('active')}>Ativas</button><button className={filter === 'all' ? 'filter is-active' : 'filter'} onClick={() => setFilter('all')}>Todas</button>{(['confirmed', 'pending', 'checked_out', 'cancelled'] as const).map((status) => <button key={status} className={filter === status ? 'filter is-active' : 'filter'} onClick={() => setFilter(status)}>{reservationStatus(status)}</button>)}</div><div className="reservation-list">{rows.length ? rows.map((reservation) => <article key={reservation.id} className="reservation-card"><div className="reservation-date"><strong>{shortDate(reservation.check_in)}</strong><span>{nights(reservation.check_in, reservation.check_out)} noites</span></div><div className="reservation-card__main"><div className="reservation-card__heading"><div><h3>{reservation.guests?.full_name ?? 'Hóspede por associar'}</h3><p>{dateRange(reservation.check_in, reservation.check_out)} · {sourceLabel(reservation.source)}</p></div><StatusBadge type="reservation" value={reservation.status} /></div><div className="reservation-finance"><span>{paymentStatus(reservation.payment_status)}</span><strong>{money(reservation.total_amount, currency)}</strong><small>{reservation.payment_status === 'paid' ? 'Após comissão' : 'Receita prevista'} {money(reservationNet(reservation), currency)}</small></div>{reservation.deposit_amount && <p className="inline-note">Depósito {money(reservation.deposit_amount, currency)} · {reservation.deposit_status ?? 'pendente'}</p>}<div className="row-actions"><WhatsAppButton reservation={reservation} /><button className="button button--quiet" onClick={() => onEdit(reservation)}><Pencil size={15} />Editar</button>{reservation.status !== 'cancelled' && <button className="button button--danger" onClick={() => onCancel(reservation)}>Cancelar</button>}</div></div></article>) : <EmptyState text="Não há reservas neste filtro." />}</div></section>;
}

function ExpensesScreen({ data, currency, onNew, onEdit }: { data: AdminData; currency: string; onNew: () => void; onEdit: (expense: Expense) => void }) {
  const total = data.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  return <section className="page-content"><div className="page-intro"><div><h2>Gastos</h2><p>{money(total, currency)} registados no total.</p></div><button className="button button--dark" onClick={onNew}><Plus size={17} />Novo gasto</button></div><div className="expense-list">{data.expenses.length ? data.expenses.map((expense) => <article key={expense.id} className="list-card"><div className="list-card__icon"><WalletCards size={17} /></div><div className="list-card__body"><h3>{expense.category}</h3><p>{expense.description || expense.paid_to || 'Sem descrição'} · {date(expense.occurred_on)}</p>{expense.is_automatic && <span className="inline-note">Gerado automaticamente pela comissão</span>}</div><div className="list-card__end"><strong>{money(expense.amount, currency)}</strong>{expense.is_automatic ? <span className="list-card__muted">Automático</span> : <button className="icon-button" title="Editar gasto" onClick={() => onEdit(expense)}><Pencil size={15} /></button>}</div></article>) : <EmptyState text="Ainda não existem gastos registados." />}</div></section>;
}

function GuestsScreen({ data, onNew, onEdit }: { data: AdminData; onNew: () => void; onEdit: (guest: Guest) => void }) {
  const [query, setQuery] = useState('');
  const guests = data.guests.filter((guest) => `${guest.full_name} ${guest.email ?? ''} ${guest.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="page-content"><div className="page-intro"><div><h2>Hóspedes</h2><p>{data.guests.length} contactos privados na base de dados.</p></div><button className="button button--dark" onClick={onNew}><Plus size={17} />Novo hóspede</button></div><label className="search"><Menu size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar nome, email ou telefone" /></label><div className="guest-grid">{guests.length ? guests.map((guest) => <article key={guest.id} className="guest-card"><div className="guest-avatar">{guest.full_name.slice(0, 1).toUpperCase()}</div><div><h3>{guest.full_name}</h3><p>{guest.email || guest.phone || 'Sem contacto'}</p>{guest.country && <small>{guest.country}</small>}</div><button className="icon-button" title="Editar hóspede" onClick={() => onEdit(guest)}><Pencil size={15} /></button></article>) : <EmptyState text="Não encontrámos hóspedes com essa pesquisa." />}</div></section>;
}

function ReportsScreen({ data, currency, onExport }: { data: AdminData; currency: string; onExport: () => void }) {
  const metrics = calculateMetrics(data.reservations, data.expenses);
  const rows = Object.entries(data.reservations.filter((reservation) => reservation.status !== 'cancelled').reduce<Record<string, { revenue: number; commissions: number; reservations: number }>>((accumulator, reservation) => {
    const key = reservation.check_in?.slice(0, 7) ?? 'Sem data';
    const row = accumulator[key] ?? { revenue: 0, commissions: 0, reservations: 0 };
    row.revenue += Number(reservation.total_amount ?? 0); if (reservation.payment_status === 'paid') row.commissions += Number(reservation.commission_amount ?? 0); row.reservations += 1;
    accumulator[key] = row; return accumulator;
  }, {})).sort(([left], [right]) => left.localeCompare(right));
  return <section className="page-content report-print"><div className="page-intro"><div><h2>Relatórios</h2><p>Receita prevista, gastos e operação por período.</p></div><div className="row-actions"><button className="button button--quiet" onClick={onExport}><Download size={16} />Backup JSON</button><button className="button button--dark" onClick={() => window.print()}>Imprimir</button></div></div><div className="metric-strip"><Metric label="Receita prevista" value={money(metrics.grossRevenue, currency)} /><Metric label="Comissões pagas" value={money(metrics.commissions, currency)} /><Metric label="Gastos" value={money(metrics.expenses, currency)} /><Metric label="Resultado previsto" value={money(metrics.netRevenue, currency)} emphasis /></div><section className="panel report-table"><div className="panel__heading"><div><p className="eyebrow">Por mês de check-in</p><h3>Desempenho</h3></div></div>{rows.length ? <table><thead><tr><th>Mês</th><th>Reservas</th><th>Receita prevista</th><th>Comissões pagas</th><th>Receita antes de gastos</th></tr></thead><tbody>{rows.map(([month, row]) => <tr key={month}><td>{month === 'Sem data' ? month : new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))}</td><td>{row.reservations}</td><td>{money(row.revenue, currency)}</td><td>{money(row.commissions, currency)}</td><td>{money(row.revenue, currency)}</td></tr>)}</tbody></table> : <EmptyState text="Os relatórios aparecem quando existirem reservas." />}</section></section>;
}

function SettingsScreen({ data, ownerId, currency, onEditRate, onEditPromo, onNewRate, onNewPromo, onReload, onNotice }: { data: AdminData; ownerId: string; currency: string; onEditRate: (value: SeasonalRate) => void; onEditPromo: (value: PromoCode) => void; onNewRate: () => void; onNewPromo: () => void; onReload: () => Promise<void>; onNotice: (tone: ToastTone, message: string) => void }) {
  const [values, setValues] = useState(() => settingsDraft(data.settings));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValues(settingsDraft(data.settings)), [data.settings]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const payload = { owner_id: ownerId, property_name: values.propertyName.trim() || 'Villa Valverde', minimum_nights: Number(values.minimumNights), heated_pool_weekly_price: Number(values.poolPrice), direct_discount_percent: Number(values.discount), currency: values.currency.toUpperCase(), timezone: values.timezone };
    const query = data.settings ? getSupabase().from('property_settings').update(payload).eq('id', data.settings.id) : getSupabase().from('property_settings').insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { onNotice('error', error.message); return; }
    onNotice('success', 'Configuração guardada.'); void onReload();
  };
  const importLegacy = async () => {
    if (!window.confirm('Vai criar um único snapshot auditável de valverde_data e copiar reservas, hóspedes e gastos. A tabela antiga não será alterada e a reimportação ficará bloqueada. Continuar?')) return;
    setSaving(true);
    const { data: result, error } = await getSupabase().rpc('import_legacy_valverde_data_once', { p_owner_id: ownerId });
    setSaving(false);
    if (error) { onNotice('error', error.message); return; }
    const migrated = result as { guests_written?: number; reservations_written?: number; expenses_written?: number } | null;
    onNotice('success', `Migração concluída: ${migrated?.reservations_written ?? 0} reservas, ${migrated?.guests_written ?? 0} hóspedes e ${migrated?.expenses_written ?? 0} gastos.`); void onReload();
  };
  const deleteRate = async (rate: SeasonalRate) => { if (!window.confirm('Apagar este período de preço?')) return; const { error } = await getSupabase().from('seasonal_rates').delete().eq('id', rate.id); if (error) onNotice('error', error.message); else { onNotice('success', 'Preço eliminado.'); void onReload(); } };
  const deletePromo = async (promo: PromoCode) => { if (!window.confirm(`Apagar o cupão ${promo.code}?`)) return; const { error } = await getSupabase().from('promo_codes').delete().eq('id', promo.id); if (error) onNotice('error', error.message); else { onNotice('success', 'Cupão eliminado.'); void onReload(); } };
  return <section className="page-content"><div className="page-intro"><div><h2>Configuração</h2><p>Preços, regras e integridade dos dados.</p></div></div><div className="settings-layout"><section className="panel"><div className="panel__heading"><div><p className="eyebrow">Villa</p><h3>Regras públicas</h3></div></div><form className="stack-form" onSubmit={save}><div className="form-grid"><Field label="Nome da propriedade"><input value={values.propertyName} onChange={(event) => setValues({ ...values, propertyName: event.target.value })} /></Field><Field label="Moeda"><input maxLength={3} value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value })} /></Field><Field label="Estadia mínima (noites)"><input min="1" type="number" value={values.minimumNights} onChange={(event) => setValues({ ...values, minimumNights: event.target.value })} /></Field><Field label="Piscina aquecida / semana"><input min="0" step="0.01" type="number" value={values.poolPrice} onChange={(event) => setValues({ ...values, poolPrice: event.target.value })} /></Field><Field label="Desconto direto (%)"><input min="0" max="100" step="0.01" type="number" value={values.discount} onChange={(event) => setValues({ ...values, discount: event.target.value })} /></Field><Field label="Fuso horário"><input value={values.timezone} onChange={(event) => setValues({ ...values, timezone: event.target.value })} /></Field></div><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar configuração'}</button></form></section><section className="panel panel--soft"><p className="eyebrow">Dados legados</p><h3>Migração segura</h3><p>Cria um único snapshot auditável de <code>valverde_data</code>, regista o checksum e mantém a tabela antiga intocada. A reimportação fica bloqueada por defeito.</p><button className="button button--quiet" disabled={saving} onClick={importLegacy}><RefreshCw size={16} />Importar dados antigos uma vez</button><p className="form-help">Faça a validação de contagens e totais antes de deixar de usar o HTML original.</p></section></div><section className="panel settings-section"><div className="panel__heading"><div><p className="eyebrow">Preços por noite</p><h3>Épocas sazonais</h3></div><button className="button button--dark" onClick={onNewRate}><Plus size={16} />Nova época</button></div><div className="settings-list">{data.rates.length ? data.rates.map((rate) => <div key={rate.id} className="settings-row"><div><strong>{date(rate.starts_on)} — {date(rate.ends_on)}</strong><p>{rate.active ? 'Ativa no site público' : 'Inativa'}</p></div><div><strong>{money(rate.direct_nightly_price, currency)}</strong>{rate.booking_reference_nightly_price && <small>Booking: {money(rate.booking_reference_nightly_price, currency)}</small>}</div><button className="icon-button" title="Editar época" onClick={() => onEditRate(rate)}><Pencil size={15} /></button><button className="icon-button icon-button--danger" title="Apagar época" onClick={() => void deleteRate(rate)}><X size={15} /></button></div>) : <EmptyState text="Ainda não existem épocas de preço." />}</div></section><section className="panel settings-section"><div className="panel__heading"><div><p className="eyebrow">Promoções</p><h3>Cupões de desconto</h3></div><button className="button button--dark" onClick={onNewPromo}><Plus size={16} />Novo cupão</button></div><div className="settings-list">{data.promoCodes.length ? data.promoCodes.map((promo) => <div key={promo.id} className="settings-row"><div><strong>{promo.code}</strong><p>{promo.active ? 'Ativo' : 'Inativo'}{promo.starts_on ? ` · ${date(promo.starts_on)}` : ''}{promo.ends_on ? ` — ${date(promo.ends_on)}` : ''}</p></div><strong>{Number(promo.discount_percent)}%</strong><button className="icon-button" title="Editar cupão" onClick={() => onEditPromo(promo)}><Pencil size={15} /></button><button className="icon-button icon-button--danger" title="Apagar cupão" onClick={() => void deletePromo(promo)}><X size={15} /></button></div>) : <EmptyState text="Ainda não existem cupões ativos." />}</div></section></section>;
}

function ReservationEditor({ data, ownerId, value, currency, onClose, onSaved, onNotice }: { data: AdminData; ownerId: string; value?: Reservation; currency: string; onClose: () => void; onSaved: () => void; onNotice: (tone: ToastTone, message: string) => void }) {
  const [draft, setDraft] = useState(() => reservationDraft(value));
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const set = <K extends keyof typeof draft>(key: K, next: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.checkIn && draft.checkOut && draft.checkOut <= draft.checkIn) { onNotice('error', 'O check-out tem de ser posterior ao check-in.'); return; }
    if (['pending', 'confirmed', 'checked_in'].includes(draft.status) && draft.checkIn && draft.checkOut && hasDateConflict(data.reservations, draft.checkIn, draft.checkOut, value?.id)) { onNotice('error', 'Há uma reserva ativa sobreposta nestas datas.'); return; }
    setSaving(true);
    try {
      const db = getSupabase();
      let guestId = draft.guestId || null;
      if (draft.guestName.trim()) {
        const matching = data.guests.find((guest) => (draft.guestEmail && guest.email?.toLowerCase() === draft.guestEmail.toLowerCase()) || (draft.guestPhone && normalizePhone(guest.phone) === normalizePhone(draft.guestPhone)));
        if (matching) {
          const { error } = await db.from('guests').update({ full_name: draft.guestName.trim(), email: nullable(draft.guestEmail), phone: nullable(draft.guestPhone) }).eq('id', matching.id);
          if (error) throw error;
          guestId = matching.id;
        } else {
          const { data: guest, error } = await db.from('guests').insert({ owner_id: ownerId, full_name: draft.guestName.trim(), email: nullable(draft.guestEmail), phone: nullable(draft.guestPhone) }).select('id').single();
          if (error || !guest) throw error ?? new Error('Não foi possível criar o hóspede.');
          guestId = guest.id;
        }
      }
      const payload = { guest_id: guestId, source: draft.source, channel: nullable(draft.channel), booking_reference: nullable(draft.bookingReference), check_in: nullable(draft.checkIn), check_out: nullable(draft.checkOut), guests_count: numberOrNull(draft.guestsCount), total_amount: numberOrNull(draft.totalAmount), commission_amount: Number(draft.commissionAmount || 0), payment_method: nullable(draft.paymentMethod), payment_status: draft.paymentStatus, status: draft.status, private_notes: nullable(draft.notes), special_requests: splitList(draft.specialRequests), cleaning_checklist: serializeCleaningChecklist(draft.cleaningChecklist), deposit_amount: numberOrNull(draft.depositAmount), deposit_received_on: nullable(draft.depositReceivedOn), deposit_returned_on: nullable(draft.depositReturnedOn), deposit_status: draft.depositStatus || null, deposit_notes: nullable(draft.depositNotes) };
      const result = value ? await db.from('reservations').update(payload).eq('id', value.id) : await db.from('reservations').insert({ owner_id: ownerId, ...payload });
      if (result.error) throw result.error;
      onSaved();
    } catch (nextError) { onNotice('error', appError(nextError)); }
    finally { setSaving(false); }
  };
  const importPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const endpoint = import.meta.env.VITE_BOOKING_IMPORT_ENDPOINT;
    if (!file || !endpoint) { onNotice('error', 'O endpoint temporário do importador Booking ainda não está configurado.'); return; }
    if (!file.type.startsWith('image/') || file.size > 8_000_000) { onNotice('error', 'Escolha uma imagem até 8 MB.'); return; }
    setImporting(true);
    try {
      const compressed = await compressImage(file);
      const base64 = compressed.split(',')[1] ?? '';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'analyzePhoto', imageData: base64, mediaType: 'image/jpeg' }) });
      if (!response.ok) throw new Error('O importador não respondeu corretamente.');
      const raw = await response.text();
      const extracted = JSON.parse(raw.replace(/```json|```/g, '').trim()) as Record<string, string | number | undefined>;
      setDraft((current) => ({ ...current, guestId: '', guestName: String(extracted.name ?? current.guestName), guestEmail: String(extracted.email ?? current.guestEmail), guestPhone: String(extracted.phone ?? current.guestPhone), checkIn: String(extracted.checkin ?? current.checkIn), checkOut: String(extracted.checkout ?? current.checkOut), guestsCount: String(extracted.guests ?? current.guestsCount), totalAmount: String(extracted.price ?? current.totalAmount), commissionAmount: String(extracted.comissao ?? current.commissionAmount), bookingReference: String(extracted.reservaNum ?? current.bookingReference), source: 'booking', channel: 'Booking.com' }));
      onNotice('success', 'Dados extraídos. Confirme todos os campos antes de guardar.');
    } catch (nextError) { onNotice('error', `Não foi possível analisar a foto: ${appError(nextError)}`); }
    finally { setImporting(false); event.target.value = ''; }
  };
  return <Modal title={value ? 'Editar reserva' : 'Nova reserva'} onClose={onClose}><form className="stack-form" onSubmit={submit}>{!value && <label className="import-photo"><input type="file" accept="image/*" capture="environment" onChange={importPhoto} /><span><Sparkles size={17} /><strong>{importing ? 'A analisar fotografia…' : 'Importar fotografia Booking.com'}</strong><small>Ferramenta temporária: confirme sempre os dados extraídos.</small></span></label>}<div className="form-grid"><Field label="Hóspede existente"><select value={draft.guestId} onChange={(event) => set('guestId', event.target.value)}><option value="">Selecionar depois</option>{data.guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.full_name}</option>)}</select></Field><Field label="Canal"><input value={draft.channel} onChange={(event) => set('channel', event.target.value)} placeholder="Booking.com, direto…" /></Field><Field label="Novo/atualizar hóspede"><input value={draft.guestName} onChange={(event) => set('guestName', event.target.value)} placeholder="Nome completo" /></Field><Field label="Email do hóspede"><input type="email" value={draft.guestEmail} onChange={(event) => set('guestEmail', event.target.value)} /></Field><Field label="Telefone"><input value={draft.guestPhone} onChange={(event) => set('guestPhone', event.target.value)} /></Field><Field label="Origem"><select value={draft.source} onChange={(event) => set('source', event.target.value as Reservation['source'])}>{(['manual', 'direct', 'site', 'booking', 'airbnb', 'other'] as const).map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}</select></Field><Field label="Check-in"><input type="date" value={draft.checkIn} onChange={(event) => set('checkIn', event.target.value)} /></Field><Field label="Check-out"><input type="date" value={draft.checkOut} onChange={(event) => set('checkOut', event.target.value)} /></Field><Field label="N.º hóspedes"><input min="1" max="99" type="number" value={draft.guestsCount} onChange={(event) => set('guestsCount', event.target.value)} /></Field><Field label="N.º reserva"><input value={draft.bookingReference} onChange={(event) => set('bookingReference', event.target.value)} /></Field><Field label={`Total (${currency})`}><input min="0" step="0.01" type="number" value={draft.totalAmount} onChange={(event) => set('totalAmount', event.target.value)} /></Field><Field label={`Comissão (${currency})`}><input min="0" step="0.01" type="number" value={draft.commissionAmount} onChange={(event) => set('commissionAmount', event.target.value)} /></Field><Field label="Método de pagamento"><input value={draft.paymentMethod} onChange={(event) => set('paymentMethod', event.target.value)} placeholder="Transferência, OTA…" /></Field><Field label="Pagamento"><select value={draft.paymentStatus} onChange={(event) => set('paymentStatus', event.target.value as Reservation['payment_status'])}>{(['not_paid', 'partial', 'paid'] as const).map((status) => <option key={status} value={status}>{paymentStatus(status)}</option>)}</select></Field><Field label="Estado"><select value={draft.status} onChange={(event) => set('status', event.target.value as Reservation['status'])}>{(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as const).map((status) => <option key={status} value={status}>{reservationStatus(status)}</option>)}</select></Field><Field label={`Depósito (${currency})`}><input min="0" step="0.01" type="number" value={draft.depositAmount} onChange={(event) => set('depositAmount', event.target.value)} /></Field><Field label="Estado do depósito"><select value={draft.depositStatus} onChange={(event) => set('depositStatus', event.target.value)}><option value="">Não definido</option><option value="pending">Pendente</option><option value="received">Recebido</option><option value="returned">Devolvido</option><option value="partially_returned">Devolvido parcialmente</option></select></Field><Field label="Data recebida"><input type="date" value={draft.depositReceivedOn} onChange={(event) => set('depositReceivedOn', event.target.value)} /></Field><Field label="Data devolvida"><input type="date" value={draft.depositReturnedOn} onChange={(event) => set('depositReturnedOn', event.target.value)} /></Field></div><Field label="Pedidos especiais (separe por vírgulas ou linhas)"><textarea rows={2} value={draft.specialRequests} onChange={(event) => set('specialRequests', event.target.value)} /></Field><ChecklistEditor items={draft.cleaningChecklist} onChange={(items) => set('cleaningChecklist', items)} /><Field label="Notas privadas"><textarea rows={3} value={draft.notes} onChange={(event) => set('notes', event.target.value)} /></Field><Field label="Notas do depósito"><textarea rows={2} value={draft.depositNotes} onChange={(event) => set('depositNotes', event.target.value)} /></Field><div className="modal-actions"><button type="button" className="button button--quiet" onClick={onClose}>Cancelar</button><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar reserva'}</button></div></form></Modal>;
}

function ChecklistEditor({ items, onChange }: { items: CleaningChecklistItem[]; onChange: (items: CleaningChecklistItem[]) => void }) {
  const [newTask, setNewTask] = useState('');
  const doneCount = items.filter((item) => item.done).length;
  const toggle = (id: string) => onChange(items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const addTask = () => {
    const label = newTask.trim().slice(0, 160);
    if (!label) return;
    onChange([...items, { id: `custom-${Date.now()}`, label, done: false }]);
    setNewTask('');
  };
  return <section className="checklist-editor" aria-labelledby="cleaning-checklist-title"><div className="checklist-editor__heading"><span id="cleaning-checklist-title">Checklist de limpeza</span><small>{doneCount}/{items.length} tarefas concluídas</small></div><div className="checklist-editor__items">{items.map((item) => <label key={item.id} className={item.done ? 'is-done' : ''}><input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} /><span>{item.label}</span></label>)}</div><div className="checklist-editor__add"><input value={newTask} maxLength={160} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTask(); } }} placeholder="Adicionar tarefa" /><button type="button" className="button button--quiet" onClick={addTask}>Adicionar</button></div></section>;
}

function ExpenseEditor({ data, ownerId, value, currency, onClose, onSaved }: { data: AdminData; ownerId: string; value?: Expense; currency: string; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => expenseDraft(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(undefined); setSaving(true); const payload = { reservation_id: nullable(draft.reservationId), category: draft.category.trim() || 'Outro', amount: Number(draft.amount), occurred_on: nullable(draft.occurredOn), description: nullable(draft.description), paid_to: nullable(draft.paidTo), is_paid: draft.isPaid, paid_on: nullable(draft.paidOn) }; const result = value ? await getSupabase().from('expenses').update(payload).eq('id', value.id) : await getSupabase().from('expenses').insert({ owner_id: ownerId, ...payload }); setSaving(false); if (result.error) { setError(result.error.message); return; } onSaved(); };
  return <Modal title={value ? 'Editar gasto' : 'Novo gasto'} onClose={onClose}><form className="stack-form" onSubmit={submit}><div className="form-grid"><Field label="Categoria"><input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Limpeza, manutenção…" /></Field><Field label={`Valor (${currency})`}><input required min="0" step="0.01" type="number" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></Field><Field label="Data"><input type="date" value={draft.occurredOn} onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })} /></Field><Field label="Reserva associada"><select value={draft.reservationId} onChange={(event) => setDraft({ ...draft, reservationId: event.target.value })}><option value="">Sem reserva associada</option>{data.reservations.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.guests?.full_name ?? 'Hóspede'} · {dateRange(reservation.check_in, reservation.check_out)}</option>)}</select></Field><Field label="Pago a"><input value={draft.paidTo} onChange={(event) => setDraft({ ...draft, paidTo: event.target.value })} /></Field><Field label="Data de pagamento"><input type="date" value={draft.paidOn} onChange={(event) => setDraft({ ...draft, paidOn: event.target.value })} /></Field></div><label className="checkbox"><input type="checkbox" checked={draft.isPaid} onChange={(event) => setDraft({ ...draft, isPaid: event.target.checked })} />Já pago</label><Field label="Descrição"><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>{error && <Notice tone="error">{error}</Notice>}<div className="modal-actions"><button type="button" className="button button--quiet" onClick={onClose}>Cancelar</button><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar gasto'}</button></div></form></Modal>;
}

function GuestEditor({ ownerId, value, onClose, onSaved }: { ownerId: string; value?: Guest; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => guestDraft(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(undefined); setSaving(true); const payload = { full_name: draft.fullName.trim(), email: nullable(draft.email), phone: nullable(draft.phone), nationality: nullable(draft.nationality), country: nullable(draft.country), comments: nullable(draft.comments), rating: numberOrNull(draft.rating) }; const result = value ? await getSupabase().from('guests').update(payload).eq('id', value.id) : await getSupabase().from('guests').insert({ owner_id: ownerId, ...payload }); setSaving(false); if (result.error) { setError(result.error.message); return; } onSaved(); };
  return <Modal title={value ? 'Editar hóspede' : 'Novo hóspede'} onClose={onClose}><form className="stack-form" onSubmit={submit}><div className="form-grid"><Field label="Nome completo"><input required value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></Field><Field label="Email"><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Telefone"><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field><Field label="Nacionalidade"><input value={draft.nationality} onChange={(event) => setDraft({ ...draft, nationality: event.target.value })} /></Field><Field label="País"><input value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} /></Field><Field label="Avaliação (0–5)"><input min="0" max="5" type="number" value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></Field></div><Field label="Notas privadas"><textarea rows={4} value={draft.comments} onChange={(event) => setDraft({ ...draft, comments: event.target.value })} /></Field>{error && <Notice tone="error">{error}</Notice>}<div className="modal-actions"><button type="button" className="button button--quiet" onClick={onClose}>Cancelar</button><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar hóspede'}</button></div></form></Modal>;
}

function RateEditor({ ownerId, value, onClose, onSaved }: { ownerId: string; value?: SeasonalRate; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => rateDraft(value)); const [saving, setSaving] = useState(false); const [error, setError] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(undefined); if (draft.endsOn < draft.startsOn) { setError('A data final tem de ser posterior à data inicial.'); return; } setSaving(true); const payload = { starts_on: draft.startsOn, ends_on: draft.endsOn, booking_reference_nightly_price: numberOrNull(draft.bookingPrice), direct_nightly_price: Number(draft.directPrice), active: draft.active }; const result = value ? await getSupabase().from('seasonal_rates').update(payload).eq('id', value.id) : await getSupabase().from('seasonal_rates').insert({ owner_id: ownerId, ...payload }); setSaving(false); if (result.error) { setError(result.error.message); return; } onSaved(); };
  return <Modal title={value ? 'Editar época' : 'Nova época'} onClose={onClose}><form className="stack-form" onSubmit={submit}><div className="form-grid"><Field label="Início"><input required type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} /></Field><Field label="Fim"><input required type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} /></Field><Field label="Preço Booking / noite"><input min="0" step="0.01" type="number" value={draft.bookingPrice} onChange={(event) => setDraft({ ...draft, bookingPrice: event.target.value })} /></Field><Field label="Preço direto / noite"><input required min="0" step="0.01" type="number" value={draft.directPrice} onChange={(event) => setDraft({ ...draft, directPrice: event.target.value })} /></Field></div><label className="checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Ativa no cálculo público</label>{error && <Notice tone="error">{error}</Notice>}<div className="modal-actions"><button type="button" className="button button--quiet" onClick={onClose}>Cancelar</button><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar época'}</button></div></form></Modal>;
}

function PromoEditor({ ownerId, value, onClose, onSaved }: { ownerId: string; value?: PromoCode; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => promoDraft(value)); const [saving, setSaving] = useState(false); const [error, setError] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(undefined); if (draft.endsOn && draft.startsOn && draft.endsOn < draft.startsOn) { setError('A data final não pode ser anterior à inicial.'); return; } setSaving(true); const payload = { code: draft.code.trim().toUpperCase(), discount_percent: Number(draft.discount), starts_on: nullable(draft.startsOn), ends_on: nullable(draft.endsOn), active: draft.active }; const result = value ? await getSupabase().from('promo_codes').update(payload).eq('id', value.id) : await getSupabase().from('promo_codes').insert({ owner_id: ownerId, ...payload }); setSaving(false); if (result.error) { setError(result.error.message); return; } onSaved(); };
  return <Modal title={value ? 'Editar cupão' : 'Novo cupão'} onClose={onClose}><form className="stack-form" onSubmit={submit}><div className="form-grid"><Field label="Código"><input required maxLength={32} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="VERAO10" /></Field><Field label="Desconto (%)"><input required min="0.01" max="100" step="0.01" type="number" value={draft.discount} onChange={(event) => setDraft({ ...draft, discount: event.target.value })} /></Field><Field label="Válido a partir de"><input type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} /></Field><Field label="Válido até"><input type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} /></Field></div><label className="checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Cupão ativo</label>{error && <Notice tone="error">{error}</Notice>}<div className="modal-actions"><button type="button" className="button button--quiet" onClick={onClose}>Cancelar</button><button className="button button--dark" disabled={saving}>{saving ? 'A guardar…' : 'Guardar cupão'}</button></div></form></Modal>;
}

function WhatsAppButton({ reservation }: { reservation: Reservation }) {
  const phone = normalizePhone(reservation.guests?.phone);
  if (!phone) return null;
  const name = reservation.guests?.full_name?.split(' ')[0] ?? 'Olá';
  const message = `Olá ${name}! 🏡\n\nA sua estadia na Villa Valverde aproxima-se. Check-in: ${date(reservation.check_in)}. Se precisar de alguma coisa antes da chegada, estamos disponíveis.`;
  return <a className="button button--whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}><MessageCircle size={15} />WhatsApp</a>;
}

function ReservationLine({ reservation, currency }: { reservation: Reservation; currency: string }) {
  return <div className="timeline__row"><time>{shortDate(reservation.check_in)}</time><div><strong>{reservation.guests?.full_name ?? 'Hóspede por associar'}</strong><span>{dateRange(reservation.check_in, reservation.check_out)} · {sourceLabel(reservation.source)}</span></div><strong>{money(reservation.total_amount, currency)}</strong></div>;
}

function StatusBadge({ type, value }: { type: 'reservation'; value: Reservation['status'] } | { type: 'request'; value: BookingRequest['status'] }) {
  const label = type === 'reservation' ? reservationStatus(value as Reservation['status']) : requestStatus(value as BookingRequest['status']);
  return <span className={`status status--${value}`}>{label}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) { return <p className={`notice notice--${tone}`}>{tone === 'success' ? <Check size={16} /> : <CircleAlert size={16} />}{children}</p>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ClipboardList size={22} /><p>{text}</p></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal__header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>{children}</section></div>; }

function nullable(value: string): string | null { return value.trim() || null; }
function numberOrNull(value: string): number | null { return value.trim() === '' ? null : Number(value); }

function settingsDraft(value: PropertySettings | null) { return { propertyName: value?.property_name ?? 'Villa Valverde', minimumNights: String(value?.minimum_nights ?? 7), poolPrice: String(value?.heated_pool_weekly_price ?? 150), discount: String(value?.direct_discount_percent ?? 10), currency: value?.currency ?? 'EUR', timezone: value?.timezone ?? 'Europe/Lisbon' }; }
function reservationDraft(value?: Reservation) { return { guestId: value?.guest_id ?? '', guestName: '', guestEmail: '', guestPhone: '', source: value?.source ?? 'manual' as Reservation['source'], channel: value?.channel ?? '', bookingReference: value?.booking_reference ?? '', checkIn: value?.check_in ?? '', checkOut: value?.check_out ?? '', guestsCount: String(value?.guests_count ?? 2), totalAmount: value?.total_amount == null ? '' : String(value.total_amount), commissionAmount: String(value?.commission_amount ?? 0), paymentMethod: value?.payment_method ?? '', paymentStatus: value?.payment_status ?? 'not_paid' as Reservation['payment_status'], status: value?.status ?? 'pending' as Reservation['status'], specialRequests: jsonList(value?.special_requests).join('\n'), cleaningChecklist: normalizeCleaningChecklist(value?.cleaning_checklist), notes: value?.private_notes ?? '', depositAmount: value?.deposit_amount == null ? '' : String(value.deposit_amount), depositStatus: value?.deposit_status ?? '', depositReceivedOn: value?.deposit_received_on ?? '', depositReturnedOn: value?.deposit_returned_on ?? '', depositNotes: value?.deposit_notes ?? '' }; }
function expenseDraft(value?: Expense) { return { reservationId: value?.reservation_id ?? '', category: value?.category ?? '', amount: value?.amount == null ? '' : String(value.amount), occurredOn: value?.occurred_on ?? today(), description: value?.description ?? '', paidTo: value?.paid_to ?? '', isPaid: value?.is_paid ?? true, paidOn: value?.paid_on ?? '' }; }
function guestDraft(value?: Guest) { return { fullName: value?.full_name ?? '', email: value?.email ?? '', phone: value?.phone ?? '', nationality: value?.nationality ?? '', country: value?.country ?? '', comments: value?.comments ?? '', rating: value?.rating == null ? '' : String(value.rating) }; }
function rateDraft(value?: SeasonalRate) { return { startsOn: value?.starts_on ?? '', endsOn: value?.ends_on ?? '', bookingPrice: value?.booking_reference_nightly_price == null ? '' : String(value.booking_reference_nightly_price), directPrice: value?.direct_nightly_price == null ? '' : String(value.direct_nightly_price), active: value?.active ?? true }; }
function promoDraft(value?: PromoCode) { return { code: value?.code ?? '', discount: value?.discount_percent == null ? '' : String(value.discount_percent), startsOn: value?.starts_on ?? '', endsOn: value?.ends_on ?? '', active: value?.active ?? true }; }

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { const ratio = Math.min(1, 1200 / image.width); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); const context = canvas.getContext('2d'); if (!context) { reject(new Error('Não foi possível preparar a imagem.')); return; } context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.85)); }; image.onerror = () => reject(new Error('A imagem não é válida.')); image.src = source; });
}
