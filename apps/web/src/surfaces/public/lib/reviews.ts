import type { Locale } from '../i18n/locale';

// Excertos de comentários reais de hóspedes no Booking.com (extranet, novembro de 2026).
// `original` é a língua em que o hóspede escreveu; as outras versões são traduções.
export type GuestReview = {
  name: string;
  country: Record<Locale, string>;
  stayedOn: string;
  score: number;
  original: 'en' | 'fr' | 'nl';
  text: Record<Locale, string>;
};

// Resumo da pontuação: hóspedes com 9 ou mais, sobre o total de comentários.
export const reviewSummary = { superb: 10, total: 11 };

export const guestReviews: GuestReview[] = [
  {
    name: 'Rob',
    country: { en: 'United Kingdom', pt: 'Reino Unido' },
    stayedOn: '2026-08-01',
    score: 9,
    original: 'en',
    text: {
      en: 'It exceeded all our expectations. The villa was spotlessly clean, exceptionally well equipped, and provided everything we needed for a comfortable and relaxing stay. Pedro was an excellent host throughout our stay.',
      pt: 'Superou todas as nossas expectativas. A villa estava impecavelmente limpa, excecionalmente bem equipada e tinha tudo o que precisávamos para uma estadia confortável e relaxante. O Pedro foi um anfitrião excelente durante toda a estadia.'
    }
  },
  {
    name: 'Laurent',
    country: { en: 'France', pt: 'França' },
    stayedOn: '2026-08-01',
    score: 9,
    original: 'fr',
    text: {
      en: 'The house is wonderful: 4 bedrooms, each with its own bathroom, and a huge living, dining and kitchen space that is lovely to share as a group. The host is attentive and very responsive, throughout the stay.',
      pt: 'A casa é formidável: 4 quartos, cada um com a sua casa de banho, e um enorme espaço de sala, sala de jantar e cozinha, muito agradável para viver em grupo. O anfitrião é atencioso e muito rápido a responder, durante toda a estadia.'
    }
  },
  {
    name: 'Rees',
    country: { en: 'United Kingdom', pt: 'Reino Unido' },
    stayedOn: '2025-09-01',
    score: 10,
    original: 'en',
    text: {
      en: 'This villa was superb! It had the most comfy beds and pillows, very clean, we were a family of 6 and the attention to detail was second to none. Pool was lovely and clean and a good temperature!',
      pt: 'Esta villa foi soberba! Tinha as camas e almofadas mais confortáveis, muito limpa; éramos uma família de 6 e a atenção ao detalhe foi inigualável. A piscina estava ótima, limpa e a uma boa temperatura!'
    }
  },
  {
    name: 'Russell',
    country: { en: 'United Kingdom', pt: 'Reino Unido' },
    stayedOn: '2025-08-01',
    score: 10,
    original: 'en',
    text: {
      en: 'Stunning villa in the peace and quiet yet only a 10 min Uber ride (who arrive in 5 mins!) to the action of Vilamoura. The place felt massive for all of us and Pedro the host was brilliant.',
      pt: 'Villa deslumbrante, em paz e sossego, e a apenas 10 minutos de Uber (que chega em 5 minutos!) da animação de Vilamoura. A casa pareceu enorme para todos nós e o Pedro, o anfitrião, foi brilhante.'
    }
  },
  {
    name: 'Harald',
    country: { en: 'Netherlands', pt: 'Países Baixos' },
    stayedOn: '2025-10-01',
    score: 10,
    original: 'nl',
    text: {
      en: 'A wonderfully comfortable house in a quiet base! Loved the spacious layout.',
      pt: 'Uma casa maravilhosamente confortável, numa base tranquila! Gostámos do espaço amplo.'
    }
  },
  {
    name: 'Louise',
    country: { en: 'United Kingdom', pt: 'Reino Unido' },
    stayedOn: '2024-06-01',
    score: 10,
    original: 'en',
    text: {
      en: 'Great family villa with lots of living space. The perfect home away from home — well equipped with everything you need and super clean. Pedro is an excellent host.',
      pt: 'Ótima villa para famílias, com muito espaço. A casa perfeita longe de casa — bem equipada com tudo o que é preciso e super limpa. O Pedro é um anfitrião excelente.'
    }
  }
];
