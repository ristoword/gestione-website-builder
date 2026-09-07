/**
 * Section registry — new section types are plugins here, without touching editor core.
 * JSON Schema files in ../schemas/*.schema.json are the source of truth (AJV).
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');

const SECTION_TYPES = [
  'hero',
  'header',
  'footer',
  'about',
  'services',
  'features',
  'gallery',
  'testimonials',
  'pricing',
  'contact',
  'faq',
  'cta',
  'team',
  'map',
  'events',
  'blog',
  'menu',
  'booking'
];

const DEFAULT_DESIGN = {
  backgroundColor: '',
  textColor: '',
  accentColor: '',
  fontFamily: '',
  fontSize: '',
  borderRadius: '',
  borderColor: '',
  borderWidth: '',
  backgroundImageMediaId: null,
  overlayOpacity: 0
};

const DEFAULT_LAYOUT = {
  columns: 1,
  gap: '1.5rem',
  alignment: 'center',
  maxWidth: '1120px',
  order: 0,
  padding: '4rem 1.5rem',
  margin: '0'
};

const DEFAULT_SETTINGS = {
  visibleDesktop: true,
  visibleTablet: true,
  visibleMobile: true,
  anchorId: '',
  animation: '',
  seoSnippet: '',
  integration: null
};

function emptyI18n(it = '') {
  return { it };
}

const DEFAULT_CONTENT = {
  hero: {
    heading: emptyI18n('Benvenuti'),
    subheading: emptyI18n(''),
    cta: { label: emptyI18n('Scopri di più'), href: '#contact' },
    mediaId: null
  },
  header: {
    logoMediaId: null,
    siteName: emptyI18n(''),
    sticky: true,
    cta: { label: emptyI18n('Prenota'), href: '#booking' }
  },
  footer: {
    copyright: emptyI18n(''),
    columns: []
  },
  about: {
    heading: emptyI18n('Chi siamo'),
    body: emptyI18n(''),
    mediaId: null
  },
  services: {
    heading: emptyI18n('Servizi'),
    items: []
  },
  features: {
    heading: emptyI18n('Perché sceglierci'),
    items: []
  },
  gallery: {
    heading: emptyI18n('Galleria'),
    mediaIds: []
  },
  testimonials: {
    heading: emptyI18n('Dicono di noi'),
    items: []
  },
  pricing: {
    heading: emptyI18n('Prezzi'),
    items: []
  },
  contact: {
    heading: emptyI18n('Contatti'),
    email: '',
    phone: '',
    address: emptyI18n(''),
    formId: null
  },
  faq: {
    heading: emptyI18n('FAQ'),
    items: []
  },
  cta: {
    heading: emptyI18n('Iniziamo'),
    body: emptyI18n(''),
    cta: { label: emptyI18n('Contattaci'), href: '#contact' }
  },
  team: {
    heading: emptyI18n('Il team'),
    members: []
  },
  map: {
    heading: emptyI18n('Dove siamo'),
    lat: 0,
    lng: 0,
    zoom: 14,
    embedUrl: ''
  },
  events: {
    heading: emptyI18n('Eventi'),
    source: 'manual',
    items: []
  },
  blog: {
    heading: emptyI18n('Blog'),
    source: 'manual',
    layout: 'grid'
  },
  menu: {
    heading: emptyI18n('Menu'),
    source: 'manual',
    groups: []
  },
  booking: {
    heading: emptyI18n('Prenota'),
    source: 'manual',
    provider: '',
    embedUrl: '',
    cta: { label: emptyI18n('Prenota ora'), href: '#booking' }
  }
};

let ajvInstance = null;
const validators = new Map();
const schemasByType = new Map();

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getAjv() {
  if (ajvInstance) return ajvInstance;
  ajvInstance = new Ajv2020({ allErrors: true, strict: false });
  const common = loadJson(path.join(SCHEMAS_DIR, 'common.schema.json'));
  ajvInstance.addSchema(common);
  for (const type of SECTION_TYPES) {
    const schema = loadJson(path.join(SCHEMAS_DIR, `${type}.schema.json`));
    schemasByType.set(type, schema);
    ajvInstance.addSchema(schema);
    validators.set(type, ajvInstance.compile(schema));
  }
  return ajvInstance;
}

function listSectionTypes() {
  return SECTION_TYPES.slice();
}

function getSectionMeta(type) {
  getAjv();
  return {
    type,
    hasSchema: schemasByType.has(type),
    defaultContent: DEFAULT_CONTENT[type] || {}
  };
}

function defaultSection(type, id) {
  if (!SECTION_TYPES.includes(type)) {
    throw new Error(`Tipo di sezione sconosciuto: ${type}`);
  }
  return {
    id,
    type,
    version: 1,
    content: JSON.parse(JSON.stringify(DEFAULT_CONTENT[type])),
    design: { ...DEFAULT_DESIGN },
    layout: { ...DEFAULT_LAYOUT },
    settings: { ...DEFAULT_SETTINGS }
  };
}

function validateSection(section) {
  getAjv();
  if (!section || !section.type) {
    return { valid: false, errors: [{ message: 'Tipo di sezione obbligatorio' }] };
  }
  const validate = validators.get(section.type);
  if (!validate) {
    return { valid: false, errors: [{ message: `Tipo di sezione sconosciuto: ${section.type}` }] };
  }
  const valid = validate(section);
  return { valid, errors: valid ? [] : validate.errors || [] };
}

module.exports = {
  SECTION_TYPES,
  listSectionTypes,
  getSectionMeta,
  defaultSection,
  validateSection,
  getAjv
};
