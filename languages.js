/**
 * languages.js — the single registry of site languages.
 *
 * Everything that differs per language but is *data* lives here, so adding a
 * language means adding an entry (plus its translation files), not new code.
 *
 *   kind: 'markdown'   -> pages are built from sources/<source>/*.md (en, ur, ar)
 *         'dictionary' -> pages start from the English markdown and are localised
 *                         with the <code>-*.json dictionaries (de, tr, ru, ...)
 *   enabled: false     -> language is built nowhere (no pages, no picker entry,
 *                         no sitemap/precache entry) until it is complete.
 */

const LANGS = {
    en: {
        code: 'en', name: 'English', short: 'EN', dir: 'ltr', flag: 'gb',
        ogLocale: 'en_US', inLanguage: 'en-GB', kind: 'markdown', source: 'english',
        enabled: true,
    },
    de: {
        code: 'de', name: 'Deutsch', short: 'DE', dir: 'ltr', flag: 'de',
        ogLocale: 'de_DE', inLanguage: 'de', kind: 'dictionary', source: 'english',
        enabled: true,
    },
    tr: {
        code: 'tr', name: 'Türkçe', short: 'TR', dir: 'ltr', flag: 'tr',
        ogLocale: 'tr_TR', inLanguage: 'tr', kind: 'dictionary', source: 'english',
        enabled: true,
    },
    ru: {
        code: 'ru', name: 'Русский', short: 'RU', dir: 'ltr', flag: 'ru',
        ogLocale: 'ru_RU', inLanguage: 'ru', kind: 'dictionary', source: 'english',
        enabled: true,
    },
    ur: {
        code: 'ur', name: 'اردو', short: 'UR', dir: 'rtl', flag: 'pk',
        ogLocale: 'ur_PK', inLanguage: 'ur-PK', kind: 'markdown', source: 'urdu', searchField: 'ur',
        enabled: true,
        font: {
            family: 'Jameel Noori Nastaleeq',
            file: 'JameelNooriNastaleeq.woff2',
            rootSize: '130%',
            lineHeight: 2,
            menuSize: '1.05rem',
            comment: `    /* Optical size correction — Jameel Noori Nastaleeq renders visually smaller
       than Inter at equal CSS sizes (smaller cap-height relative to em square).
       Scaling the root font-size up proportionally compensates all rem-based sizes. */
`,
        },
    },
    ar: {
        code: 'ar', name: 'عربي', short: 'AR', dir: 'rtl', flag: 'sa',
        ogLocale: 'ar_SA', inLanguage: 'ar', kind: 'markdown', source: 'arabic', searchField: 'ar',
        enabled: true,
        font: {
            family: 'Indopak Nastaleeq',
            file: 'Indopak-nastaleeq-hanafi-normal-v4.2.2-with-waqf-lazmi.woff2',
            rootSize: '125%',
            lineHeight: 2,
            menuSize: '1.05rem',
            comment: '',
        },
    },
};

// Order of the entries in every page's language dropdown (and the sitemap).
const DROPDOWN_ORDER = ['en', 'de', 'tr', 'ru', 'ur', 'ar'];

// Order in which languages are built (and precached by the service worker).
const BUILD_ORDER = ['en', 'ur', 'ar', 'de', 'tr', 'ru'];

// Order of the <link rel="alternate" hreflang> tags in every page head.
const HREFLANG_ORDER = ['en', 'de', 'tr', 'ur', 'ar', 'ru'];

const isEnabled = c => LANGS[c] && LANGS[c].enabled;

/** Enabled languages in dropdown order. */
const enabledLangs = () => DROPDOWN_ORDER.filter(isEnabled);

/** Enabled languages in build order. */
const buildLangs = () => BUILD_ORDER.filter(isEnabled);

/** Enabled languages in hreflang order. */
const hreflangLangs = () => HREFLANG_ORDER.filter(isEnabled);

module.exports = { LANGS, DROPDOWN_ORDER, BUILD_ORDER, HREFLANG_ORDER, enabledLangs, buildLangs, hreflangLangs };
