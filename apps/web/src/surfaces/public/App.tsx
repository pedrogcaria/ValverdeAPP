import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ArrowDown, BedDouble, Car, ChefHat, Coffee, Menu, ParkingCircle, ShieldCheck, Sparkles, TreePine, Wifi, X } from 'lucide-react';
import { getPublicBookingConfig } from './lib/api';
import { currency, monthYear } from './lib/format';
import type { PublicBookingConfig } from './lib/types';
import { BookingForm } from './components/BookingForm';
import { PhotoGallery } from './components/PhotoGallery';
import { I18nProvider, useI18n } from './i18n/context';
import { htmlLang, locales, pathForLocale, type Locale } from './i18n/locale';
import { adminSurfaceUrl } from '../../lib/surface';
import './styles/index.css';

const heroPhotos = ['pool3', 'pool1', 'pool4', 'pool2'];

const amenities = [
  [Sparkles, 'pool'], [TreePine, 'garden'], [ChefHat, 'kitchen'],
  [Wifi, 'wifi'], [ParkingCircle, 'parking'], [Coffee, 'coffee'],
  [BedDouble, 'suites'], [Car, 'marina']
] as const;

function LanguageSwitch({ onSelect }: { onSelect: () => void }) {
  const { locale, setLocale, t } = useI18n();
  const choose = (event: MouseEvent<HTMLAnchorElement>, next: Locale) => {
    event.preventDefault();
    setLocale(next);
    onSelect();
  };

  return (
    <div className="lang-switch" role="group" aria-label={t.nav.language}>
      {locales.map((option) => (
        <a key={option} href={pathForLocale(option)} hrefLang={htmlLang(option)} lang={htmlLang(option)} aria-current={option === locale ? 'true' : undefined} className={option === locale ? 'is-active' : ''} onClick={(event) => choose(event, option)}>
          {option.toUpperCase()}
        </a>
      ))}
    </div>
  );
}

