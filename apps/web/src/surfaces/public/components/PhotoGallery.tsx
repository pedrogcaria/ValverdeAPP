import { useState } from 'react';
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

export function PhotoGallery() {
  const { t } = useI18n();
  const labels = t.gallery.tabs;
  const [tab, setTab] = useState<GalleryTab>('exterior');
  const [activePhoto, setActivePhoto] = useState<string>();

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
          <button onClick={() => setActivePhoto('floor-plan')} aria-label={t.gallery.openPhoto(labels.plan)}>
            <img src="/images/floor-plan.jpg" alt={t.gallery.planAlt} loading="lazy" />
          </button>
          <figcaption>{t.gallery.planNote}</figcaption>
        </figure>
      ) : <div className="gallery-grid">
        {galleries[tab].map((photo, index) => (
          <button key={photo} className={`gallery-photo ${index === 0 ? 'gallery-photo--wide' : ''}`} onClick={() => setActivePhoto(photo)} aria-label={t.gallery.openPhoto(labels[tab])}>
            <img src={`/images/${photo}.jpg`} alt="Villa Valverde" loading="lazy" style={focus[photo] ? { objectPosition: focus[photo] } : undefined} />
          </button>
        ))}
      </div>}
      {activePhoto && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={t.gallery.enlarged} onClick={() => setActivePhoto(undefined)}>
          <button className="lightbox__close" onClick={() => setActivePhoto(undefined)} aria-label={t.gallery.closePhoto}>×</button>
          <img src={`/images/${activePhoto}.jpg`} alt="Villa Valverde" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
