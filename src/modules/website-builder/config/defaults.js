const DEFAULT_THEME = {
  colors: {
    primary: '#1a1a1a',
    accent: '#c9a227',
    background: '#ffffff',
    text: '#1a1a1a',
    muted: '#5c5c5c'
  },
  fonts: {
    heading: 'Playfair Display',
    body: 'DM Sans'
  },
  radius: '12px',
  spacing: '1.5rem'
};

function defaultSettings(name) {
  return {
    businessName: name || '',
    tagline: '',
    phone: '',
    email: '',
    whatsapp: '',
    address: '',
    mapsUrl: '',
    openingHours: [],
    socials: { instagram: '', facebook: '', tripadvisor: '', google: '' },
    faviconMediaId: null,
    logoMediaId: null,
    ga4MeasurementId: '',
    cookieBanner: true,
    restaurant: { cuisine: '', priceRange: '', bookingUrl: '', menuSource: 'manual' },
    ristoword: { enabled: false, licenseLinked: false }
  };
}

module.exports = { DEFAULT_THEME, defaultSettings };
