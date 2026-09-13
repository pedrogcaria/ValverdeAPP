import { useState } from 'react';

type GalleryTab = 'exterior' | 'living' | 'bedrooms' | 'bathrooms';

const galleries: Record<GalleryTab, string[]> = {
  exterior: ['pool3', 'pool2', 'pool1', 'pool4'],
  living: ['living1', 'living2', 'kitchen', 'living3'],
  bedrooms: ['bed1', 'bed2', 'bed3', 'bed4', 'twin'],
  bathrooms: ['bath1', 'bath2', 'bath3', 'bath4']
};

const labels: Record<GalleryTab, string> = {
  exterior: 'Exterior & piscina',
  living: 'Sala & cozinha',
  bedrooms: 'Quartos',
  bathrooms: 'Casas de banho'
};

export function PhotoGallery() {
  const [tab, setTab] = useState<GalleryTab>('exterior');
  const [activePhoto, setActivePhoto] = useState<string>();

  return (
    <>
      <div className="gallery-tabs" role="tablist" aria-label="Galeria da villa">
        {(Object.keys(labels) as GalleryTab[]).map((key) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {labels[key]}
          </button>
        ))}
      </div>
      <div className="gallery-grid">
        {galleries[tab].map((photo, index) => (
          <button key={photo} className={`gallery-photo ${index === 0 ? 'gallery-photo--wide' : ''}`} onClick={() => setActivePhoto(photo)} aria-label={`Abrir fotografia: ${labels[tab]}`}>
            <img src={`/images/${photo}.jpg`} alt="Villa Valverde" loading="lazy" />
          </button>
        ))}
      </div>
      {activePhoto && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fotografia ampliada" onClick={() => setActivePhoto(undefined)}>
          <button className="lightbox__close" onClick={() => setActivePhoto(undefined)} aria-label="Fechar fotografia">×</button>
          <img src={`/images/${activePhoto}.jpg`} alt="Villa Valverde" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
