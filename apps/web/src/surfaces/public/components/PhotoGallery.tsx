import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/context';

type GalleryTab = 'exterior' | 'living' | 'bedrooms' | 'bathrooms' | 'plan';

const galleries: Record<GalleryTab, string[]> = {
  exterior: ['pool3', 'pool2', 'pool1', 'pool4', 'ext-entrance', 'ext-garden', 'ext-path'],
  living: ['living1', 'living2', 'kitchen', 'living3', 'living-pool'],
  bedrooms: ['bed-suite', 'bed2', 'bed3', 'bed4'],
  bathrooms: ['bath1', 'bath-wc', 'bath3', 'bath4'],
  plan: ['floor-plan']
};

// Fotos verticais recortadas em espaços horizontais: onde fica o foco do recorte.
const focus: Record<string, string> = { 'bed-suite': 'center 60%', 'bath-wc': 'center 45%', 'ext-entrance': 'center 55%', 'ext-garden': 'center 55%', 'ext-path': 'center 50%', 'living-pool': 'center 45%' };

// No telemóvel a barra de separadores desliza; centra o separador escolhido sem mexer na página.
function revealTab(button: HTMLButtonElement) {
  const bar = button.parentElement;
  if (!bar) return;
  bar.scrollTo({ left: button.offsetLeft - (bar.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' });
}

// A primeira foto ocupa duas colunas. Quando a última linha ficaria com um espaço
// vazio, a última foto também alarga: em 3 colunas (computador) ou em 2 (telemóvel).
function photoClass(index: number, total: number): string {
  const classes = ['gallery-photo'];
  if (index === 0) classes.push('gallery-photo--wide');
  if (index === total - 1 && index > 0) {
    if ((total + 1) % 3 === 2) classes.push('gallery-photo--fill-3');
    if (total % 2 === 0) classes.push('gallery-photo--fill-2');
  }
  return classes.join(' ');
}

export function PhotoGallery() {
  const { t } = useI18n();
  const labels = t.gallery.tabs;
  const [tab, setTab] = useState<GalleryTab>('exterior');
  const [activeIndex, setActiveIndex] = useState<number>();
  const touchStart = useRef<number | undefined>(undefined);
  const photos = galleries[tab];
  const activePhoto = activeIndex === undefined ? undefined : photos[activeIndex];

  const close = useCallback(() => setActiveIndex(undefined), []);
  const step = useCallback((delta: number) => {
    setActiveIndex((current) => current === undefined ? current : (current + delta + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (activeIndex === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, close, step]);

  return (
    <>
      <div className="gallery-tabs" role="tablist" aria-label={t.gallery.tabsLabel}>
        {(Object.keys(galleries) as GalleryTab[]).map((key) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={(event) => { setTab(key); revealTab(event.currentTarget); }}>
            {labels[key]}
          </button>
        ))}
      </div>
      {tab === 'plan' ? (
        // A planta mostra-se inteira: recortada para a grelha perderia a leitura da casa.
        <figure className="gallery-plan">
          <button onClick={() => setActiveIndex(0)} aria-label={t.gallery.openPhoto(labels.plan)}>
            <img src="/images/floor-plan.jpg" alt={t.gallery.planAlt} loading="lazy" />
          </button>
          <figcaption>{t.gallery.planNote}</figcaption>
        </figure>
      ) : <div className="gallery-grid">
        {photos.map((photo, index) => (
          <button key={photo} className={photoClass(index, photos.length)} onClick={() => setActiveIndex(index)} aria-label={t.gallery.openPhoto(labels[tab])}>
            <img src={`/images/${photo}.jpg`} alt="Villa Valverde" loading="lazy" style={focus[photo] ? { objectPosition: focus[photo] } : undefined} />
          </button>
        ))}
      </div>}
      {activePhoto && activeIndex !== undefined && (
        <div
          className="lightbox" role="dialog" aria-modal="true" aria-label={t.gallery.enlarged} onClick={close}
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = undefined;
            if (start === undefined || end === undefined || Math.abs(end - start) < 45) return;
            step(end < start ? 1 : -1);
          }}
        >
          <button className="lightbox__close" onClick={close} aria-label={t.gallery.closePhoto}>×</button>
          {photos.length > 1 && <>
            <button className="lightbox__nav lightbox__nav--prev" onClick={(event) => { event.stopPropagation(); step(-1); }} aria-label={t.gallery.previousPhoto}><ChevronLeft size={30} /></button>
            <button className="lightbox__nav lightbox__nav--next" onClick={(event) => { event.stopPropagation(); step(1); }} aria-label={t.gallery.nextPhoto}><ChevronRight size={30} /></button>
            <p className="lightbox__count" aria-live="polite">{activeIndex + 1} / {photos.length}</p>
          </>}
          <img src={`/images/${activePhoto}.jpg`} alt="Villa Valverde" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
