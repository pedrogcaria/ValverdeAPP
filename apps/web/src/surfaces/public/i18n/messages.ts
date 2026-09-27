import type { Locale } from './locale';

const en = {
  meta: {
    title: 'Villa Valverde — Vilamoura, Algarve',
    description: 'Villa Valverde in Vilamoura. Book your Algarve stay directly with the owners.'
  },
  nav: {
    home: 'Villa Valverde — home',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    villa: 'The villa',
    gallery: 'Gallery',
    prices: 'Prices',
    book: 'Book',
    location: 'Location',
    language: 'Language'
  },
  hero: {
    label: 'Villa Valverde in Vilamoura',
    kicker: 'Vilamoura · Algarve · Direct booking',
    titleStart: 'A retreat where',
    titleEmphasis: 'time slows down.',
    summary: 'Four suites, a private pool and the calm of the pine trees — just minutes from the marina and the Algarve beaches.',
    primaryAction: 'Check availability',
    secondaryAction: 'Explore the villa',
    scroll: 'Scroll to the introduction'
  },
  facts: {
    label: 'Key features',
    suites: 'Suites',
    bathrooms: 'Bathrooms',
    guests: 'Max. guests',
    minimumNights: 'Minimum nights'
  },
  villa: {
    eyebrow: 'Our villa',
    titleStart: 'Elegance, nature and',
    titleEmphasis: 'complete peace.',
    paragraph1: 'Set in Vilamoura, in the heart of the Algarve, Villa Valverde is a contemporary luxury retreat surrounded by century-old pine trees.',
    paragraph2: 'With a private pool, garden, Siemens gourmet kitchen and four elegant suites, it was designed for long days with family or friends.',
    poolAlt: 'Private pool at Villa Valverde',
    interiorAlt: 'Interior of Villa Valverde',
    cta: 'Plan your stay'
  },
  gallery: {
    eyebrow: 'Gallery',
    titleStart: 'Discover every',
    titleEmphasis: 'space.',
    tabsLabel: 'Villa gallery',
    tabs: { exterior: 'Exterior & pool', living: 'Living room & kitchen', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms' },
    openPhoto: (section: string) => `Open photo: ${section}`,
    enlarged: 'Enlarged photo',
    closePhoto: 'Close photo'
  },
  amenities: {
    eyebrow: 'Amenities',
    titleStart: 'Everything you need to',
    titleEmphasis: 'unwind.',
    items: {
      pool: 'Private outdoor pool',
      garden: 'Garden and terrace',
      kitchen: 'Siemens kitchen',
      wifi: 'Fibre Wi-Fi',
      parking: 'Private parking',
      coffee: 'Coffee machine',
      suites: '4 elegant suites',
      marina: '5 min from the marina'
    }
  },
  pricing: {
    eyebrow: 'Nightly rates',
    titleStart: 'Book direct and',
    titleEmphasis: 'save.',
    intro: 'Transparent pricing with no hidden fees. The final offer is always confirmed by our team.',
    noteTitle: 'Direct booking, best price guaranteed.',
    noteBody: 'Rates are kept up to date by the villa management and already include the direct booking advantage.',
    unavailable: 'Prices will be available soon.',
    perNight: 'per night · direct booking',
    footnote: (nights: number) => `* Minimum stay: ${nights} nights. For up to 9 guests.`
  },
  booking: {
    eyebrow: 'Booking request',
    titleStart: 'Start your',
    titleEmphasis: 'stay.',
    intro: 'Tell us your preferred dates. We will confirm availability and send you a final offer within 24 hours.',
    imageAlt: 'Exterior of Villa Valverde'
  },
  form: {
    fullName: 'Full name *',
    fullNamePlaceholder: 'Full name',
    email: 'Email *',
    emailPlaceholder: 'name@email.com',
    phone: 'Phone *',
    phonePlaceholder: '+44 7700 900000',
    guests: 'Number of guests *',
    select: 'Select',
    checkIn: 'Check-in *',
    checkOut: 'Check-out *',
    heatedPool: 'Heated pool',
    heatedPoolPrice: (price: string) => `${price} per week`,
    heatedPoolExtra: 'Available as an extra',
    promoCode: 'Discount code',
    promoPlaceholder: 'If you have one',
    message: 'Message',
    messagePlaceholder: 'Questions or special requests',
    nights: (nights: number) => `${nights} ${nights === 1 ? 'night' : 'nights'}`,
    directSaving: 'Direct booking advantage',
    promoDiscount: (percent: number) => `${percent}% discount`,
    estimatedTotal: 'Estimated total',
    privacyStart: 'I have read and accept the',
    privacyLink: 'privacy policy',
    submitting: 'Sending...',
    submit: 'Send request',
    footnote: 'The amount is an estimate and the booking is only confirmed once the manager contacts you.',
    successEyebrow: 'Request received',
    successTitle: 'Thank you for choosing us.',
    successBody: 'We will confirm availability and send you a final offer within 24 hours.',
    sendAnother: 'Send another request',
    errors: {
      quote: 'We could not calculate the offer.',
      invalidDates: 'Choose valid dates to calculate the offer.',
      privacy: 'You need to accept the privacy policy.',
      turnstile: 'Complete the security check before sending.',
      submit: 'We could not send your request.'
    }
  },
  turnstile: {
    pending: 'The security check will be enabled before launch.',
    expired: 'The check has expired. Please confirm again before sending.',
    failed: 'The security check could not be completed.',
    unavailable: 'Turnstile is unavailable.',
    loadFailed: 'The security check could not be loaded.'
  },
  location: {
    eyebrow: 'Location',
    titleStart: 'Vilamoura, the',
    titleEmphasis: 'perfect destination.',
    body: 'The villa sits in a quiet residential area with easy access to the marina, the beach and the region’s golf courses.',
    marina: 'Vilamoura Marina',
    golf: 'Golf courses',
    beach: 'Beach',
    airport: 'Faro Airport'
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Your data is used only to respond to your booking request.',
    bodyStart: 'Name, email, phone, dates and message are stored with access restricted to the Villa Valverde manager. You can request information, correction or deletion at',
    bodyEnd: '.'
  },
  footer: {
    contact: 'Contact reservations',
    admin: 'Management area'
  },
  loading: 'Loading…'
};

export type Messages = typeof en;

const pt: Messages = {
  meta: {
    title: 'Villa Valverde — Vilamoura, Algarve',
    description: 'Villa Valverde em Vilamoura. Reserve diretamente a sua estadia no Algarve.'
  },
  nav: {
    home: 'Villa Valverde — início',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    villa: 'A villa',
    gallery: 'Galeria',
    prices: 'Preços',
    book: 'Reservar',
    location: 'Localização',
    language: 'Idioma'
  },
  hero: {
    label: 'Villa Valverde em Vilamoura',
    kicker: 'Vilamoura · Algarve · Reserva direta',
    titleStart: 'Um refúgio onde o',
    titleEmphasis: 'tempo abranda.',
    summary: 'Quatro suites, piscina privada e a tranquilidade dos pinheiros — a poucos minutos da marina e das praias do Algarve.',
    primaryAction: 'Pedir disponibilidade',
    secondaryAction: 'Conhecer a villa',
    scroll: 'Descer até à apresentação'
  },
  facts: {
    label: 'Principais características',
    suites: 'Suites',
    bathrooms: 'Casas de banho',
    guests: 'Hóspedes máx.',
    minimumNights: 'Noites mínimas'
  },
  villa: {
    eyebrow: 'A nossa villa',
    titleStart: 'Requinte, natureza e',
    titleEmphasis: 'paz absoluta.',
    paragraph1: 'Situada em Vilamoura, no coração do Algarve, a Villa Valverde é um refúgio contemporâneo de luxo rodeado de pinheiros centenários.',
    paragraph2: 'Com piscina privada, jardim, cozinha gourmet Siemens e quatro suites elegantes, foi pensada para dias longos em família ou entre amigos.',
    poolAlt: 'Piscina privada da Villa Valverde',
    interiorAlt: 'Interior da Villa Valverde',
    cta: 'Planear a estadia'
  },
  gallery: {
    eyebrow: 'Galeria',
    titleStart: 'Descubra cada',
    titleEmphasis: 'espaço.',
    tabsLabel: 'Galeria da villa',
    tabs: { exterior: 'Exterior & piscina', living: 'Sala & cozinha', bedrooms: 'Quartos', bathrooms: 'Casas de banho' },
    openPhoto: (section) => `Abrir fotografia: ${section}`,
    enlarged: 'Fotografia ampliada',
    closePhoto: 'Fechar fotografia'
  },
  amenities: {
    eyebrow: 'Comodidades',
    titleStart: 'Tudo o que precisa para',
    titleEmphasis: 'desligar.',
    items: {
      pool: 'Piscina exterior privada',
      garden: 'Jardim e terraço',
      kitchen: 'Cozinha Siemens',
      wifi: 'Wi-Fi de fibra',
      parking: 'Estacionamento privado',
      coffee: 'Máquina de café',
      suites: '4 suites elegantes',
      marina: 'A 5 min da marina'
    }
  },
  pricing: {
    eyebrow: 'Preços por noite',
    titleStart: 'Reserve diretamente e',
    titleEmphasis: 'poupe.',
    intro: 'Preço transparente, sem comissões ocultas. A proposta final é sempre confirmada pela nossa equipa.',
    noteTitle: 'Reserva direta, melhor preço garantido.',
    noteBody: 'Os valores são atualizados pela gestão da villa e já refletem a vantagem da reserva direta.',
    unavailable: 'Os preços serão disponibilizados em breve.',
    perNight: 'por noite · reserva direta',
    footnote: (nights) => `* Estadia mínima: ${nights} noites. Para até 9 hóspedes.`
  },
  booking: {
    eyebrow: 'Pedido de reserva',
    titleStart: 'Comece a sua',
    titleEmphasis: 'estadia.',
    intro: 'Diga-nos as datas pretendidas. Confirmamos a disponibilidade e enviamos uma proposta final em menos de 24 horas.',
    imageAlt: 'Exterior da Villa Valverde'
  },
  form: {
    fullName: 'Nome completo *',
    fullNamePlaceholder: 'Nome completo',
    email: 'Email *',
    emailPlaceholder: 'nome@email.com',
    phone: 'Telefone *',
    phonePlaceholder: '+351 9xx xxx xxx',
    guests: 'Número de hóspedes *',
    select: 'Selecionar',
    checkIn: 'Check-in *',
    checkOut: 'Check-out *',
    heatedPool: 'Piscina aquecida',
    heatedPoolPrice: (price) => `${price} por semana`,
    heatedPoolExtra: 'Disponível como extra',
    promoCode: 'Código de desconto',
    promoPlaceholder: 'Se tiver um código',
    message: 'Mensagem',
    messagePlaceholder: 'Questões ou pedidos especiais',
    nights: (nights) => `${nights} ${nights === 1 ? 'noite' : 'noites'}`,
    directSaving: 'Vantagem reserva direta',
    promoDiscount: (percent) => `Desconto ${percent}%`,
    estimatedTotal: 'Total estimado',
    privacyStart: 'Li e aceito a',
    privacyLink: 'política de privacidade',
    submitting: 'A enviar...',
    submit: 'Enviar pedido',
    footnote: 'O valor é estimado e a reserva só é confirmada após contacto do gestor.',
    successEyebrow: 'Pedido recebido',
    successTitle: 'Obrigado pela preferência.',
    successBody: 'Vamos confirmar a disponibilidade e enviar-lhe uma proposta final em menos de 24 horas.',
    sendAnother: 'Enviar outro pedido',
    errors: {
      quote: 'Não foi possível calcular a proposta.',
      invalidDates: 'Escolha datas válidas para calcular a proposta.',
      privacy: 'É necessário aceitar a política de privacidade.',
      turnstile: 'Conclua a verificação de segurança antes de enviar.',
      submit: 'Não foi possível enviar o pedido.'
    }
  },
  turnstile: {
    pending: 'A verificação de segurança será ativada antes da publicação.',
    expired: 'A verificação expirou. Confirme novamente antes de enviar.',
    failed: 'Não foi possível concluir a verificação.',
    unavailable: 'Turnstile indisponível.',
    loadFailed: 'Não foi possível carregar a proteção de segurança.'
  },
  location: {
    eyebrow: 'Localização',
    titleStart: 'Vilamoura, o destino',
    titleEmphasis: 'perfeito.',
    body: 'A villa fica numa zona residencial tranquila, com acesso fácil à marina, à praia e aos campos de golfe da região.',
    marina: 'Marina de Vilamoura',
    golf: 'Campos de golfe',
    beach: 'Praia',
    airport: 'Aeroporto de Faro'
  },
  privacy: {
    eyebrow: 'Privacidade',
    title: 'Os seus dados são tratados apenas para responder ao pedido de reserva.',
    bodyStart: 'Nome, email, telefone, datas e mensagem são guardados com acesso exclusivo do gestor da Villa Valverde. Pode pedir informação, correção ou eliminação através de',
    bodyEnd: '.'
  },
  footer: {
    contact: 'Contactar reservas',
    admin: 'Área de gestão'
  },
  loading: 'A carregar…'
};

export const messages: Record<Locale, Messages> = { en, pt };