function Site() {
  const { t, intl } = useI18n();
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
  const minimumNights = config?.settings.minimumNights ?? 7;
  const closeMenu = () => setNavOpen(false);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label={t.nav.home}>Villa <em>Valverde</em></a>
        <button className="menu-toggle" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen} aria-label={navOpen ? t.nav.closeMenu : t.nav.openMenu}>{navOpen ? <X /> : <Menu />}</button>
        <nav className={navOpen ? 'is-open' : ''}>
          <a onClick={closeMenu} href="#villa">{t.nav.villa}</a><a onClick={closeMenu} href="#galeria">{t.nav.gallery}</a><a onClick={closeMenu} href="#precos">{t.nav.prices}</a><a onClick={closeMenu} href="#pedido">{t.nav.book}</a><a onClick={closeMenu} href="#localizacao">{t.nav.location}</a>
          <LanguageSwitch onSelect={closeMenu} />
        </nav>
      </header>

      <section id="inicio" className="hero" aria-label={t.hero.label}>
        <div className="hero__media" aria-hidden="true">{heroPhotos.map((photo, index) => <img key={photo} src={`/images/${photo}.jpg`} className={index === activeHero ? 'is-active' : ''} alt="" />)}</div>
        <div className="hero__veil" />
        <div className="hero__content">
          <p className="hero__kicker">{t.hero.kicker}</p>
          <p className="brand brand--hero">Villa <em>Valverde</em></p>
          <h1>{t.hero.titleStart} <em>{t.hero.titleEmphasis}</em></h1>
          <p className="hero__summary">{t.hero.summary}</p>
          <div className="hero__actions"><a className="button button--primary" href="#pedido">{t.hero.primaryAction}</a><a className="button button--ghost" href="#galeria">{t.hero.secondaryAction}</a></div>
        </div>
        <a className="hero__scroll" href="#villa" aria-label={t.hero.scroll}><ArrowDown size={18} /></a>
      </section>

      <section className="facts" aria-label={t.facts.label}><div><strong>4</strong><span>{t.facts.suites}</span></div><div><strong>5</strong><span>{t.facts.bathrooms}</span></div><div><strong>9</strong><span>{t.facts.guests}</span></div><div><strong>{minimumNights}</strong><span>{t.facts.minimumNights}</span></div></section>

      <section id="villa" className="section section--villa"><div className="container villa-grid"><div className="villa-photos"><img src="/images/pool1.jpg" alt={t.villa.poolAlt} /><img src="/images/living1.jpg" alt={t.villa.interiorAlt} /></div><div className="section-copy"><p className="eyebrow">{t.villa.eyebrow}</p><h2>{t.villa.titleStart} <em>{t.villa.titleEmphasis}</em></h2><p>{t.villa.paragraph1}</p><p>{t.villa.paragraph2}</p><a className="text-link" href="#pedido">{t.villa.cta} <span>→</span></a></div></div></section>

      <section id="galeria" className="section section--sand"><div className="container"><div className="section-heading"><p className="eyebrow">{t.gallery.eyebrow}</p><h2>{t.gallery.titleStart} <em>{t.gallery.titleEmphasis}</em></h2></div><PhotoGallery /></div></section>

      <section className="section section--dark"><div className="container"><div className="section-heading section-heading--center"><p className="eyebrow">{t.amenities.eyebrow}</p><h2>{t.amenities.titleStart} <em>{t.amenities.titleEmphasis}</em></h2></div><div className="amenities-grid">{amenities.map(([Icon, key]) => <div key={key}><Icon size={18} /><span>{t.amenities.items[key]}</span></div>)}</div></div></section>

      <section id="precos" className="section section--pricing"><div className="container"><div className="section-heading"><p className="eyebrow">{t.pricing.eyebrow}</p><h2>{t.pricing.titleStart} <em>{t.pricing.titleEmphasis}</em></h2><p>{t.pricing.intro}</p></div><div className="price-note"><ShieldCheck size={22} /><p><strong>{t.pricing.noteTitle}</strong><br />{t.pricing.noteBody}</p></div>{configError ? <p className="price-status">{t.pricing.unavailable}</p> : <div className="rates-grid">{monthlyRates.map((rate) => <article key={`${rate.startsOn}-${rate.endsOn}`}><p>{monthYear(rate.startsOn, intl)}</p><strong>{currency(rate.directNightlyPrice, config?.settings.currency, intl)}</strong><small>{t.pricing.perNight}</small></article>)}</div>}<p className="price-footnote">{t.pricing.footnote(minimumNights)}</p></div></section>

      <section id="pedido" className="section section--booking"><div className="container booking-layout"><div className="booking-intro"><p className="eyebrow">{t.booking.eyebrow}</p><h2>{t.booking.titleStart} <em>{t.booking.titleEmphasis}</em></h2><p>{t.booking.intro}</p><div className="booking-intro__image"><img src="/images/pool4.jpg" alt={t.booking.imageAlt} /></div></div><BookingForm config={config} /></div></section>

      <section id="localizacao" className="section section--location"><div className="container location-grid"><div><p className="eyebrow">{t.location.eyebrow}</p><h2>{t.location.titleStart} <em>{t.location.titleEmphasis}</em></h2><p>{t.location.body}</p></div><dl><div><dt>{t.location.marina}</dt><dd>{new Intl.NumberFormat(intl).format(4.8)} km</dd></div><div><dt>{t.location.golf}</dt><dd>5 min</dd></div><div><dt>{t.location.beach}</dt><dd>5 min</dd></div><div><dt>{t.location.airport}</dt><dd>23 km</dd></div></dl></div></section>

      <section id="privacidade" className="privacy"><div className="container"><p className="eyebrow">{t.privacy.eyebrow}</p><h2>{t.privacy.title}</h2><p>{t.privacy.bodyStart} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>{t.privacy.bodyEnd}</p></div></section>

      <footer><div className="container footer-content"><div><a className="brand" href="#inicio">Villa <em>Valverde</em></a><p>Vilamoura · Algarve</p></div><div><a href={`mailto:${contactEmail}`}>{t.footer.contact}</a><a href={adminUrl}>{t.footer.admin}</a></div><p>© {new Date().getFullYear()} Villa Valverde</p></div></footer>
    </main>
  );
}

export default function App() {
  return <I18nProvider><Site /></I18nProvider>;
}
