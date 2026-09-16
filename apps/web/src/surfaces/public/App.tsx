import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, BedDouble, Car, ChefHat, Coffee, MapPin, Menu, ParkingCircle, ShieldCheck, Sparkles, TreePine, Wifi, X } from 'lucide-react';
import { getPublicBookingConfig } from './lib/api';
import { currency, monthYear } from './lib/format';
import type { PublicBookingConfig } from './lib/types';
import { BookingForm } from './components/BookingForm';
import { PhotoGallery } from './components/PhotoGallery';
import { adminSurfaceUrl } from '../../lib/surface';
import './styles/index.css';

const heroPhotos = ['pool3', 'pool1', 'pool4', 'pool2'];

const amenities = [
  [Sparkles, 'Piscina exterior privada'], [TreePine, 'Jardim e terraço'], [ChefHat, 'Cozinha Siemens'],
  [Wifi, 'Wi-Fi de fibra'], [ParkingCircle, 'Estacionamento privado'], [Coffee, 'Máquina de café'],
  [BedDouble, '4 suites elegantes'], [Car, 'A 5 min da marina']
] as const;

export default function App() {
  const [activeHero, setActiveHero] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [configError, setConfigError] = useState<string>();

  useEffect(() => {
    const timer = window.setInterval(() => setActiveHero((current) => (current + 1) % heroPhotos.length), 5500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    getPublicBookingConfig().then(setConfig).catch((error: Error) => setConfigError(error.message));
  }, []);

  const monthlyRates = useMemo(() => config?.rates.slice(0, 12) ?? [], [config]);
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'reservas@villavalverde.pt';
  const adminUrl = adminSurfaceUrl(window.location);
  const closeMenu = () => setNavOpen(false);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Villa Valverde — início">Villa <em>Valverde</em></a>
        <button className="menu-toggle" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen} aria-label="Abrir menu">{navOpen ? <X /> : <Menu />}</button>
        <nav className={navOpen ? 'is-open' : ''}>
          <a onClick={closeMenu} href="#villa">A villa</a><a onClick={closeMenu} href="#galeria">Galeria</a><a onClick={closeMenu} href="#precos">Preços</a><a onClick={closeMenu} href="#pedido">Reservar</a><a onClick={closeMenu} href="#localizacao">Localização</a>
        </nav>
      </header>

      <section id="inicio" className="hero" aria-label="Villa Valverde em Vilamoura">
        <div className="hero__media" aria-hidden="true">{heroPhotos.map((photo, index) => <img key={photo} src={`/images/${photo}.jpg`} className={index === activeHero ? 'is-active' : ''} alt="" />)}</div>
        <div className="hero__veil" />
        <div className="hero__content">
          <p className="hero__kicker">Vilamoura · Algarve · Reserva direta</p>
          <p className="brand brand--hero">Villa <em>Valverde</em></p>
          <h1>Um refúgio onde o <em>tempo abranda.</em></h1>
          <p className="hero__summary">Quatro suites, piscina privada e a tranquilidade dos pinheiros — a poucos minutos da marina e das praias do Algarve.</p>
          <div className="hero__actions"><a className="button button--primary" href="#pedido">Pedir disponibilidade</a><a className="button button--ghost" href="#galeria">Conhecer a villa</a></div>
        </div>
        <a className="hero__scroll" href="#villa" aria-label="Descer até à apresentação"><ArrowDown size={18} /></a>
      </section>

      <section className="facts" aria-label="Principais características"><div><strong>4</strong><span>Suites</span></div><div><strong>5</strong><span>Casas de banho</span></div><div><strong>9</strong><span>Hóspedes máx.</span></div><div><strong>{config?.settings.minimumNights ?? 7}</strong><span>Noites mínimas</span></div></section>

      <section id="villa" className="section section--villa"><div className="container villa-grid"><div className="villa-photos"><img src="/images/pool1.jpg" alt="Piscina privada da Villa Valverde" /><img src="/images/living1.jpg" alt="Interior da Villa Valverde" /></div><div className="section-copy"><p className="eyebrow">A nossa villa</p><h2>Requinte, natureza e <em>paz absoluta.</em></h2><p>Situada em Vilamoura, no coração do Algarve, a Villa Valverde é um refúgio contemporâneo de luxo rodeado de pinheiros centenários.</p><p>Com piscina privada, jardim, cozinha gourmet Siemens e quatro suites elegantes, foi pensada para dias longos em família ou entre amigos.</p><a className="text-link" href="#pedido">Planear a estadia <span>→</span></a></div></div></section>

      <section id="galeria" className="section section--sand"><div className="container"><div className="section-heading"><p className="eyebrow">Galeria</p><h2>Descubra cada <em>espaço.</em></h2></div><PhotoGallery /></div></section>

      <section className="section section--dark"><div className="container"><div className="section-heading section-heading--center"><p className="eyebrow">Comodidades</p><h2>Tudo o que precisa para <em>desligar.</em></h2></div><div className="amenities-grid">{amenities.map(([Icon, label]) => <div key={label}><Icon size={18} /><span>{label}</span></div>)}</div></div></section>

      <section id="precos" className="section section--pricing"><div className="container"><div className="section-heading"><p className="eyebrow">Preços por noite</p><h2>Reserve diretamente e <em>poupe.</em></h2><p>Preço transparente, sem comissões ocultas. A proposta final é sempre confirmada pela nossa equipa.</p></div><div className="price-note"><ShieldCheck size={22} /><p><strong>Reserva direta, melhor preço garantido.</strong><br />Os valores são atualizados pela gestão da villa e já refletem a vantagem da reserva direta.</p></div>{configError ? <p className="price-status">Os preços serão disponibilizados em breve.</p> : <div className="rates-grid">{monthlyRates.map((rate) => <article key={`${rate.startsOn}-${rate.endsOn}`}><p>{monthYear(rate.startsOn)}</p>{rate.bookingReferenceNightlyPrice && <s>{currency(rate.bookingReferenceNightlyPrice, config?.settings.currency)}</s>}<strong>{currency(rate.directNightlyPrice, config?.settings.currency)}</strong><small>por noite · reserva direta</small></article>)}</div>}<p className="price-footnote">* Estadia mínima: {config?.settings.minimumNights ?? 7} noites. Para até 9 hóspedes.</p></div></section>

      <section id="pedido" className="section section--booking"><div className="container booking-layout"><div className="booking-intro"><p className="eyebrow">Pedido de reserva</p><h2>Comece a sua <em>estadia.</em></h2><p>Diga-nos as datas pretendidas. Confirmamos a disponibilidade e enviamos uma proposta final em menos de 24 horas.</p><div className="booking-intro__image"><img src="/images/pool4.jpg" alt="Exterior da Villa Valverde" /></div></div><BookingForm config={config} /></div></section>

      <section id="localizacao" className="section section--location"><div className="container location-grid"><div><p className="eyebrow">Localização</p><h2>Vilamoura, o destino <em>perfeito.</em></h2><p>A villa fica numa zona residencial tranquila, com acesso fácil à marina, à praia e aos campos de golfe da região.</p></div><dl><div><dt>Marina de Vilamoura</dt><dd>4,8 km</dd></div><div><dt>Campos de golfe</dt><dd>5 min</dd></div><div><dt>Praia</dt><dd>5 min</dd></div><div><dt>Aeroporto de Faro</dt><dd>23 km</dd></div></dl></div></section>

      <section id="privacidade" className="privacy"><div className="container"><p className="eyebrow">Privacidade</p><h2>Os seus dados são tratados apenas para responder ao pedido de reserva.</h2><p>Nome, email, telefone, datas e mensagem são guardados com acesso exclusivo do gestor da Villa Valverde. Pode pedir informação, correção ou eliminação através de <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></div></section>

      <footer><div className="container footer-content"><div><a className="brand" href="#inicio">Villa <em>Valverde</em></a><p>Vilamoura · Algarve</p></div><div><a href={`mailto:${contactEmail}`}>Contactar reservas</a><a href={adminUrl}>Área de gestão</a></div><p>© {new Date().getFullYear()} Villa Valverde</p></div></footer>
    </main>
  );
}
