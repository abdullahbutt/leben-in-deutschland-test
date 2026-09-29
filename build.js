#!/usr/bin/env node
/**
 * build.js — converts markdown sources from English & Urdu branches into
 * a bilingual static site structured as:
 *
 *   /
 *   ├── index.html        (language picker — untouched by this script)
 *   ├── en/*.html
 *   ├── ur/*.html
 *   └── .nojekyll
 *
 * Usage:
 *   1. Clone the english branch into ./sources/english/
 *   2. Clone the urdu branch into ./sources/urdu/
 *   3. `npm install` then `node build.js`
 *
 * Re-run anytime the source .md files change.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { generateQuizData } = require('./generate-quiz');

const ROOT = __dirname;

// German explanations — loaded once at startup and injected during 'de' build pass
let DE_EXPLANATIONS = {};
try {
    DE_EXPLANATIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'de-explanations.json'), 'utf8'));
    console.log(`[de-explanations] loaded ${Object.keys(DE_EXPLANATIONS).length} entries`);
} catch(e) { /* file optional */ }

// Turkish explanations — injected during 'tr' build pass
let TR_EXPLANATIONS = {};
try {
    TR_EXPLANATIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tr-explanations.json'), 'utf8'));
    console.log(`[tr-explanations] loaded ${Object.keys(TR_EXPLANATIONS).length} entries`);
} catch(e) { /* file optional */ }

// Turkish question + answer translations — for bilingual tables
let TR_QUESTIONS = {};
try {
    TR_QUESTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tr-questions.json'), 'utf8'));
    console.log(`[tr-questions] loaded ${Object.keys(TR_QUESTIONS).length} entries`);
} catch(e) { /* file optional */ }

// Russian explanations — injected during 'ru' build pass
let RU_EXPLANATIONS = {};
try {
    RU_EXPLANATIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'ru-explanations.json'), 'utf8'));
    console.log(`[ru-explanations] loaded ${Object.keys(RU_EXPLANATIONS).length} entries`);
} catch(e) { /* file optional */ }

// Russian question + answer translations — for bilingual tables
let RU_QUESTIONS = {};
try {
    RU_QUESTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'ru-questions.json'), 'utf8'));
    console.log(`[ru-questions] loaded ${Object.keys(RU_QUESTIONS).length} entries`);
} catch(e) { /* file optional */ }

// State-question explanations (DE/TR/RU) — keyed by [state_slug][qid][lang]
// because the same numeric id (301-310) means different content per state.
let STATE_EXPLANATIONS = {};
try {
    STATE_EXPLANATIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'state-explanations.json'), 'utf8'));
    const total = Object.values(STATE_EXPLANATIONS).reduce((sum, qs) => sum + Object.keys(qs).length, 0);
    console.log(`[state-explanations] loaded ${total} state-question entries`);
} catch(e) { /* file optional */ }

// State-question text + options (DE/TR/RU) — same [state_slug][qid][lang]
// keying as STATE_EXPLANATIONS, since ids 301-310 repeat across all 16 states
// with different content. Each entry is { q, opts: [4 strings] }.
let STATE_QUESTIONS = {};
try {
    STATE_QUESTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'state-questions.json'), 'utf8'));
    const total = Object.values(STATE_QUESTIONS).reduce((sum, qs) => sum + Object.keys(qs).length, 0);
    console.log(`[state-questions] loaded ${total} state-question translation entries`);
} catch(e) { /* file optional */ }

// State sub-heading labels ("Coat of Arms", "District", ... in the H3 after
// the question number) translated per language. Same 10 labels for every
// state, in question order 301-310.
const STATE_SUBHEADING_LABELS = {
    de: ['Wappen', 'Landkreis', 'Landtagswahlperiode', 'Wahlalter', 'Landesflagge',
         'Politische Bildung', 'Landeshauptstadt', 'Kartenlage', 'Regierungschef/in', 'Ministerien'],
    tr: ['Arma', 'İlçe', 'Eyalet Meclisi Dönemi', 'Seçmen Yaşı', 'Eyalet Bayrağı',
         'Siyasi Eğitim', 'Eyalet Başkenti', 'Harita Konumu', 'Hükümet Başkanı', 'Bakanlıklar'],
    ru: ['Герб', 'Округ', 'Срок полномочий ландтага', 'Возраст голосования', 'Флаг земли',
         'Гражданское образование', 'Столица земли', 'Расположение на карте', 'Глава правительства', 'Министерства'],
};
const SOURCES = {
    en: path.join(ROOT, 'sources', 'english'),
    ur: path.join(ROOT, 'sources', 'urdu'),
    ar: path.join(ROOT, 'sources', 'arabic'),
    de: path.join(ROOT, 'sources', 'english'),
    tr: path.join(ROOT, 'sources', 'english'),
    ru: path.join(ROOT, 'sources', 'english'),
};
const OUTPUTS = {
    en: path.join(ROOT, 'en'),
    ur: path.join(ROOT, 'ur'),
    ar: path.join(ROOT, 'ar'),
    de: path.join(ROOT, 'de'),
    tr: path.join(ROOT, 'tr'),
    ru: path.join(ROOT, 'ru'),
};

// Files we never want to convert (branch metadata, not content)
// Note: README.md IS processed — its content becomes index.html
const EXCLUDE = new Set(['CONTRIBUTING.md']);

// Human-readable titles for known slugs. Add more as needed.
const TITLES = {
    en: {
        'questions-001-050': 'Questions 1–50',
        'questions-051-100': 'Questions 51–100',
        'questions-101-150': 'Questions 101–150',
        'questions-151-200': 'Questions 151–200',
        'questions-201-250': 'Questions 201–250',
        'questions-251-300': 'Questions 251–300',
        'baden-wuerttemberg': 'Baden-Württemberg',
        'bayern': 'Bavaria (Bayern)',
        'berlin': 'Berlin',
        'brandenburg': 'Brandenburg',
        'bremen': 'Bremen',
        'hamburg': 'Hamburg',
        'hessen': 'Hesse (Hessen)',
        'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern',
        'niedersachsen': 'Lower Saxony (Niedersachsen)',
        'nordrhein-westfalen': 'North Rhine-Westphalia',
        'rheinland-pfalz': 'Rhineland-Palatinate',
        'saarland': 'Saarland',
        'sachsen': 'Saxony (Sachsen)',
        'sachsen-anhalt': 'Saxony-Anhalt',
        'schleswig-holstein': 'Schleswig-Holstein',
        'thueringen': 'Thuringia (Thüringen)',
    },
    ur: {
        'questions-001-050': 'سوالات 1–50',
        'questions-051-100': 'سوالات 51–100',
        'questions-101-150': 'سوالات 101–150',
        'questions-151-200': 'سوالات 151–200',
        'questions-201-250': 'سوالات 201–250',
        'questions-251-300': 'سوالات 251–300',
        'baden-wuerttemberg': 'باڈن ورٹمبرگ',
        'bayern': 'باویریا',
        'berlin': 'برلن',
        'brandenburg': 'برانڈنبرگ',
        'bremen': 'بریمن',
        'hamburg': 'ہیمبرگ',
        'hessen': 'ہیسن',
        'mecklenburg-vorpommern': 'میکلنبرگ-فورپومرن',
        'niedersachsen': 'نیڈرزاخسن',
        'nordrhein-westfalen': 'نارڈرائن ویسٹ فالن',
        'rheinland-pfalz': 'رائن لینڈ-فالز',
        'saarland': 'زارلینڈ',
        'sachsen': 'زاخسن',
        'sachsen-anhalt': 'زاخسن-انہالٹ',
        'schleswig-holstein': 'شلیسوگ-ہولسٹائن',
        'thueringen': 'تھیورنگن',
    },
    ar: {
        'questions-001-050': 'الأسئلة 1–50',
        'questions-051-100': 'الأسئلة 51–100',
        'questions-101-150': 'الأسئلة 101–150',
        'questions-151-200': 'الأسئلة 151–200',
        'questions-201-250': 'الأسئلة 201–250',
        'questions-251-300': 'الأسئلة 251–300',
        'baden-wuerttemberg': 'بادن-فورتمبرغ',
        'bayern': 'بافاريا',
        'berlin': 'برلين',
        'brandenburg': 'براندنبورغ',
        'bremen': 'بريمن',
        'hamburg': 'هامبورغ',
        'hessen': 'هيسن',
        'mecklenburg-vorpommern': 'مكلنبورغ-فوربومرن',
        'niedersachsen': 'سكسونيا السفلى',
        'nordrhein-westfalen': 'شمال الراين-وستفاليا',
        'rheinland-pfalz': 'راينلاند-بفالتس',
        'saarland': 'زارلاند',
        'sachsen': 'ساكسونيا',
        'sachsen-anhalt': 'ساكسونيا-أنهالت',
        'schleswig-holstein': 'شليسفيغ-هولشتاين',
        'thueringen': 'تورينغن',
    },
    de: {
        'questions-001-050': 'Fragen 1–50',
        'questions-051-100': 'Fragen 51–100',
        'questions-101-150': 'Fragen 101–150',
        'questions-151-200': 'Fragen 151–200',
        'questions-201-250': 'Fragen 201–250',
        'questions-251-300': 'Fragen 251–300',
        'baden-wuerttemberg': 'Baden-Württemberg',
        'bayern': 'Bayern',
        'berlin': 'Berlin',
        'brandenburg': 'Brandenburg',
        'bremen': 'Bremen',
        'hamburg': 'Hamburg',
        'hessen': 'Hessen',
        'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern',
        'niedersachsen': 'Niedersachsen',
        'nordrhein-westfalen': 'Nordrhein-Westfalen',
        'rheinland-pfalz': 'Rheinland-Pfalz',
        'saarland': 'Saarland',
        'sachsen': 'Sachsen',
        'sachsen-anhalt': 'Sachsen-Anhalt',
        'schleswig-holstein': 'Schleswig-Holstein',
        'thueringen': 'Thüringen',
    },
    tr: {
        'questions-001-050': 'Sorular 1–50',
        'questions-051-100': 'Sorular 51–100',
        'questions-101-150': 'Sorular 101–150',
        'questions-151-200': 'Sorular 151–200',
        'questions-201-250': 'Sorular 201–250',
        'questions-251-300': 'Sorular 251–300',
        'baden-wuerttemberg': 'Baden-Württemberg',
        'bayern': 'Bavyera (Bayern)',
        'berlin': 'Berlin',
        'brandenburg': 'Brandenburg',
        'bremen': 'Bremen',
        'hamburg': 'Hamburg',
        'hessen': 'Hessen',
        'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern',
        'niedersachsen': 'Aşağı Saksonya (Niedersachsen)',
        'nordrhein-westfalen': 'Kuzey Ren-Vestfalya',
        'rheinland-pfalz': 'Rheinland-Pfalz',
        'saarland': 'Saarland',
        'sachsen': 'Saksonya (Sachsen)',
        'sachsen-anhalt': 'Saksonya-Anhalt',
        'schleswig-holstein': 'Schleswig-Holstein',
        'thueringen': 'Türingya (Thüringen)',
    },
    ru: {
        'questions-001-050': 'Вопросы 1–50',
        'questions-051-100': 'Вопросы 51–100',
        'questions-101-150': 'Вопросы 101–150',
        'questions-151-200': 'Вопросы 151–200',
        'questions-201-250': 'Вопросы 201–250',
        'questions-251-300': 'Вопросы 251–300',
        'baden-wuerttemberg': 'Баден-Вюртемберг',
        'bayern': 'Бавария',
        'berlin': 'Берлин',
        'brandenburg': 'Бранденбург',
        'bremen': 'Бремен',
        'hamburg': 'Гамбург',
        'hessen': 'Гессен',
        'mecklenburg-vorpommern': 'Мекленбург-Передняя Померания',
        'niedersachsen': 'Нижняя Саксония',
        'nordrhein-westfalen': 'Северный Рейн-Вестфалия',
        'rheinland-pfalz': 'Рейнланд-Пфальц',
        'saarland': 'Саар',
        'sachsen': 'Саксония',
        'sachsen-anhalt': 'Саксония-Анхальт',
        'schleswig-holstein': 'Шлезвиг-Гольштейн',
        'thueringen': 'Тюрингия',
    },
};

const UI = {
    en: {
        siteTitle: 'German Citizenship Test',
        home: 'Home',
        switchTo: 'اردو',
        back: '← Back to home',
        changeLang: '← Change language',
        backToTop: 'Back to top',
        pickerHint: 'Change language',
        questionsHeading: 'Questions',
        statesHeading: 'Federal state questions',
        tagline: 'All 300 questions for the Einbürgerungstest',
        sourceOnGithub: 'View on GitHub',
        footerTagline: '🇩🇪 German Citizenship Test — with English & Urdu',
        footerSubtag: 'Prepare for the Einbürgerungstest / Leben in Deutschland',
        bamfCatalog: 'BAMF Question Catalog ↗',
        bamfTestCenter: 'BAMF Test Center ↗',
        starLabel: '⭐ Star on GitHub',
        supportBtn: '☕ Buy Me a Coffee',
        wordfeatherBtn: '📚 German Dictionary at wordFeather ↗',
        wfBannerText: 'Preparing for citizenship? Master German vocabulary with wordFeather.',
        wfBannerCta: 'Try it free ↗',
        lastUpdated: 'Last updated',
        navPrev: '← Previous',
        navNext: 'Next →',
        navJump: 'Jump to:',
        navQuestions: 'Questions',
        navStates: 'States',
        privacyLink: 'Privacy & Impressum',
        randomBtn: '🎲 Random Question',
        printBtn: '🖨️ Print / Save PDF',
        reportBtn: '⚠️ Report an error',
        pwaTitle: 'Install as a free app — works offline, no App Store needed',
        pwaIphone: 'iPhone/iPad',
        pwaIphoneSteps: 'Safari → Share ⬆ → Add to Home Screen',
        pwaAndroid: 'Android',
        pwaAndroidSteps: 'Chrome → ⋮ Menu or address bar → Install app',
        pwaMac: 'macOS',
        pwaMacSteps: 'Safari → File menu → Add to Dock',
        pwaWindows: 'Windows',
        pwaWindowsSteps: 'Chrome/Edge → ⊕ icon in address bar → Install',
        pwaClose: 'Close',
        pwaToggle: 'Show/hide install instructions',
    },
    ur: {
        siteTitle: 'جرمن شہریت کا امتحان',
        home: 'ہوم',
        switchTo: 'English',
        back: 'ہوم پر واپس →',
        changeLang: 'زبان تبدیل کریں →',
        backToTop: 'اوپر جائیں',
        pickerHint: 'زبان تبدیل کریں',
        questionsHeading: 'سوالات',
        statesHeading: 'ریاستی سوالات',
        tagline: 'انبیورگرونگس ٹیسٹ کے تمام 300 سوالات',
        sourceOnGithub: 'GitHub پر دیکھیں',
        footerTagline: '🇩🇪 جرمن شہریت کا امتحان — انگریزی اور اردو کے ساتھ',
        footerSubtag: 'انبیورگرونگس ٹیسٹ / لیبن اِن ڈوئچ لینڈ کی تیاری',
        bamfCatalog: 'BAMF سوالات ↗',
        bamfTestCenter: 'BAMF ٹیسٹ سینٹر ↗',
        starLabel: '⭐ GitHub پر اسٹار کریں',
        supportBtn: '☕ مجھے کافی پلائیں',
        wordfeatherBtn: '📚 wordFeather پر جرمن لغت ↗',
        wfBannerText: 'شہریت کی تیاری کر رہے ہیں؟ wordFeather کے ساتھ جرمن الفاظ سیکھیں۔',
        wfBannerCta: 'مفت آزمائیں ↗',
        lastUpdated: 'آخری اپڈیٹ',
        navPrev: 'پچھلا →',
        navNext: '← اگلا',
        navJump: 'جائیں:',
        navQuestions: 'سوالات',
        navStates: 'ریاستیں',
        privacyLink: 'پرائیویسی و اظہاریہ',
        randomBtn: '🎲 بے ترتیب سوال',
        printBtn: '🖨️ پرنٹ / PDF محفوظ کریں',
        reportBtn: '⚠️ غلطی کی اطلاع دیں',
        pwaTitle: 'مفت ایپ کے طور پر انسٹال کریں — آف لائن کام کرتا ہے، ایپ اسٹور کی ضرورت نہیں',
        pwaIphone: 'آئی فون/آئی پیڈ',
        pwaIphoneSteps: 'Safari → Share ⬆ → Add to Home Screen',
        pwaAndroid: 'اینڈرائیڈ',
        pwaAndroidSteps: 'Chrome → مینو ⋮ یا ایڈریس بار → ایپ انسٹال کریں',
        pwaMac: 'میک او ایس',
        pwaMacSteps: 'Safari → File مینو → Dock میں شامل کریں',
        pwaWindows: 'ونڈوز',
        pwaWindowsSteps: 'Chrome/Edge → ⊕ آئیکن ایڈریس بار میں → انسٹال کریں',
        pwaClose: 'بند کریں',
        pwaToggle: 'انسٹالیشن ہدایات دکھائیں/چھپائیں',
    },
    ar: {
        siteTitle: 'اختبار الجنسية الألمانية',
        home: 'الرئيسية',
        switchTo: 'English',
        back: 'العودة إلى الرئيسية ←',
        changeLang: 'تغيير اللغة ←',
        backToTop: 'العودة إلى الأعلى',
        pickerHint: 'تغيير اللغة',
        questionsHeading: 'الأسئلة',
        statesHeading: 'أسئلة الولايات الفيدرالية',
        tagline: 'جميع أسئلة اختبار Einbürgerungstest مع الترجمة العربية',
        sourceOnGithub: 'عرض على GitHub',
        footerTagline: '🇩🇪 اختبار الجنسية الألمانية — بالعربية والإنجليزية',
        footerSubtag: 'التحضير لاختبار Einbürgerungstest / Leben in Deutschland',
        bamfCatalog: 'كتالوج أسئلة BAMF ↗',
        bamfTestCenter: 'مركز اختبار BAMF ↗',
        starLabel: '⭐ نجّم على GitHub',
        supportBtn: '☕ اشترِ لي فنجان قهوة',
        wordfeatherBtn: '📚 قاموس ألماني في wordFeather ↗',
        wfBannerText: 'تستعد للحصول على الجنسية؟ أتقن المفردات الألمانية مع wordFeather.',
        wfBannerCta: 'جرّبه مجانًا ↗',
        lastUpdated: 'آخر تحديث',
        navPrev: '→ السابق',
        navNext: 'التالي ←',
        navJump: 'الانتقال إلى:',
        navQuestions: 'الأسئلة',
        navStates: 'الولايات',
        privacyLink: 'الخصوصية والبيانات',
        randomBtn: '🎲 سؤال عشوائي',
        printBtn: '🖨️ طباعة / حفظ PDF',
        reportBtn: '⚠️ الإبلاغ عن خطأ',
        pwaTitle: 'ثبّت التطبيق مجانًا — يعمل بدون إنترنت، دون الحاجة لمتجر التطبيقات',
        pwaIphone: 'آيفون/آيباد',
        pwaIphoneSteps: 'سفاري ← مشاركة ⬆ ← إضافة إلى الشاشة الرئيسية',
        pwaAndroid: 'أندرويد',
        pwaAndroidSteps: 'كروم ← القائمة ⋮ أو شريط العنوان ← تثبيت التطبيق',
        pwaMac: 'macOS',
        pwaMacSteps: 'سفاري ← قائمة File ← إضافة إلى الرصيف (Dock)',
        pwaWindows: 'ويندوز',
        pwaWindowsSteps: 'كروم/إيدج ← أيقونة ⊕ في شريط العنوان ← تثبيت',
        pwaClose: 'إغلاق',
        pwaToggle: 'إظهار/إخفاء تعليمات التثبيت',
    },
    de: {
        siteTitle: 'Einbürgerungstest Deutschland',
        home: 'Startseite',
        switchTo: 'English',   // shown as nav link to switch to EN version
        back: '← Zurück zur Startseite',
        changeLang: '← Sprache ändern',
        backToTop: 'Nach oben',
        pickerHint: 'Sprache ändern',
        questionsHeading: 'Fragen',
        statesHeading: 'Länderspezifische Fragen',
        tagline: 'Alle 300 offiziellen Einbürgerungstest-Fragen mit Erklärungen',
        sourceOnGithub: 'Auf GitHub ansehen',
        footerTagline: '🇩🇪 Einbürgerungstest — kostenloses Lernmaterial',
        footerSubtag: 'Vorbereitung auf den Leben-in-Deutschland-Test',
        bamfCatalog: 'BAMF-Fragenkatalog ↗',
        bamfTestCenter: 'BAMF-Testzentrum ↗',
        starLabel: '⭐ Auf GitHub markieren',
        supportBtn: '☕ Kauf mir einen Kaffee',
        wordfeatherBtn: '📚 Deutsches Wörterbuch bei wordFeather ↗',
        wfBannerText: 'Bereiten Sie sich auf die Einbürgerung vor? Lernen Sie deutschen Wortschatz mit wordFeather.',
        wfBannerCta: 'Kostenlos testen ↗',
        lastUpdated: 'Zuletzt aktualisiert',
        navPrev: '← Vorherige',
        navNext: 'Nächste →',
        navJump: 'Gehe zu:',
        navQuestions: 'Fragen',
        navStates: 'Bundesländer',
        privacyLink: 'Datenschutz',
        randomBtn: '🎲 Zufallsfrage',
        printBtn: '🖨️ Drucken / PDF',
        reportBtn: '⚠️ Fehler melden',
        pwaTitle: 'Als kostenlose App installieren — funktioniert offline, kein App Store nötig',
        pwaIphone: 'iPhone/iPad',
        pwaIphoneSteps: 'Safari → Teilen ⬆ → Zum Home-Bildschirm',
        pwaAndroid: 'Android',
        pwaAndroidSteps: 'Chrome → ⋮ Menü oder Adressleiste → App installieren',
        pwaMac: 'macOS',
        pwaMacSteps: 'Safari → Ablage-Menü → Zum Dock hinzufügen',
        pwaWindows: 'Windows',
        pwaWindowsSteps: 'Chrome/Edge → ⊕-Symbol in der Adressleiste → Installieren',
        pwaClose: 'Schließen',
        pwaToggle: 'Installationsanleitung ein-/ausblenden',
    },
    tr: {
        siteTitle: 'Almanya Vatandaşlık Sınavı',
        home: 'Ana Sayfa',
        switchTo: 'English',
        back: '← Ana Sayfaya Dön',
        changeLang: '← Dil Değiştir',
        backToTop: 'Yukarı Çık',
        pickerHint: 'Dil Seç',
        questionsHeading: 'Sorular',
        statesHeading: 'Eyalet Soruları',
        tagline: 'Tüm resmi Einbürgerungstest soruları Türkçe açıklamalarıyla',
        sourceOnGithub: "GitHub’da Görüntüle",
        footerTagline: '🇩🇪 Almanya Vatandaşlık Sınavı — Ücretsiz Çalışma Rehberi',
        footerSubtag: 'Einbürgerungstest / Leben in Deutschland sınavına hazırlık',
        bamfCatalog: 'BAMF Soru Kataloğu ↗',
        bamfTestCenter: 'BAMF Sınav Merkezi ↗',
        starLabel: '⭐ GitHub’da Yıldızla',
        supportBtn: '☕ Bana Bir Kahve Ismarla',
        wordfeatherBtn: '📚 wordFeather Almanca Sözlük ↗',
        wfBannerText: 'Vatandaşlığa mı hazırlanıyorsunuz? wordFeather ile Almanca kelime dağarcığınızı geliştirin.',
        wfBannerCta: 'Ücretsiz deneyin ↗',
        lastUpdated: 'Son güncelleme',
        navPrev: '← Önceki',
        navNext: 'Sonraki →',
        navJump: 'Git:',
        navQuestions: 'Sorular',
        navStates: 'Eyaletler',
        privacyLink: 'Gizlilik ve Veri',
        randomBtn: '🎲 Rastgele Soru',
        printBtn: '🖨️ Yazdır / PDF',
        reportBtn: '⚠️ Hata Bildir',
        pwaTitle: 'Ücretsiz uygulama olarak yükleyin — çevrimdışı çalışır, App Store gerekmez',
        pwaIphone: 'iPhone/iPad',
        pwaIphoneSteps: 'Safari → Paylaş ⬆ → Ana Ekrana Ekle',
        pwaAndroid: 'Android',
        pwaAndroidSteps: 'Chrome → ⋮ Menü veya adres çubuğu → Uygulamayı yükle',
        pwaMac: 'macOS',
        pwaMacSteps: "Safari → Dosya menüsü → Dock'a Ekle",
        pwaWindows: 'Windows',
        pwaWindowsSteps: 'Chrome/Edge → Adres çubuğundaki ⊕ simgesi → Yükle',
        pwaClose: 'Kapat',
        pwaToggle: 'Yükleme talimatlarını göster/gizle',
    },
    ru: {
        siteTitle: 'Тест на гражданство Германии',
        home: 'Главная',
        switchTo: 'English',
        back: '← На главную',
        changeLang: '← Сменить язык',
        backToTop: 'Наверх',
        pickerHint: 'Выбор языка',
        questionsHeading: 'Вопросы',
        statesHeading: 'Вопросы по землям',
        tagline: 'Все официальные вопросы Einbürgerungstest с пояснениями на русском',
        sourceOnGithub: 'Открыть на GitHub',
        footerTagline: '🇩🇪 Тест на гражданство Германии — бесплатное пособие',
        footerSubtag: 'Подготовка к тесту Leben in Deutschland',
        bamfCatalog: 'Каталог вопросов BAMF ↗',
        bamfTestCenter: 'Центр сдачи теста BAMF ↗',
        starLabel: '⭐ Отметить на GitHub',
        supportBtn: '☕ Угости меня кофе',
        wordfeatherBtn: '📚 Немецкий словарь на wordFeather ↗',
        wfBannerText: 'Готовитесь к получению гражданства? Изучайте немецкую лексику с wordFeather.',
        wfBannerCta: 'Попробовать бесплатно ↗',
        lastUpdated: 'Обновлено',
        navPrev: '← Предыдущие',
        navNext: 'Следующие →',
        navJump: 'Перейти:',
        navQuestions: 'Вопросы',
        navStates: 'Земли',
        privacyLink: 'Конфиденциальность',
        randomBtn: '🎲 Случайный вопрос',
        printBtn: '🖨️ Печать / PDF',
        reportBtn: '⚠️ Сообщить об ошибке',
        pwaTitle: 'Установите как бесплатное приложение — работает офлайн, App Store не нужен',
        pwaIphone: 'iPhone/iPad',
        pwaIphoneSteps: 'Safari → Поделиться ⬆ → На экран «Домой»',
        pwaAndroid: 'Android',
        pwaAndroidSteps: 'Chrome → Меню ⋮ или адресная строка → Установить приложение',
        pwaMac: 'macOS',
        pwaMacSteps: 'Safari → Меню «Файл» → Добавить в Dock',
        pwaWindows: 'Windows',
        pwaWindowsSteps: 'Chrome/Edge → значок ⊕ в адресной строке → Установить',
        pwaClose: 'Закрыть',
        pwaToggle: 'Показать/скрыть инструкции по установке',
    },
};

const GITHUB_URL = 'https://github.com/abdullahbutt/leben-in-deutschland-test';
const PAYPAL_URL = 'https://paypal.me/abdullahbuttde';
const WORDFEATHER_URL = 'https://wordfeather.com/dictionary.html';
const BAMF_CATALOG_URL = 'https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.html';
const BAMF_TEST_CENTER_URL = 'https://oet.bamf.de/ords/oetut/f?p=514:1::::::';
let BUILD_DATE = new Date().toISOString().slice(0, 10);
const TODAYS_BUILD_DATE = BUILD_DATE; // the real "today", kept aside since BUILD_DATE gets reused as scratch space below

// Records each page's real last-changed date (not just "today"), so
// buildSitemap() can give every URL an accurate <lastmod> instead of
// stamping every single URL with today's date on every build.
const PAGE_LASTMOD = new Map(); // key: "lang/slug.html" -> date string

// Writes a generated page only if its content (ignoring the "Last updated"
// date) actually changed since the last build. renderFn is called with
// BUILD_DATE temporarily set to the file's *existing* on-disk date first;
// if that reproduces the file byte-for-byte, nothing really changed, so we
// leave the file untouched (no new date, no git diff noise). Only when
// content genuinely differs do we re-render with today's date and write.
// sitemapKey, if given, records this page's resulting date for buildSitemap().
function writeIfChanged(filePath, renderFn, sitemapKey) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    const dateMatch = existing && existing.match(/class="foot-meta">[^<]*(\d{4}-\d{2}-\d{2})/);
    const existingDate = dateMatch ? dateMatch[1] : null;

    // Windows checkouts convert LF -> CRLF on disk, but freshly-rendered
    // content always uses plain \n — normalize both before comparing so
    // that alone never looks like a "real" content change.
    const normalize = (s) => s.replace(/\r\n/g, '\n');

    if (existing && existingDate) {
        BUILD_DATE = existingDate;
        const candidate = renderFn();
        BUILD_DATE = TODAYS_BUILD_DATE;
        if (normalize(candidate) === normalize(existing)) {
            if (sitemapKey) PAGE_LASTMOD.set(sitemapKey, existingDate);
            return false; // unchanged — skip write entirely
        }
    } else {
        BUILD_DATE = TODAYS_BUILD_DATE;
    }

    const finalHtml = renderFn();
    fs.writeFileSync(filePath, finalHtml);
    if (sitemapKey) PAGE_LASTMOD.set(sitemapKey, TODAYS_BUILD_DATE);
    return true;
}
const SITE_BASE_URL = 'https://leben.wordfeather.com';
const OG_IMAGE_URL = `${SITE_BASE_URL}/icons/og-image.png`;
const CLOUDFLARE_ANALYTICS_TOKEN = 'd435b2572b82459cb083e37f7c734b75';

// Canonical ordering for navigation (prev/next + jump menu).
// Question sets in numeric order; states alphabetical.
const ORDERED_QUESTIONS = [
    'questions-001-050',
    'questions-051-100',
    'questions-101-150',
    'questions-151-200',
    'questions-201-250',
    'questions-251-300',
];
const ORDERED_STATES = [
    'baden-wuerttemberg',
    'bayern',
    'berlin',
    'brandenburg',
    'bremen',
    'hamburg',
    'hessen',
    'mecklenburg-vorpommern',
    'niedersachsen',
    'nordrhein-westfalen',
    'rheinland-pfalz',
    'saarland',
    'sachsen',
    'sachsen-anhalt',
    'schleswig-holstein',
    'thueringen',
];
const ORDERED_ALL = [...ORDERED_QUESTIONS, ...ORDERED_STATES];

// ---------- Navigation pager ----------
function renderNavPager({ lang, slug }) {
    const ui = UI[lang];
    const titles = TITLES[lang];

    const optgroup = (label, items) =>
        `<optgroup label="${escapeHtml(label)}">${
            items.map(s =>
                `<option value="./${s}.html"${s === slug ? ' selected' : ''}>${escapeHtml(titles[s] || s)}</option>`
            ).join('')
        }</optgroup>`;

    const jumpSelect =
        `<div class="pager-jump">
            <select onchange="if(this.value)window.location.href=this.value" aria-label="${escapeHtml(ui.navJump)}">
                <option value="">${escapeHtml(ui.navJump)}</option>
                <option value="../quiz.html?lang=${lang}">🎯 ${lang === 'ur' ? 'کوئز / مشق' : lang === 'ar' ? 'اختبار التدريب' : lang === 'de' ? 'Quiz / Üben' : 'Practice Quiz'}</option>
                ${optgroup(ui.navQuestions, ORDERED_QUESTIONS)}
                ${optgroup(ui.navStates, ORDERED_STATES)}
            </select>
        </div>`;

    // Index page: jump-only variant + random button
    if (slug === 'index') {
        return `
        <nav class="nav-pager nav-pager--jump-only" aria-label="Quick jump">
            ${jumpSelect}
            <button class="pager-btn" onclick="goRandom()" style="white-space:nowrap;">${escapeHtml(ui.randomBtn)}</button>
        </nav>`;
    }

    const idx = ORDERED_ALL.indexOf(slug);
    if (idx === -1) return '';

    const prev = idx > 0 ? ORDERED_ALL[idx - 1] : null;
    const next = idx < ORDERED_ALL.length - 1 ? ORDERED_ALL[idx + 1] : null;

    const prevBtn = prev
        ? `<a class="pager-btn" href="./${prev}.html" rel="prev">${escapeHtml(ui.navPrev)} ${escapeHtml(titles[prev] || prev)}</a>`
        : `<span class="pager-btn disabled">${escapeHtml(ui.navPrev)}</span>`;
    const nextBtn = next
        ? `<a class="pager-btn" href="./${next}.html" rel="next">${escapeHtml(titles[next] || next)} ${escapeHtml(ui.navNext)}</a>`
        : `<span class="pager-btn disabled">${escapeHtml(ui.navNext)}</span>`;

    return `
        <nav class="nav-pager" aria-label="Page navigation">
            ${prevBtn}
            ${jumpSelect}
            <button class="pager-btn" onclick="goRandom()" style="white-space:nowrap;">${escapeHtml(ui.randomBtn)}</button>
            ${nextBtn}
        </nav>`;
}

// ---------- SEO helpers ----------

// Per-page meta description optimised for search snippets in all 3 languages.
const META_DESCS = {
    en: {
        'index':               'Free study guide for the German citizenship test (Einbürgerungstest / Leben in Deutschland). All 300+ official questions with English & Urdu translations, correct answers highlighted, and explanations for every question.',
        'questions-001-050':   'Einbürgerungstest questions 1–50 with English translations and explanations. Topics: democracy, fundamental rights, rule of law. Free prep guide.',
        'questions-051-100':   'Einbürgerungstest questions 51–100 with English translations. Topics: German history, Nazi era, East/West Germany. Free prep guide.',
        'questions-101-150':   'Einbürgerungstest questions 101–150 with English translations. Topics: German federal system, Bundesrat, Bundestag. Free prep guide.',
        'questions-151-200':   'Einbürgerungstest questions 151–200 with English translations. Topics: social welfare, health insurance, education. Free prep guide.',
        'questions-201-250':   'Einbürgerungstest questions 201–250 with English translations. Topics: culture, religion, society in Germany. Free prep guide.',
        'questions-251-300':   'Einbürgerungstest questions 251–300 with English translations. Topics: geography, economy, state-specific transition. Free prep guide.',
        'baden-wuerttemberg':  'State-specific Einbürgerungstest questions for Baden-Württemberg (questions 301–310) with English translations. Capital: Stuttgart.',
        'bayern':              'State-specific Einbürgerungstest questions for Bavaria (Bayern, questions 301–310) with English translations. Capital: Munich.',
        'berlin':              'State-specific Einbürgerungstest questions for Berlin (questions 301–310) with English translations. Berlin is Germany’s capital and a city-state.',
        'brandenburg':         'State-specific Einbürgerungstest questions for Brandenburg (questions 301–310) with English translations. Capital: Potsdam.',
        'bremen':              'State-specific Einbürgerungstest questions for Bremen (questions 301–310) with English translations. Germany’s smallest state by population.',
        'hamburg':             'State-specific Einbürgerungstest questions for Hamburg (questions 301–310) with English translations. Germany’s second-largest city.',
        'hessen':              'State-specific Einbürgerungstest questions for Hesse (Hessen, questions 301–310) with English translations. Capital: Wiesbaden.',
        'mecklenburg-vorpommern': 'State-specific Einbürgerungstest questions for Mecklenburg-Vorpommern (questions 301–310) with English translations. Capital: Schwerin.',
        'niedersachsen':       'State-specific Einbürgerungstest questions for Lower Saxony (Niedersachsen, questions 301–310) with English translations. Capital: Hanover.',
        'nordrhein-westfalen': 'State-specific Einbürgerungstest questions for North Rhine-Westphalia (questions 301–310) with English translations. Capital: Düsseldorf.',
        'rheinland-pfalz':     'State-specific Einbürgerungstest questions for Rhineland-Palatinate (questions 301–310) with English translations. Capital: Mainz.',
        'saarland':            'State-specific Einbürgerungstest questions for Saarland (questions 301–310) with English translations. Capital: Saarbrücken.',
        'sachsen':             'State-specific Einbürgerungstest questions for Saxony (Sachsen, questions 301–310) with English translations. Capital: Dresden.',
        'sachsen-anhalt':      'State-specific Einbürgerungstest questions for Saxony-Anhalt (questions 301–310) with English translations. Capital: Magdeburg.',
        'schleswig-holstein':  'State-specific Einbürgerungstest questions for Schleswig-Holstein (questions 301–310) with English translations. Capital: Kiel.',
        'thueringen':          'State-specific Einbürgerungstest questions for Thuringia (Thüringen, questions 301–310) with English translations. Capital: Erfurt.',
    },
    ur: {
        'index':               'جرمن شہریت کے امتحان (Einbürgerungstest / Leben in Deutschland) کے لیے مفت گائیڈ۔ تمام 300 سرکاری سوالات اردو اور انگریزی ترجمے، درست جوابات، اور ہر سوال کی وضاحت کے ساتھ۔',
        'questions-001-050':   'Einbürgerungstest کے سوالات 1–50 اردو ترجمے اور وضاحت کے ساتھ۔ موضوعات: جمہوریت، بنیادی حقوق، قانون کی حکمرانی۔',
        'questions-051-100':   'Einbürgerungstest کے سوالات 51–100 اردو ترجمے کے ساتھ۔ موضوعات: جرمن تاریخ، نازی دور، مشرقی/مغربی جرمنی۔',
        'questions-101-150':   'Einbürgerungstest کے سوالات 101–150 اردو ترجمے کے ساتھ۔ موضوعات: جرمن وفاقی نظام، Bundesrat، Bundestag۔',
        'questions-151-200':   'Einbürgerungstest کے سوالات 151–200 اردو ترجمے کے ساتھ۔ موضوعات: سماجی فلاح، صحت، تعلیم۔',
        'questions-201-250':   'Einbürgerungstest کے سوالات 201–250 اردو ترجمے کے ساتھ۔ موضوعات: ثقافت، مذہب، جرمن معاشرہ۔',
        'questions-251-300':   'Einbürgerungstest کے سوالات 251–300 اردو ترجمے کے ساتھ۔ موضوعات: جغرافیہ، معیشت۔',
        'berlin':              'برلن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: برلن۔',
        'hessen':              'ہیسن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: وِسبادن۔',
        'hamburg':             'ہیمبرگ کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔',
        'nordrhein-westfalen': 'نارڈرائن ویسٹ فالن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: ڈوسلڈورف۔',
    },
    de: {
        'index':               'Kostenloser Lernführer für den Einbürgerungstest / Leben in Deutschland. Alle 300+ offiziellen Fragen mit Übersetzungen auf Englisch und Urdu, Antworten markiert und Erklärungen zu jeder Frage.',
        'questions-001-050':   'Einbürgerungstest Fragen 1–50 mit Erklärungen. Themen: Demokratie, Grundrechte, Rechtsstaat. Kostenlose Prüfungsvorbereitung mit englischer und Urdu-Übersetzung.',
        'questions-051-100':   'Einbürgerungstest Fragen 51–100. Themen: deutsche Geschichte, NS-Zeit, DDR und BRD. Kostenlose Prüfungsvorbereitung mit Übersetzungen.',
        'questions-101-150':   'Einbürgerungstest Fragen 101–150. Themen: Bundesrat, Bundestag, föderales System. Kostenlose Vorbereitung auf den Leben-in-Deutschland-Test.',
        'questions-151-200':   'Einbürgerungstest Fragen 151–200. Themen: Sozialversicherung, Krankenversicherung, Bildungssystem. Kostenlose Prüfungsvorbereitung.',
        'questions-201-250':   'Einbürgerungstest Fragen 201–250. Themen: Kultur, Religion, Gesellschaft in Deutschland. Kostenlose Vorbereitung mit englischer Übersetzung.',
        'questions-251-300':   'Einbürgerungstest Fragen 251–300. Themen: Geographie, Wirtschaft, Staatsbürgerschaftspflichten. Kostenlose Prüfungsvorbereitung.',
        'baden-wuerttemberg':  'Einbürgerungstest Fragen für Baden-Württemberg (Fragen 301–310). Landeshauptstadt Stuttgart. Kostenlose Vorbereitung mit englischer und Urdu-Übersetzung.',
        'bayern':              'Einbürgerungstest Fragen für Bayern (Fragen 301–310). Landeshauptstadt München. Kostenlose Vorbereitung auf den Leben-in-Deutschland-Test.',
        'berlin':              'Einbürgerungstest Fragen für Berlin (Fragen 301–310). Berlin ist Bundeshauptstadt und Stadtstaat zugleich. Kostenlose Prüfungsvorbereitung.',
        'brandenburg':         'Einbürgerungstest Fragen für Brandenburg (Fragen 301–310). Landeshauptstadt Potsdam. Kostenlose Vorbereitung mit Übersetzungen.',
        'bremen':              'Einbürgerungstest Fragen für Bremen (Fragen 301–310). Kleinstes Bundesland nach Einwohnerzahl. Kostenlose Prüfungsvorbereitung.',
        'hamburg':             'Einbürgerungstest Fragen für Hamburg (Fragen 301–310). Größter Hafen Deutschlands, Stadtstaat. Kostenlose Prüfungsvorbereitung.',
        'hessen':              'Einbürgerungstest Fragen für Hessen (Fragen 301–310). Landeshauptstadt Wiesbaden, Finanzmetropole Frankfurt. Kostenlose Prüfungsvorbereitung.',
        'mecklenburg-vorpommern': 'Einbürgerungstest Fragen für Mecklenburg-Vorpommern (Fragen 301–310). Landeshauptstadt Schwerin. Kostenlose Prüfungsvorbereitung.',
        'niedersachsen':       'Einbürgerungstest Fragen für Niedersachsen (Fragen 301–310). Landeshauptstadt Hannover. Zweitgrößtes Bundesland. Kostenlose Prüfungsvorbereitung.',
        'nordrhein-westfalen': 'Einbürgerungstest Fragen für Nordrhein-Westfalen (Fragen 301–310). Bevölkerungsreichstes Bundesland, Landeshauptstadt Düsseldorf. Kostenlose Vorbereitung.',
        'rheinland-pfalz':     'Einbürgerungstest Fragen für Rheinland-Pfalz (Fragen 301–310). Landeshauptstadt Mainz, bekannt für Weinanbau. Kostenlose Prüfungsvorbereitung.',
        'saarland':            'Einbürgerungstest Fragen für das Saarland (Fragen 301–310). Landeshauptstadt Saarbrücken, grenzt an Frankreich und Luxemburg. Kostenlose Vorbereitung.',
        'sachsen':             'Einbürgerungstest Fragen für Sachsen (Fragen 301–310). Landeshauptstadt Dresden. Bekannt für Barockarchitektur. Kostenlose Prüfungsvorbereitung.',
        'sachsen-anhalt':      'Einbürgerungstest Fragen für Sachsen-Anhalt (Fragen 301–310). Landeshauptstadt Magdeburg. Reformationsland Martin Luthers. Kostenlose Vorbereitung.',
        'schleswig-holstein':  'Einbürgerungstest Fragen für Schleswig-Holstein (Fragen 301–310). Landeshauptstadt Kiel, zwischen Nord- und Ostsee. Kostenlose Prüfungsvorbereitung.',
        'thueringen':          'Einbürgerungstest Fragen für Thüringen (Fragen 301–310). Landeshauptstadt Erfurt. Grünes Herz Deutschlands, Heimat von Goethe und Schiller. Kostenlose Vorbereitung.',
    },
};

// State intro paragraphs — shown above the question table on each state page.
// Provides context for visitors and unique text content for SEO.
const STATE_INTROS = {
    'baden-wuerttemberg': {
        en: 'Baden-Württemberg is located in the southwest of Germany, bordering France and Switzerland. Its capital is <strong>Stuttgart</strong>, home to the Landtag (state parliament). The state is known as an industrial powerhouse — headquarters of Mercedes-Benz, Porsche, Bosch, and SAP are all here. The Black Forest (Schwarzwald) and Lake Constance (Bodensee) are among its most famous natural landmarks. The head of government holds the title of <strong>Ministerpräsident/in</strong>.',
        ur: 'باڈن ورٹمبرگ جنوب مغربی جرمنی میں واقع ہے اور فرانس و سوئٹزرلینڈ سے ملتا ہے۔ اس کا دارالحکومت <strong>اسٹوٹگارٹ</strong> ہے جہاں ریاستی پارلیمان (Landtag) موجود ہے۔ یہ ریاست صنعتی اعتبار سے بہت اہم ہے — Mercedes-Benz، Porsche، Bosch اور SAP کے صدر دفاتر یہاں ہیں۔ سیاہ جنگل (Schwarzwald) اور باڈن سی (Bodensee) مشہور قدرتی مقامات ہیں۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> کہلاتا ہے۔',
        de: 'Baden-Württemberg liegt im Südwesten Deutschlands und grenzt an Frankreich und die Schweiz. Die Landeshauptstadt ist <strong>Stuttgart</strong>, Sitz des Landtags. Das Land ist bekannt für seine Industrie — hier haben Mercedes-Benz, Porsche, Bosch und SAP ihren Hauptsitz. Der Schwarzwald und der Bodensee gehören zu den bekanntesten Naturlandschaften. Das Staatsoberhaupt trägt den Titel <strong>Ministerpräsident/in</strong>.',
        ar: 'تقع بادن-فورتمبرغ في جنوب غرب ألمانيا، وتحدّها فرنسا وسويسرا. عاصمتها <strong>شتوتغارت</strong>، مقر البرلمان الولائي <strong>Landtag</strong>. تشتهر الولاية بقوتها الصناعية — تتخذ مرسيدس بنز وبورشه وبوش وSAP من مقارها هنا. تُعدّ غابة شوارتسفالد وبحيرة بودنزيه من أبرز معالمها الطبيعية. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Baden-Württemberg, Almanya’nın güneybatısında Fransa ve İsviçre ile sınır komşusudur. Eyaletin başkenti, <strong>Landtag</strong>’ın bulunduğu <strong>Stuttgart</strong>’tır. Eyalet, Mercedes-Benz, Porsche, Bosch ve SAP’ın genel merkezleriyle sanayi gücüyle tanınır. Schwarzwald (Kara Orman) ve Bodensee (Konstanz Gölü) en ünlü doğal güzellikleri arasındadır. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Баден-Вюртемберг расположен на юго-западе Германии и граничит с Францией и Швейцарией. Столица земли — <strong>Штутгарт</strong>, где заседает <strong>Landtag</strong>. Земля известна штаб-квартирами Mercedes-Benz, Porsche, Bosch и SAP. Шварцвальд и Боденское озеро — главные природные достопримечательности. Глава правительства носит титул <strong>Ministerpräsident/in</strong>.',
    },
    'bayern': {
        en: 'Bavaria (Bayern) is the largest German state by area, located in the southeast and bordering Austria and the Czech Republic. The capital is <strong>Munich (München)</strong>, home to the Bayerischer Landtag. Bavaria is known for the Alps, Oktoberfest, BMW, and a strong tradition of arts and culture. The head of government is the <strong>Ministerpräsident/in</strong>. Bavaria has its own strong regional identity and the Bavarian dialect is widely spoken.',
        ur: 'باویریا (Bayern) رقبے کے لحاظ سے جرمنی کی سب سے بڑی ریاست ہے، جنوب مشرق میں واقع ہے اور آسٹریا و چیک ریپبلک سے ملتی ہے۔ دارالحکومت <strong>میونخ (München)</strong> ہے جہاں Bayerischer Landtag قائم ہے۔ باویریا آلپس پہاڑوں، Oktoberfest، BMW اور فنون و ثقافت کے لیے مشہور ہے۔ سربراہ حکومت کا عہدہ <strong>Ministerpräsident/in</strong> ہے۔ باویریا کی اپنی مضبوط علاقائی شناخت اور زبان (Bavarian) ہے۔',
        de: 'Bayern ist das flächenmäßig größte Bundesland Deutschlands im Südosten, das an Österreich und Tschechien grenzt. Die Landeshauptstadt ist <strong>München</strong>, Sitz des Bayerischen Landtags. Bayern ist bekannt für die Alpen, das Oktoberfest, BMW und eine starke Kulturlandschaft. Das Staatsoberhaupt ist der <strong>Ministerpräsident/in</strong>. Bayern pflegt eine ausgeprägte regionale Identität.',
        ar: 'بافاريا (Bayern) هي أكبر ولاية ألمانية من حيث المساحة، تقع في الجنوب الشرقي وتحدّها النمسا والجمهورية التشيكية. عاصمتها <strong>ميونيخ (München)</strong>، مقر البرلمان البافاري <strong>Bayerischer Landtag</strong>. تشتهر بجبال الألب ومهرجان أكتوبرفيست وشركة BMW وتراثها الثقافي الغني. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>، وتتمتع بافاريا بهوية إقليمية قوية.',
        tr: 'Bavyera (Bayern), Almanya’nın en büyük eyaletidir; güneydoğuda Avusturya ve Çek Cumhuriyeti ile sınır komşusudur. Başkenti, <strong>Bayerischer Landtag</strong>’ın bulunduğu <strong>Münih (München)</strong>’tir. Alpler, Oktoberfest, BMW ve zengin kültürel mirası ile ünlüdür. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir. Bavyera’nın güçlü bir bölgesel kimliği ve Bavyera lehçesi vardır.',
        ru: 'Бавария (Bayern) — крупнейшая земля Германии, расположена на юго-востоке и граничит с Австрией и Чехией. Столица — <strong>Мюнхен (München)</strong>, где заседает <strong>Bayerischer Landtag</strong>. Земля знаменита Альпами, Октоберфестом и компанией BMW. Глава правительства носит титул <strong>Ministerpräsident/in</strong>.',
    },
    'berlin': {
        en: 'Berlin is Germany’s <strong>capital city</strong> and simultaneously a federal state (city-state). Its parliament is called the <strong>Abgeordnetenhaus</strong> and the head of government is the <strong>Regierender Bürgermeister/in</strong>. Berlin was divided by the Berlin Wall from 1961 until 1989. After reunification in 1990 it became the capital of reunified Germany. It is home to the Bundestag, Brandenburg Gate, and numerous world-class museums and cultural institutions.',
        ur: 'برلن جرمنی کا <strong>دارالحکومت</strong> اور بیک وقت ایک وفاقی ریاست (شہری ریاست) بھی ہے۔ اس کی پارلیمان <strong>Abgeordnetenhaus</strong> کہلاتی ہے اور حکومت کا سربراہ <strong>Regierender Bürgermeister/in</strong> ہوتا ہے۔ برلن 1961 سے 1989 تک دیوارِ برلن سے تقسیم رہا۔ 1990 میں جرمنی کے اتحاد کے بعد یہ متحدہ جرمنی کا دارالحکومت بنا۔ یہاں Bundestag، برانڈنبرگ گیٹ اور عالمی سطح کے عجائب گھر موجود ہیں۔',
        de: 'Berlin ist gleichzeitig <strong>Bundeshauptstadt</strong> und Bundesland (Stadtstaat). Das Landesparlament heißt <strong>Abgeordnetenhaus</strong>, das Staatsoberhaupt ist der/die <strong>Regierende Bürgermeister/in</strong>. Von 1961 bis 1989 war Berlin durch die Berliner Mauer geteilt. Nach der Wiedervereinigung 1990 wurde es wieder Hauptstadt Gesamtdeutschlands. Hier befinden sich der Bundestag, das Brandenburger Tor und viele weltbekannte Museen.',
        ar: 'برلين هي <strong>عاصمة ألمانيا</strong> وفي الوقت ذاته ولاية فيدرالية (مدينة-ولاية). برلمانها يُسمى <strong>Abgeordnetenhaus</strong> ورئيس حكومتها يحمل لقب <strong>Regierender Bürgermeister/in</strong>. قُسِّمت برلين بجدار برلين من عام 1961 حتى 1989. وبعد إعادة توحيد ألمانيا عام 1990 أصبحت عاصمة ألمانيا الموحدة. تضمّ البوندستاغ وبوابة براندنبورغ ومتاحف عالمية المستوى.',
        tr: 'Berlin, Almanya’nın <strong>başkenti</strong> ve aynı zamanda bir federal eyalettir (şehir-eyalet). Eyalet parlamentosu <strong>Abgeordnetenhaus</strong> adını taşır; hükümet başkanının unvanı <strong>Regierender Bürgermeister/in</strong>’dir. Berlin, 1961’den 1989’a kadar Berlin Duvarı ile bölünmüştü. 1990’daki yeniden birleşmenin ardından birleşik Almanya’nın başkenti oldu. Bundestag, Brandenburg Kapısı ve dünya çapında müzeler burada yer almaktadır.',
        ru: 'Берлин — <strong>столица Германии</strong> и одновременно самостоятельная земля (город-земля). Парламент называется <strong>Abgeordnetenhaus</strong>; глава правительства — <strong>Regierender Bürgermeister/in</strong>. Город был разделён Берлинской стеной с 1961 по 1989 год. После объединения 1990 года стал единой столицей. Здесь находятся Рейхстаг, Бранденбургские ворота и всемирно известные музеи.',
    },
    'brandenburg': {
        en: 'Brandenburg surrounds the city-state of Berlin and is located in northeastern Germany. Its capital is <strong>Potsdam</strong>, famous for the Sanssouci Palace (UNESCO World Heritage Site) and the <strong>Landtag</strong>. The state is characterised by vast forests, more than 3,000 lakes, and the Spreewald biosphere reserve. The head of government holds the title of <strong>Ministerpräsident/in</strong>. Brandenburg was part of East Germany (GDR) before reunification in 1990.',
        ur: 'برانڈنبرگ شہری ریاست برلن کو چاروں طرف سے گھیرے ہوئے ہے اور شمال مشرقی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>پوٹسڈام</strong> ہے جو Sanssouci محل (یونیسکو عالمی ورثہ) اور <strong>Landtag</strong> کے لیے مشہور ہے۔ یہ ریاست وسیع جنگلات، 3000 سے زیادہ جھیلوں اور Spreewald کے لیے جانی جاتی ہے۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> ہے۔ برانڈنبرگ 1990 کے اتحاد سے پہلے مشرقی جرمنی (GDR) کا حصہ تھا۔',
        de: 'Brandenburg umschließt den Stadtstaat Berlin und liegt in Nordostdeutschland. Die Landeshauptstadt ist <strong>Potsdam</strong>, bekannt für Schloss Sanssouci (UNESCO-Welterbe) und den <strong>Landtag</strong>. Das Land zeichnet sich durch weite Wälder, über 3.000 Seen und den Spreewald aus. Das Staatsoberhaupt trägt den Titel <strong>Ministerpräsident/in</strong>. Brandenburg gehörte vor der Wiedervereinigung 1990 zur DDR.',
        ar: 'تحيط براندنبورغ بمدينة-ولاية برلين، وتقع في شمال شرق ألمانيا. عاصمتها <strong>بوتسدام</strong> المشهورة بقصر سانسوسي (التراث العالمي لليونسكو) ومقر <strong>Landtag</strong>. تتميز بغاباتها الشاسعة وأكثر من 3000 بحيرة ومحمية سبريفالد الطبيعية. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>. كانت براندنبورغ جزءاً من ألمانيا الشرقية (GDR) قبل توحيد 1990.',
        tr: 'Brandenburg, Berlin şehir-eyaletini çevreler ve Almanya’nın kuzeydoğusunda yer alır. Başkenti, Sanssouci Sarayı (UNESCO Dünya Mirası) ve <strong>Landtag</strong>’ıyla ünlü <strong>Potsdam</strong>’dır. Eyalet; geniş ormanları, 3.000’den fazla gölü ve Spreewald biyosfer rezerviyle karakteristiktir. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir. Brandenburg, 1990’daki yeniden birleşmeden önce Doğu Almanya’nın (DDR) bir parçasıydı.',
        ru: 'Бранденбург окружает Берлин и расположен на северо-востоке Германии. Столица — <strong>Потсдам</strong>, известный дворцом Сан-Суси (объект ЮНЕСКО) и <strong>Landtag</strong>. Земля отличается обширными лесами и тысячами озёр. Бранденбург входил в состав ГДР и воссоединился с ФРГ в 1990 году. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'bremen': {
        en: 'Bremen is Germany’s <strong>smallest state by population</strong> and consists of two cities: Bremen and Bremerhaven. It is a city-state and one of the oldest trading cities in Germany. Its parliament is called the <strong>Bremische Bürgerschaft</strong> and the head of government is the <strong>Bürgermeister/in (Senatspräsident/in)</strong>. The port of Bremen and Bremerhaven handles a significant share of German foreign trade. The Bremen Town Musicians statue is one of Germany’s most photographed sculptures.',
        ur: 'بریمن آبادی کے لحاظ سے جرمنی کی <strong>سب سے چھوٹی ریاست</strong> ہے اور دو شہروں پر مشتمل ہے: بریمن اور بریمرہافن۔ یہ ایک شہری ریاست اور جرمنی کے قدیم ترین تجارتی شہروں میں سے ایک ہے۔ اس کی پارلیمان <strong>Bremische Bürgerschaft</strong> کہلاتی ہے اور حکومت کا سربراہ <strong>Bürgermeister/in (Senatspräsident/in)</strong> ہوتا ہے۔ بریمن بندرگاہ جرمن تجارت میں اہم کردار ادا کرتی ہے۔',
        de: 'Bremen ist Deutschlands <strong>kleinstes Bundesland nach Einwohnerzahl</strong> und besteht aus zwei Städten: Bremen und Bremerhaven. Als Stadtstaat ist es eine der ältesten Handelsstädte Deutschlands. Das Landesparlament heißt <strong>Bremische Bürgerschaft</strong>, das Staatsoberhaupt ist der/die <strong>Bürgermeister/in (Senatspräsident/in)</strong>. Die Häfen Bremen und Bremerhaven wickeln bedeutende Teile des deutschen Außenhandels ab.',
        ar: 'بريمن هي <strong>أصغر ولاية ألمانية من حيث السكان</strong> وتتألف من مدينتين: بريمن وبريمرهافن. وهي مدينة-ولاية وإحدى أعرق مدن التجارة في ألمانيا. برلمانها يُسمى <strong>Bremische Bürgerschaft</strong> ورئيس حكومتها <strong>Bürgermeister/in (Senatspräsident/in)</strong>. تضطلع موانئها بدور مهم في التجارة الخارجية الألمانية.',
        tr: 'Bremen, Almanya’nın en küçük eyaletidir ve iki şehirden oluşur: Bremen ve Bremerhaven. Eyalet parlamentosu <strong>Bremische Bürgerschaft</strong> adını taşır; hükümet başkanının unvanı <strong>Bürgermeister/in (Senatspräsident/in)</strong>’dir. Bremen, tarihi Bremer Roland heykeli ve UNESCO Dünya Mirası listesindeki pazar alanıyla ünlüdür. Almanya’nın önemli bir ticaret ve liman kentidir.',
        ru: 'Бремен — наименьшая земля Германии по населению, состоит из двух городов: Бремена и Бремерхафена. Парламент называется <strong>Bremische Bürgerschaft</strong>; глава правительства — <strong>Bürgermeister/in (Senatspräsident/in)</strong>. Бремен известен историческим памятником Роланда и рыночной площадью — объектом ЮНЕСКО. Это один из старейших торговых городов Германии.',
    },
    'hamburg': {
        en: 'Hamburg is Germany’s <strong>second-largest city</strong> and a city-state. It is home to Germany’s largest port and is one of the most important trading hubs in Europe. Its parliament is called the <strong>Bürgerschaft</strong> and the head of government is the <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong>. Hamburg has a rich maritime history and is known for the Speicherstadt warehouse district (UNESCO World Heritage Site), the Elbphilharmonie concert hall, and the Reeperbahn entertainment quarter.',
        ur: 'ہیمبرگ جرمنی کا <strong>دوسرا سب سے بڑا شہر</strong> اور ایک شہری ریاست ہے۔ یہ جرمنی کی سب سے بڑی بندرگاہ کا گھر ہے اور یورپ کے اہم ترین تجارتی مراکز میں سے ایک ہے۔ اس کی پارلیمان <strong>Bürgerschaft</strong> ہے اور حکومت کا سربراہ <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong> ہے۔ Speicherstadt (یونیسکو ورثہ)، Elbphilharmonie اور Reeperbahn مشہور مقامات ہیں۔',
        de: 'Hamburg ist Deutschlands <strong>zweitgrößte Stadt</strong> und ein Stadtstaat. Es beherbergt den größten deutschen Hafen und ist eines der wichtigsten Handelszentren Europas. Das Landesparlament heißt <strong>Bürgerschaft</strong>, das Staatsoberhaupt ist der/die <strong>Erste Bürgermeister/in (Senatspräsident/in)</strong>. Die Speicherstadt (UNESCO-Welterbe), die Elbphilharmonie und die Reeperbahn sind bekannte Wahrzeichen.',
        ar: 'هامبورغ هي <strong>ثاني أكبر مدينة في ألمانيا</strong> ومدينة-ولاية. تضمّ أكبر ميناء ألماني وتُعدّ من أهم المراكز التجارية في أوروبا. برلمانها يُسمى <strong>Bürgerschaft</strong> ورئيس حكومتها <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong>. تشتهر بمنطقة Speicherstadt (التراث العالمي لليونسكو) وقاعة Elbphilharmonie الموسيقية.',
        tr: 'Hamburg, Almanya’nın ikinci büyük şehri ve bir şehir-eyaletidir. Eyalet parlamentosu <strong>Bürgerschaft</strong> adını taşır; hükümet başkanının unvanı <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong>’dir. Hamburg Limanı, Almanya’nın en büyük limanıdır. Speicherstadt (Depo Şehri) UNESCO Dünya Mirası’nda yer almaktadır. Şehir, müzik ve kültür alanında da öne çıkmaktadır.',
        ru: 'Гамбург — второй по величине город Германии и самостоятельная земля (город-земля). Парламент называется <strong>Bürgerschaft</strong>; глава правительства — <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong>. Гамбургский порт — крупнейший в Германии. Исторический квартал Шпайхерштадт внесён в список ЮНЕСКО.',
    },
    'hessen': {
        en: 'Hesse (Hessen) is located in central Germany. Its capital is <strong>Wiesbaden</strong>, seat of the <strong>Landtag</strong>, while Frankfurt am Main — though not the capital — is Germany’s financial centre and home to the European Central Bank (ECB) and Frankfurt Stock Exchange (Deutsche Börse). The head of government holds the title of <strong>Ministerpräsident/in</strong>. Hesse is one of Germany’s most economically important states and Frankfurt Airport is a major European hub.',
        ur: 'ہیسن وسطی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>وِسبادن</strong> ہے جہاں <strong>Landtag</strong> قائم ہے، جبکہ فرینکفرٹ — جو دارالحکومت نہیں — جرمنی کا مالیاتی مرکز اور یورپی مرکزی بینک (ECB) اور Frankfurt Stock Exchange کا گھر ہے۔ سربراہ حکومت کا عہدہ <strong>Ministerpräsident/in</strong> ہے۔ ہیسن جرمنی کی اقتصادی اعتبار سے اہم ترین ریاستوں میں سے ایک ہے۔',
        de: 'Hessen liegt in Mitteldeutschland. Die Landeshauptstadt ist <strong>Wiesbaden</strong>, Sitz des <strong>Landtags</strong>. Frankfurt am Main — obwohl nicht Landeshauptstadt — ist Deutschlands Finanzzentrum und Sitz der Europäischen Zentralbank (EZB) und der Deutschen Börse. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>. Der Flughafen Frankfurt ist einer der wichtigsten Drehkreuze Europas.',
        ar: 'تقع هيسن في وسط ألمانيا. عاصمتها <strong>فيسبادن</strong>، مقر <strong>Landtag</strong>. أما فرانكفورت أم ماين — رغم أنها ليست العاصمة — فهي المركز المالي لألمانيا ومقر البنك المركزي الأوروبي (ECB) وبورصة فرانكفورت. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>. مطار فرانكفورت من أهم المحاور الجوية الأوروبية.',
        tr: 'Hessen, Almanya’nın merkezinde yer alır. Eyaletin başkenti <strong>Wiesbaden</strong>’dır; <strong>Landtag</strong> burada toplanır. Almanya’nın finans merkezi olan Frankfurt am Main (Rhein-Main bölgesi), Hessen’de yer alır; Avrupa Merkez Bankası da burada bulunmaktadır. Frankfurt Havalimanı, Avrupa’nın en önemli havalimanlarından biridir. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Гессен расположен в центре Германии. Столица земли — <strong>Висбаден</strong>, где заседает <strong>Landtag</strong>. Финансовый центр Германии — Франкфурт-на-Майне — также находится в Гессене, как и штаб-квартира Европейского центрального банка. Аэропорт Франкфурта — один из важнейших транспортных узлов Европы. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'mecklenburg-vorpommern': {
        en: 'Mecklenburg-Vorpommern is located in northeastern Germany along the Baltic Sea coast. Its capital is <strong>Schwerin</strong>, home to the <strong>Landtag</strong> and the beautiful Schwerin Palace. The state is characterised by its long coastline, thousands of lakes, and the islands of Rügen and Usedom — popular holiday destinations. The head of government holds the title of <strong>Ministerpräsident/in</strong>. Tourism and agriculture are among the key economic sectors.',
        ur: 'میکلنبرگ-فورپومرن شمال مشرقی جرمنی میں بالٹک سمندر کے ساحل پر واقع ہے۔ اس کا دارالحکومت <strong>شوَرین</strong> ہے جہاں <strong>Landtag</strong> اور خوبصورت Schwerin محل ہے۔ یہ ریاست لمبے ساحل، ہزاروں جھیلوں اور جزائر Rügen و Usedom کی وجہ سے مشہور ہے۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> ہے۔ سیاحت اور زراعت اہم اقتصادی شعبے ہیں۔',
        de: 'Mecklenburg-Vorpommern liegt im Nordosten Deutschlands an der Ostseeküste. Die Landeshauptstadt ist <strong>Schwerin</strong>, Sitz des <strong>Landtags</strong> und des prächtigen Schweriner Schlosses. Das Land ist bekannt für seine lange Küstenlinie, tausende Seen und die Inseln Rügen und Usedom. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>. Tourismus und Landwirtschaft sind wichtige Wirtschaftszweige.',
        ar: 'تقع مكلنبورغ-فوربومرن في شمال شرق ألمانيا على ساحل بحر البلطيق. عاصمتها <strong>شفيرين</strong>، مقر <strong>Landtag</strong> وقصر شفيرين الجميل. تتميز بساحلها الطويل وآلاف البحيرات وجزيرتي روغن وأوزيدوم. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>. تُعدّ السياحة والزراعة من أهم قطاعاتها الاقتصادية.',
        tr: 'Mecklenburg-Vorpommern, Almanya’nın kuzeydoğusunda Baltık Denizi kıyısında yer alır. Başkenti <strong>Schwerin</strong>’dir. Rügen ve Usedom gibi adalar, binlerce göl ve balıkçı köyleriyle turizm açısından önemlidir. 1990’daki yeniden birleşmeden önce Doğu Almanya’ya aitti. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Мекленбург-Передняя Померания расположен на севере Германии, на берегу Балтийского моря. Столица — <strong>Шверин (Schwerin)</strong>. Земля известна островами Рюген и Узедом, тысячами озёр и рыбацкими деревнями. До 1990 года входила в состав ГДР. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'niedersachsen': {
        en: 'Lower Saxony (Niedersachsen) is Germany’s <strong>second-largest state by area</strong>, located in northwestern Germany. Its capital is <strong>Hanover (Hannover)</strong>, seat of the <strong>Landtag</strong>. Volkswagen is headquartered in Wolfsburg, making the automotive industry central to the state’s economy. Lower Saxony also has important agricultural land and North Sea coastline. The head of government is the <strong>Ministerpräsident/in</strong>. The Hanover Messe is the world’s largest industrial trade fair.',
        ur: 'نیڈرزاخسن رقبے کے لحاظ سے جرمنی کی <strong>دوسری سب سے بڑی ریاست</strong> ہے اور شمال مغربی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>ہینووَر (Hannover)</strong> ہے جہاں <strong>Landtag</strong> قائم ہے۔ Volkswagen کا صدر دفتر ولفسبرگ میں ہے جو آٹوموبائل صنعت کو مرکزی حیثیت دیتا ہے۔ ریاست کا شمالی سمندری ساحل اور زرعی اراضی بھی اہم ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Niedersachsen ist das <strong>flächenmäßig zweitgrößte Bundesland</strong> Deutschlands im Nordwesten. Die Landeshauptstadt ist <strong>Hannover</strong>, Sitz des <strong>Landtags</strong>. Volkswagen hat seinen Hauptsitz in Wolfsburg, was die Automobilindustrie zu einem zentralen Wirtschaftszweig macht. Das Land hat zudem bedeutende Landwirtschaftsflächen und Nordseeküste. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'سكسونيا السفلى (Niedersachsen) هي <strong>ثاني أكبر ولاية ألمانية من حيث المساحة</strong>، تقع في شمال غرب ألمانيا. عاصمتها <strong>هانوفر (Hannover)</strong>، مقر <strong>Landtag</strong>. يتخذ فولكسفاغن من مقرّه في فولفسبورغ، مما يجعل صناعة السيارات محوراً اقتصادياً أساسياً. تمتلك الولاية أراضي زراعية واسعة وساحلاً على بحر الشمال. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Aşağı Saksonya (Niedersachsen), yüzölçümü bakımından Almanya’nın ikinci büyük eyaletidir. Başkenti <strong>Hannover</strong>’dir. Volkswagen’in merkezi Wolfsburg bu eyalettedir; Hannover’de uluslararası fuar merkezi bulunmaktadır. Lüneburg Heide ve Harz Dağları gibi doğal güzellikler meşhurdur. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Нижняя Саксония (Niedersachsen) — вторая по площади земля Германии. Столица — <strong>Ганновер (Hannover)</strong>. В Вольфсбурге находится штаб-квартира Volkswagen, а в Ганновере — крупнейший международный выставочный центр. Природные ландшафты Люнебургской пустоши и гор Гарц привлекают туристов. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'nordrhein-westfalen': {
        en: 'North Rhine-Westphalia (Nordrhein-Westfalen) is Germany’s <strong>most populous state</strong> with about 18 million inhabitants. Its capital is <strong>Düsseldorf</strong>, home to the <strong>Landtag</strong>. The Rhine-Ruhr metropolitan area is one of the largest urban agglomerations in Europe. Cologne (Köln), Bonn (former West German capital), Dortmund, and Essen are among its major cities. The head of government is the <strong>Ministerpräsident/in</strong>. The state has transitioned from heavy industry to a diverse, modern economy.',
        ur: 'نارڈرائن ویسٹ فالن جرمنی کی <strong>سب سے زیادہ آبادی والی ریاست</strong> ہے جس میں تقریباً 18 ملین افراد رہتے ہیں۔ اس کا دارالحکومت <strong>ڈوسلڈورف</strong> ہے جہاں <strong>Landtag</strong> ہے۔ Rhine-Ruhr میگاسٹی یورپ کی بڑی شہری مجموعات میں سے ایک ہے۔ کولون، بون (سابق مغربی جرمن دارالحکومت)، ڈورٹمنڈ اور ایسن بڑے شہر ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Nordrhein-Westfalen ist Deutschlands <strong>bevölkerungsreichstes Bundesland</strong> mit rund 18 Millionen Einwohnern. Die Landeshauptstadt ist <strong>Düsseldorf</strong>, Sitz des <strong>Landtags</strong>. Die Metropolregion Rhein-Ruhr ist eine der größten städtischen Ballungsräume Europas. Köln, Bonn (ehemalige Hauptstadt der BRD), Dortmund und Essen sind bedeutende Städte. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'شمال الراين-وستفاليا هي <strong>أكثر الولايات الألمانية سكاناً</strong> بحوالي 18 مليون نسمة. عاصمتها <strong>دوسلدورف</strong>، مقر <strong>Landtag</strong>. تُعدّ منطقة الراين-رور الحضرية من أكبر التجمعات العمرانية في أوروبا. كولونيا وبون (العاصمة الغربية السابقة) ودورتموند وإيسن من مدنها البارزة. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Kuzey Ren-Vestfalya, yaklaşık 18 milyon nüfusuyla Almanya’nın en kalabalık eyaletidir. Başkenti <strong>Düsseldorf</strong>’tur. Köln, Dortmund, Essen ve Bonn gibi önemli şehirlere ev sahipliği yapar. Ren-Ruhr bölgesi, Avrupa’nın en büyük kentsel alanlarından biridir. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Северный Рейн-Вестфалия — наиболее населённая земля Германии (~18 млн человек). Столица — <strong>Дюссельдорф (Düsseldorf)</strong>. В земле находятся Кёльн, Дортмунд, Эссен и Бонн. Рейнско-Рурский регион — один из крупнейших городских агломератов Европы. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'rheinland-pfalz': {
        en: 'Rhineland-Palatinate (Rheinland-Pfalz) is located in southwestern Germany. Its capital is <strong>Mainz</strong>, home to the <strong>Landtag</strong> and the famous Gutenberg Museum (Johannes Gutenberg invented movable-type printing here). The Rhine, Moselle, and Nahe rivers run through the state, creating renowned wine-growing regions — Rheinland-Pfalz produces more wine than any other German state. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'رائن لینڈ-فالز جنوب مغربی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>مائنز</strong> ہے جہاں <strong>Landtag</strong> اور مشہور گوٹنبرگ میوزیم ہے (یوہانس گوٹنبرگ نے یہیں حرکی طباعت ایجاد کی)۔ رائن، موزیل اور ناہے دریا اس ریاست سے گزرتے ہیں اور مشہور انگور کے باغات تشکیل دیتے ہیں — رائن لینڈ-فالز کسی بھی دوسری جرمن ریاست سے زیادہ شراب پیدا کرتی ہے۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Rheinland-Pfalz liegt im Südwesten Deutschlands. Die Landeshauptstadt ist <strong>Mainz</strong>, Sitz des <strong>Landtags</strong> und des berühmten Gutenberg-Museums (Johannes Gutenberg erfand hier den Buchdruck). Rhein, Mosel und Nahe prägen die Landschaft und schaffen renommierte Weinbaugebiete — kein anderes Bundesland produziert mehr Wein. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'تقع راينلاند-بفالتس في جنوب غرب ألمانيا. عاصمتها <strong>ماينتس</strong>، مقر <strong>Landtag</strong> ومتحف غوتنبرغ (اخترع يوهانس غوتنبرغ هنا الطباعة بالحروف المتحركة). تشقّها أنهار الراين والموزيل والناهي، مما أفرز مناطق عنب مشهورة — لا تُنتج أي ولاية ألمانية أخرى نبيذاً أكثر منها. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Rheinland-Pfalz, Almanya’nın en önemli şarap üretim eyaletidir; Ren ve Mosel nehirleri burada akar. Başkenti <strong>Mainz</strong>’dir. Matbaa makinesinin mucidi Johannes Gutenberg, Mainz’de dünyaya gelmiştir. UNESCO Dünya Mirası listesindeki Ren Vadisi manzarası meşhurdur. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Рейнланд-Пфальц — главный винодельческий регион Германии; по нему протекают Рейн и Мозель. Столица — <strong>Майнц (Mainz)</strong>. В Майнце родился Иоганн Гутенберг — изобретатель книгопечатания. Долина Рейна внесена в список ЮНЕСКО. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'saarland': {
        en: 'Saarland is Germany’s <strong>smallest non-city-state</strong>, located in the far southwest and bordering both France and Luxembourg. Its capital is <strong>Saarbrücken</strong>, home to the <strong>Landtag</strong>. The state has a strong French cultural influence due to its border location and was under French administration after World War II before joining West Germany in 1957. Its economy has shifted from coal and steel to modern industries. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زارلینڈ جرمنی کی <strong>سب سے چھوٹی غیر شہری ریاست</strong> ہے جو انتہائی جنوب مغرب میں واقع ہے اور فرانس و لکسمبرگ دونوں سے ملتی ہے۔ اس کا دارالحکومت <strong>زاربروکن</strong> ہے جہاں <strong>Landtag</strong> ہے۔ سرحدی مقام کی وجہ سے اس پر فرانسیسی ثقافت کا گہرا اثر ہے۔ یہ دوسری جنگ عظیم کے بعد فرانسیسی انتظام میں رہا اور 1957 میں مغربی جرمنی میں شامل ہوا۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Das Saarland ist Deutschlands <strong>kleinstes Flächenland</strong> im äußersten Südwesten und grenzt an Frankreich und Luxemburg. Die Landeshauptstadt ist <strong>Saarbrücken</strong>, Sitz des <strong>Landtags</strong>. Die Grenznähe zu Frankreich prägt die Kultur stark. Nach dem Zweiten Weltkrieg stand das Saarland unter französischer Verwaltung und trat 1957 der Bundesrepublik bei. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'زارلاند هي <strong>أصغر الولايات الألمانية غير-المدينية</strong>، تقع في أقصى الجنوب الغربي وتحدّها فرنسا ولوكسمبورغ. عاصمتها <strong>زاربروكن</strong>، مقر <strong>Landtag</strong>. يُلاحَظ التأثير الثقافي الفرنسي بوضوح بسبب قربها من الحدود. خضعت بعد الحرب العالمية الثانية للإدارة الفرنسية وانضمت إلى ألمانيا الغربية عام 1957. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Saarland, Almanya’nın en küçük yüzölçümlü şehir olmayan eyaletidir; Fransa ve Lüksemburg ile sınır komşusudur. Başkenti <strong>Saarbrücken</strong>’dır. 1957’de Almanya’ya katılan Saarland, Fransız kültüründen güçlü biçimde etkilenmiştir. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Саар — наименьшая по площади нестоличная земля Германии, граничит с Францией и Люксембургом. Столица — <strong>Саарбрюккен (Saarbrücken)</strong>. В 1957 году Саар вошёл в состав ФРГ и испытал сильное влияние французской культуры. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'sachsen': {
        en: 'Saxony (Sachsen) is located in eastern Germany, bordering Poland and the Czech Republic. Its capital is <strong>Dresden</strong>, home to the <strong>Landtag</strong> and renowned for its Baroque architecture and world-class art collections (Zwinger, Semperoper). Leipzig is another major city, famous as the home of Bach and the site of the 1989 Monday demonstrations that helped bring down the Berlin Wall. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زاخسن مشرقی جرمنی میں واقع ہے اور پولینڈ و چیک ریپبلک سے ملتا ہے۔ اس کا دارالحکومت <strong>ڈریزڈن</strong> ہے جہاں <strong>Landtag</strong> اور بارک فن تعمیر و آرٹ کے عالمی مجموعے (Zwinger، Semperoper) موجود ہیں۔ لائپزگ ایک اور بڑا شہر ہے جو باخ کے گھر اور 1989 کے پیر کے جلوسوں کی وجہ سے مشہور ہے جنہوں نے برلن دیوار گرانے میں مدد کی۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Sachsen liegt in Ostdeutschland und grenzt an Polen und Tschechien. Die Landeshauptstadt ist <strong>Dresden</strong>, Sitz des <strong>Landtags</strong>, bekannt für Barockarchitektur und weltberühmte Kunstsammlungen (Zwinger, Semperoper). Leipzig ist eine weitere Großstadt, bekannt als Heimat von Bach und als Ort der Montagsdemonstrationen 1989. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'تقع ساكسونيا (Sachsen) في شرق ألمانيا، وتحدّها بولندا والجمهورية التشيكية. عاصمتها <strong>دريسدن</strong>، مقر <strong>Landtag</strong>، وتشتهر بعمارتها الباروكية ومجموعاتها الفنية العالمية (Zwinger، Semperoper). لايبزيغ مدينة كبرى أخرى، اشتهرت بكونها موطن باخ ومسرح احتجاجات أيام الاثنين عام 1989. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Saksonya (Sachsen), Doğu Almanya’nın güneyinde Polonya ve Çek Cumhuriyeti ile sınır komşusudur. Başkenti, barok mimarisi ile ünlü <strong>Dresden</strong>’dir. Leipzig, Bach’ın kenti ve 1989 Barışçıl Devrimi’nin merkeziydi. 1990’daki yeniden birleşmeden önce Doğu Almanya’ya aitti. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Саксония (Sachsen) расположена на востоке Германии и граничит с Польшей и Чехией. Столица — <strong>Дрезден (Dresden)</strong>, знаменитый барочной архитектурой. Лейпциг — родина Баха и центр мирных демонстраций 1989 года. До 1990 года входила в состав ГДР. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'sachsen-anhalt': {
        en: 'Saxony-Anhalt (Sachsen-Anhalt) is located in central-eastern Germany. Its capital is <strong>Magdeburg</strong>, home to the <strong>Landtag</strong> and one of Germany’s oldest cathedrals. The state is historically significant as the heartland of the Protestant Reformation — Martin Luther was born in Eisleben and posted his 95 Theses in Wittenberg, both in Sachsen-Anhalt. The Bauhaus art movement was also founded in Dessau. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زاخسن-انہالٹ وسطی مشرقی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>ماگڈبرگ</strong> ہے جہاں <strong>Landtag</strong> اور جرمنی کے قدیم ترین گرجا گھروں میں سے ایک ہے۔ یہ ریاست پروٹسٹنٹ اصلاح کے مرکز کے طور پر تاریخی اہمیت رکھتی ہے — مارٹن لوتھر آئسلیبن میں پیدا ہوئے اور وِٹنبرگ میں اپنے 95 مقالے لگائے، دونوں جگہیں زاخسن-انہالٹ میں ہیں۔ Bauhaus فن تحریک بھی ڈیساؤ میں قائم ہوئی۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Sachsen-Anhalt liegt in Mitteldeutschland. Die Landeshauptstadt ist <strong>Magdeburg</strong>, Sitz des <strong>Landtags</strong> und Heimat eines der ältesten Dome Deutschlands. Das Land ist historisch bedeutsam als Kernland der Reformation — Martin Luther wurde in Eisleben geboren und schlug in Wittenberg seine 95 Thesen an. Das Bauhaus wurde in Dessau gegründet. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'تقع ساكسونيا-أنهالت في وسط شرق ألمانيا. عاصمتها <strong>ماغدبورغ</strong>، مقر <strong>Landtag</strong> وإحدى أقدم الكاتدرائيات في ألمانيا. تتمتع بأهمية تاريخية استثنائية كمهد الإصلاح البروتستانتي — وُلد مارتن لوثر في آيسليبن وعلّق أطروحاته الخمس والتسعين في فيتنبرغ. تأسّست حركة الباوهاوس الفنية في ديساو. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Saksonya-Anhalt (Sachsen-Anhalt), Protestan Reformu’nun beşiğidir; Martin Luther Eisleben’de doğmuş, Wittenberg’de tezlerini yayımlamıştır. Başkenti <strong>Magdeburg</strong>’dur. Bauhaus hareketi Dessau’da doğmuştur (UNESCO Dünya Mirası). Magdeburg Katedrali ve Halberstadt’ın ünlü anıtları önemli kültürel mirastır. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Саксония-Анхальт — колыбель протестантской Реформации: здесь родился Мартин Лютер (Айслебен) и он прибил свои тезисы в Виттенберге. Столица — <strong>Магдебург (Magdeburg)</strong>. В Дессау зародилось движение Баухаус (объект ЮНЕСКО). Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'schleswig-holstein': {
        en: 'Schleswig-Holstein is Germany’s northernmost state, located between the North Sea and the Baltic Sea. Its capital is <strong>Kiel</strong>, home to the <strong>Landtag</strong> and one of Germany’s major naval bases and the start of the Kiel Canal (Nord-Ostsee-Kanal), the world’s busiest artificial waterway. The state borders Denmark to the north. Flensburg and Lübeck (a UNESCO World Heritage city and birthplace of Thomas Mann) are other important cities. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'شلیسوگ-ہولسٹائن جرمنی کی سب سے شمالی ریاست ہے جو شمالی سمندر اور بالٹک سمندر کے درمیان واقع ہے۔ اس کا دارالحکومت <strong>کیل</strong> ہے جہاں <strong>Landtag</strong> اور Kiel نہر (Nord-Ostsee-Kanal) کا آغاز ہوتا ہے — دنیا کی مصروف ترین مصنوعی آبگزر۔ شمال میں ڈنمارک کی سرحد ہے۔ فلنسبرگ اور لوبیک (یونیسکو ورثہ) اہم شہر ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Schleswig-Holstein ist das nördlichste Bundesland Deutschlands, zwischen Nord- und Ostsee gelegen. Die Landeshauptstadt ist <strong>Kiel</strong>, Sitz des <strong>Landtags</strong> und Ausgangspunkt des Nord-Ostsee-Kanals, der meistbefahrenen künstlichen Wasserstraße der Welt. Im Norden grenzt das Land an Dänemark. Flensburg und Lübeck (UNESCO-Welterbe) sind weitere bedeutende Städte. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'شليسفيغ-هولشتاين هي أقصى ولاية شمالية في ألمانيا، تقع بين بحر الشمال وبحر البلطيق. عاصمتها <strong>كيل</strong>، مقر <strong>Landtag</strong> وانطلاق قناة كيل (Nord-Ostsee-Kanal) — أكثر الممرات المائية الاصطناعية ازدحاماً في العالم. تحدّها الدنمارك شمالاً. فلنسبورغ ولوبيك (مدينة التراث العالمي) من مدنها الرئيسية. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Schleswig-Holstein, Almanya’nın en kuzeydeki eyaletidir ve hem Kuzey Denizi hem de Baltık Denizi kıyısına sahiptir. Başkenti <strong>Kiel</strong>’dir. Danimarka ile sınır komşusudur. Kiel Kanalı (Nord-Ostsee-Kanal), dünyanın en yoğun yapay su yoludur. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Шлезвиг-Гольштейн — самая северная земля Германии, омывается Северным и Балтийским морями, граничит с Данией. Столица — <strong>Киль (Kiel)</strong>. Кильский канал (Nord-Ostsee-Kanal) — самый загруженный искусственный водный путь в мире. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
    'thueringen': {
        en: 'Thuringia (Thüringen) is located in central Germany and is often called the <strong>"Green Heart of Germany"</strong> for its dense forests, including the Thuringian Forest (Thüringer Wald). Its capital is <strong>Erfurt</strong>, home to the <strong>Landtag</strong>. The state has exceptional cultural heritage — Weimar was the home of Goethe and Schiller, Eisenach is the birthplace of Johann Sebastian Bach, and Luther translated the New Testament in Wartburg Castle. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'تھیورنگن وسطی جرمنی میں واقع ہے اور اپنے گھنے جنگلات کی وجہ سے <strong>"جرمنی کا سبز دل"</strong> کہلاتا ہے۔ اس کا دارالحکومت <strong>ایرفرٹ</strong> ہے جہاں <strong>Landtag</strong> قائم ہے۔ اس ریاست کا غیر معمولی ثقافتی ورثہ ہے — وائمار گوئٹے اور شِلر کا گھر تھا، ایزناخ یوہان سیباسٹین باخ کی جائے پیدائش ہے، اور لوتھر نے وارٹبرگ قلعے میں نئے عہد نامے کا ترجمہ کیا۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Thüringen liegt in Mitteldeutschland und wird wegen seiner dichten Wälder oft als <strong>„Grünes Herz Deutschlands"</strong> bezeichnet. Die Landeshauptstadt ist <strong>Erfurt</strong>, Sitz des <strong>Landtags</strong>. Das Land besitzt ein außergewöhnliches Kulturerbe — Weimar war die Heimat von Goethe und Schiller, Eisenach ist der Geburtsort Johann Sebastian Bachs, und Luther übersetzte das Neue Testament auf der Wartburg. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
        ar: 'تقع تورينغن في وسط ألمانيا وتُعرف بـ<strong>"القلب الأخضر لألمانيا"</strong> بسبب غاباتها الكثيفة. عاصمتها <strong>إرفورت</strong>، مقر البرلمان الولائي <strong>Landtag</strong>. تتمتع الولاية بإرث ثقافي استثنائي — فايمار كانت موطن غوته وشيلر، وآيزناخ مسقط رأس يوهان سيباستيان باخ، وترجم لوثر العهد الجديد في قلعة فارتبورغ. رئيس الحكومة يحمل لقب <strong>Ministerpräsident/in</strong>.',
        tr: 'Türingya (Thüringen), "Almanya’nın yeşil kalbi" olarak bilinir. Başkenti <strong>Erfurt</strong>’tur. Weimar, Goethe ve Schiller’in yaşadığı ve Weimar Cumhuriyeti’nin anayasasının hazırlandığı şehirdir. Martin Luther İncil’i Wartburg Şatosu’nda Almancaya çevirmiştir. Eisenach, Bach’ın doğduğu şehirdir. Hükümet başkanının unvanı <strong>Ministerpräsident/in</strong>’dir.',
        ru: 'Тюрингия (Thüringen) называется «зелёным сердцем Германии». Столица — <strong>Эрфурт (Erfurt)</strong>. Веймар — город Гёте и Шиллера, где также была принята конституция Веймарской республики. Мартин Лютер переводил Библию в замке Вартбург близ Айзенаха — родины Баха. Глава правительства — <strong>Ministerpräsident/in</strong>.',
    },
};

function buildMetaDesc(lang, title, slug) {
    const descs = META_DESCS[lang] || META_DESCS.en;
    if (descs[slug]) return descs[slug];
    // Fallback for state pages not in ur/de/ar map
    const enDesc = META_DESCS.en[slug];
    if (lang === 'ur' && enDesc) {
        return `${title} — Einbürgerungstest کے ریاستی سوالات اردو ترجمے کے ساتھ۔ مفت تیاری گائیڈ۔`;
    }
    if (lang === 'ar' && enDesc) {
        return `${title} — أسئلة Einbürgerungstest الولائية مع الترجمة العربية. مجاناً.`;
    }
    if (lang === 'de' && enDesc) {
        return `${title} — Einbürgerungstest Länderfragen mit Erklärungen. Kostenlose Prüfungsvorbereitung.`;
    }
    const tagline = (UI[lang] || UI.en).tagline;
    return `${tagline} — ${title}. ${lang === 'en' ? 'Free German citizenship test prep.' : lang === 'de' ? 'Kostenlose Prüfungsvorbereitung.' : lang === 'ar' ? 'مجاني — التحضير لاختبار الجنسية الألمانية.' : lang === 'tr' ? 'Ücretsiz Almanya vatandaşlık sınavı hazırlığı.' : lang === 'ru' ? 'Бесплатная подготовка к тесту на гражданство Германии.' : 'مفت تیاری گائیڈ۔'}`;
}

// Extract FAQ structured data from generated HTML.
// Matches the actual rendered structure: h3 "Question N" → p with English question → table with ✅ → blockquote explanation.
function buildFaqSchema(bodyHtml, lang) {
    // Only generate FAQPage for question-set pages, not state or index pages
    if (!bodyHtml.includes('Question ') && !bodyHtml.includes('سوال ')) return '';
    const questions = [];

    // Split into per-question blocks at each h3
    const blocks = bodyHtml.split(/<h3[^>]*>/);
    for (const block of blocks) {
        if (questions.length >= 8) break; // cap at 8 to keep structured data lean

        // Find English question text from the paragraph (🇬🇧 English: ... part)
        const enMatch = block.match(/English:<\/strong>\s*([\s\S]*?)(?:<\/p>|<br>)/);
        if (!enMatch) continue;
        const questionText = enMatch[1].replace(/<[^>]+>/g, '').trim();
        if (!questionText) continue;

        // Find the correct answer — cell after ✅ cell contains <strong>answer</strong>
        // Pattern: <td>✅</td>\n<td><strong>ANSWER</strong></td>
        const correctMatch = block.match(/<td>✅<\/td>\s*<td><strong>([\s\S]*?)<\/strong><\/td>/);
        if (!correctMatch) continue;
        const correctAnswer = correctMatch[1].replace(/<[^>]+>/g, '').trim();

        // Find explanation from blockquote
        const explMatch = block.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>/);
        const explanation = explMatch
            ? explMatch[1].replace(/<[^>]+>/g, '').replace(/📝\s*(?:Explanation:?\s*)?/g, '').trim()
            : correctAnswer;

        if (questionText && correctAnswer) {
            questions.push({ q: questionText, a: explanation || correctAnswer });
        }
    }
    if (questions.length === 0) return '';

    const faqItems = questions.map(q =>
        `{ "@type": "Question", "name": ${JSON.stringify(q.q)}, "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(q.a)} } }`
    ).join(',\n        ');

    return `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        ${faqItems}
      ]
    }
    </script>`;
}

// ---------- Flag emoji → flag-icons CSS spans ----------
// Chrome on Windows deliberately omits country flag emojis (🇩🇪 🇬🇧 🇵🇰).
// We replace them with spans from the flag-icons library which works in all browsers.
const FLAG_SPANS = {
    '🇩🇪': '<span class="fi fi-de" role="img" aria-label="Germany" title="Germany"></span>',
    '🇬🇧': '<span class="fi fi-gb" role="img" aria-label="United Kingdom" title="UK"></span>',
    '🇵🇰': '<span class="fi fi-pk" role="img" aria-label="Pakistan" title="Pakistan"></span>',
    '🇸🇦': '<span class="fi fi-sa" role="img" aria-label="Arabic" title="Arabic"></span>',
};
function applyFlagIcons(html) {
    return html
        .replace(/🇩🇪/g, FLAG_SPANS['🇩🇪'])
        .replace(/🇬🇧/g, FLAG_SPANS['🇬🇧'])
        .replace(/🇵🇰/g, FLAG_SPANS['🇵🇰']);
}

// ---------- Bilingual table injection (TR / RU) ----------
// Transforms German-only question tables into two-column German|Translation tables.
// QUESTIONS_MAP: { "1": { q: "...", opts: ["a","b","c","d"] }, ... }
// lang: "tr" | "ru"
function injectBilingualTable(bodyHtml, QUESTIONS_MAP, lang) {
    if (!QUESTIONS_MAP || Object.keys(QUESTIONS_MAP).length === 0) return bodyHtml;

    const langLabel  = lang === 'tr' ? 'Türkçe'  : 'Русский';
    const flagClass  = lang === 'tr' ? 'fi-tr'   : 'fi-ru';
    const countryName= lang === 'tr' ? 'Türkiye' : 'Russia';

    // Match each question block: h3, optional German question paragraph, then the answer table.
    // The lookahead (?![\s\S]*<h3) keeps us from crossing into the next question.
    const BLOCK_RE = /(<h3 id="q-(\d+)">[^<]*<\/h3>)((?:(?!<h3 id=)[\s\S])*?)(<div class="table-wrap"><table>[\s\S]*?<\/table><\/div>)/g;

    return bodyHtml.replace(BLOCK_RE, (match, h3, qid, between, table) => {
        // State question IDs (301–310) must NOT use the general questions dictionary —
        // their answer options are state-specific and different from general Q303 etc.
        if (parseInt(qid, 10) > 300) return match;
        const entry = QUESTIONS_MAP[qid] || QUESTIONS_MAP[parseInt(qid, 10)];
        if (!entry || !entry.q || !entry.opts || entry.opts.length === 0) return match;

        const { q: translatedQ, opts: translatedOpts } = entry;

        // 1. Add translated question paragraph after the German one
        const translatedQpara = `<p><strong><span class="fi ${flagClass}" role="img" aria-label="${countryName}" title="${countryName}"></span> ${langLabel}:</strong> ${translatedQ}</p>`;

        // 2. Expand table header: <th>Deutsch</th> → <th>Deutsch</th><th>LangName</th>
        let newTable = table.replace(
            /<th>Deutsch<\/th>/,
            `<th>Deutsch</th><th>${langLabel}</th>`
        );

        // 3. Add translated answer to each tbody row.
        // Rows look like: <tr><td>○</td><td>German answer</td></tr>
        // or: <tr><td>✅</td><td><strong>German answer</strong></td></tr>
        let optIndex = 0;
        newTable = newTable.replace(
            /(<tr>\s*<td[^>]*>(?:○|✅|<input[^>]*>)<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>\s*<\/tr>)/g,
            (rowMatch, tdOpen, deContent, tdClose) => {
                const translation = translatedOpts[optIndex] || '';
                optIndex++;
                // If German answer is bold (<strong>), translation is also bold
                const isCorrect = /<strong>/.test(deContent);
                const translatedCell = isCorrect
                    ? `<td><strong>${translation}</strong></td>`
                    : `<td>${translation}</td>`;
                return `${tdOpen}${deContent}${tdClose.replace('</td>', '')}${translatedCell}</td></tr>`.replace('</td></td>', '</td>');
            }
        );

        // Simpler approach — the row closer regex left artefacts, redo cleanly
        // Actually reset and do a cleaner row-level replace
        optIndex = 0;
        newTable = table
            .replace(/<th>Deutsch<\/th>/, `<th>Deutsch</th><th>${langLabel}</th>`)
            .replace(/<\/tr>/g, () => {
                // Only replace tbody rows (ones with ○ or ✅), not thead rows
                return '</tr>__ROWEND__';
            });

        // Start fresh with a clean approach
        optIndex = 0;
        let newTableClean = table
            .replace(/<th>Deutsch<\/th>/, `<th>Deutsch</th><th>${langLabel}</th>`);

        // Now add translation <td> to each <tbody> row
        newTableClean = newTableClean.replace(
            /(<tr>[\s\S]*?<\/tr>)/g,
            (rowFull) => {
                // Skip header rows (contain <th>)
                if (rowFull.includes('<th>')) return rowFull;
                const translation = translatedOpts[optIndex] || '';
                optIndex++;
                const isCorrect = /<strong>/.test(rowFull);
                const translatedCell = isCorrect
                    ? `<td><strong>${translation}</strong></td>`
                    : `<td>${translation}</td>`;
                // Insert translation <td> before closing </tr>
                return rowFull.replace(/<\/tr>$/, `${translatedCell}</tr>`);
            }
        );

        return `${h3}\n${between || ''}${translatedQpara}\n${newTableClean}`;
    });
}

// ---------- Closable / collapsible "Install as app" top bar ----------
// Shown only on each language's home page (slug === 'index').
function renderPwaBar(lang) {
    const ui = UI[lang] || UI.en;
    const dir = (lang === 'ur' || lang === 'ar') ? 'rtl' : 'ltr';
    return `
    <div id="installBanner" class="install-banner-wrap" style="display:none;" dir="${dir}">
        <div class="container">
            <div class="install-banner">
                <div class="install-banner-bar">
                    <span class="install-banner-icon">📱</span>
                    <span class="install-banner-text">${escapeHtml(ui.pwaTitle)}</span>
                </div>
                <button type="button" id="installBannerClose" class="install-banner-close" aria-label="${escapeHtml(ui.pwaClose)}">✕</button>
                <div id="installBannerPanel" class="install-banner-panel">
                    <div class="row g-2">
                        <div class="col-6 col-lg-3">
                            <div class="install-banner-card"><div class="install-banner-card-title">🍎 ${escapeHtml(ui.pwaIphone)}</div><div>${escapeHtml(ui.pwaIphoneSteps)}</div></div>
                        </div>
                        <div class="col-6 col-lg-3">
                            <div class="install-banner-card"><div class="install-banner-card-title">🤖 ${escapeHtml(ui.pwaAndroid)}</div><div>${escapeHtml(ui.pwaAndroidSteps)}</div></div>
                        </div>
                        <div class="col-6 col-lg-3">
                            <div class="install-banner-card"><div class="install-banner-card-title">🖥️ ${escapeHtml(ui.pwaMac)}</div><div>${escapeHtml(ui.pwaMacSteps)}</div></div>
                        </div>
                        <div class="col-6 col-lg-3">
                            <div class="install-banner-card"><div class="install-banner-card-title">🪟 ${escapeHtml(ui.pwaWindows)}</div><div>${escapeHtml(ui.pwaWindowsSteps)}</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <style>
        .install-banner-wrap { background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%); color: #fff; }
        .install-banner { position: relative; padding: .5rem 2.2rem .5rem .25rem; }
        .install-banner-bar { display: flex; align-items: center; gap: .5rem; width: 100%; padding: .2rem .25rem; font-size: .85rem; }
        .install-banner-icon { font-size: 1.1rem; line-height: 1; }
        .install-banner-text { font-weight: 600; flex: 1; }
        .install-banner-close {
            position: absolute;
            ${dir === 'rtl' ? 'left' : 'right'}: .35rem;
            top: .35rem;
            background: none;
            border: none;
            color: #fff;
            opacity: .7;
            font-size: 1rem;
            line-height: 1;
            cursor: pointer;
            padding: .2rem .4rem;
        }
        .install-banner-close:hover { opacity: 1; }
        .install-banner-panel { padding-top: .5rem; }
        .install-banner-card {
            background: rgba(255,255,255,.15);
            border-radius: .6rem;
            padding: .5rem .7rem;
            font-size: .78rem;
            line-height: 1.4;
            height: 100%;
            text-align: ${dir === 'rtl' ? 'right' : 'left'};
        }
        .install-banner-card-title { font-weight: 700; margin-bottom: .15rem; }
    </style>
    <script>
    (function () {
        var KEY = 'leben_install_banner_dismissed';
        var banner = document.getElementById('installBanner');
        if (!banner) return;
        var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
        var dismissed = false;
        try { dismissed = localStorage.getItem(KEY) === '1'; } catch (e) {}
        if (isStandalone || dismissed) return;
        banner.style.display = 'block';
        var closeBtn = document.getElementById('installBannerClose');
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            try { localStorage.setItem(KEY, '1'); } catch (e2) {}
            banner.style.display = 'none';
        });
    })();
    </script>`;
}

// ---------- Closable "Learn Deutsch at wordFeather" top banner ----------
// Shown on EVERY page (not just the homepage) — this is the primary
// upsell surface since footer links get very little visibility.
function renderWordfeatherBanner(lang) {
    const ui = UI[lang] || UI.en;
    const dir = (lang === 'ur' || lang === 'ar') ? 'rtl' : 'ltr';
    return `
    <div class="wf-banner" id="wfBanner" dir="${dir}">
        <div class="wf-banner-inner">
            <span class="wf-banner-icon">📚</span>
            <span class="wf-banner-text">${escapeHtml(ui.wfBannerText)}</span>
            <a class="wf-banner-cta" href="${WORDFEATHER_URL}" target="_blank" rel="noopener">${escapeHtml(ui.wfBannerCta)}</a>
            <button class="wf-banner-close" id="wfBannerClose" aria-label="${escapeHtml(ui.pwaClose)}">×</button>
        </div>
    </div>
    <style>
        .wf-banner {
            background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
            color: #fff;
            padding: 0.55rem 1.25rem;
        }
        [data-bs-theme="dark"] .wf-banner {
            background: linear-gradient(135deg, #1e3a8a 0%, #6d28d9 100%);
        }
        .wf-banner-inner {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            max-width: 900px;
            margin: 0 auto;
            flex-wrap: wrap;
        }
        .wf-banner-icon { font-size: 1rem; flex-shrink: 0; }
        .wf-banner-text { flex: 1 1 auto; font-size: 0.85rem; font-weight: 500; min-width: 12rem; }
        .wf-banner-cta {
            background: rgba(255,255,255,0.2);
            color: #fff;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.82rem;
            padding: 0.3rem 0.75rem;
            border-radius: 0.4rem;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .wf-banner-cta:hover { background: rgba(255,255,255,0.32); }
        .wf-banner-close {
            background: rgba(255,255,255,0.18);
            border: 0;
            color: #fff;
            border-radius: 0.4rem;
            width: 1.6rem;
            height: 1.6rem;
            font-size: 0.95rem;
            line-height: 1;
            cursor: pointer;
            flex-shrink: 0;
        }
        .wf-banner-close:hover { background: rgba(255,255,255,0.3); }
        .wf-banner.wf-banner-hidden { display: none; }
    </style>
    <script>
    (function () {
        var bar = document.getElementById('wfBanner');
        if (!bar) return;
        var closeBtn = document.getElementById('wfBannerClose');
        var dismissed = false;
        try { dismissed = localStorage.getItem('wfBannerDismissed') === '1'; } catch (e) {}
        if (dismissed) {
            bar.classList.add('wf-banner-hidden');
            return;
        }
        closeBtn.addEventListener('click', function () {
            bar.classList.add('wf-banner-hidden');
            try { localStorage.setItem('wfBannerDismissed', '1'); } catch (e) {}
        });
    })();
    </script>`;
}

// ---------- HTML template ----------
function renderPage({ lang, title, bodyHtml, slug }) {
    const ui = UI[lang] || UI.en;
    const dir = (lang === 'ur' || lang === 'ar') ? 'rtl' : 'ltr';

    // Local self-hosted fonts — served from /fonts/ at site root.
    // Pages are in /en/, /ur/, or /ar/ subdirectories so path is ../fonts/
    const urduFont = lang === 'ur'
        ? `<style>
    @font-face {
        font-family: 'Jameel Noori Nastaleeq';
        src: url('../fonts/JameelNooriNastaleeq.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }
    /* Optical size correction — Jameel Noori Nastaleeq renders visually smaller
       than Inter at equal CSS sizes (smaller cap-height relative to em square).
       Scaling the root font-size up proportionally compensates all rem-based sizes. */
    html { font-size: 130%; }
    </style>`
        : lang === 'ar'
        ? `<style>
    @font-face {
        font-family: 'Indopak Nastaleeq';
        src: url('../fonts/Indopak-nastaleeq-hanafi-normal-v4.2.2-with-waqf-lazmi.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }
    html { font-size: 125%; }
    </style>`
        : '';
    const bodyFont = lang === 'ur'
        ? `font-family: 'Jameel Noori Nastaleeq', serif; line-height: 2;`
        : lang === 'ar'
        ? `font-family: 'Indopak Nastaleeq', serif; line-height: 2;`
        : `font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.7;`;

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${slug === 'index' ? escapeHtml(ui.siteTitle) : `${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}`}</title>
    <meta name="description" content="${escapeHtml(buildMetaDesc(lang, title, slug))}">
    <meta name="description" lang="de" content="${escapeHtml(buildMetaDesc('de', TITLES.en[slug] || title, slug))}">
    <link rel="canonical" href="${SITE_BASE_URL}/${lang}/${slug}.html">

    <!-- hreflang: tell Google these are the same page in different languages -->
    <link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/${slug}.html">
    <link rel="alternate" hreflang="de" href="${SITE_BASE_URL}/de/${slug}.html">
    <link rel="alternate" hreflang="tr" href="${SITE_BASE_URL}/tr/${slug}.html">
    <link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/${slug}.html">
    <link rel="alternate" hreflang="ar" href="${SITE_BASE_URL}/ar/${slug}.html">
    <link rel="alternate" hreflang="ru" href="${SITE_BASE_URL}/ru/${slug}.html">
    <link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/${slug}.html">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${SITE_BASE_URL}/${lang}/${slug}.html">
    <meta property="og:title" content="${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}">
    <meta property="og:description" content="${escapeHtml(ui.tagline)}">
    <meta property="og:image" content="${OG_IMAGE_URL}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="${lang === 'en' ? 'en_US' : lang === 'ar' ? 'ar_SA' : lang === 'de' ? 'de_DE' : lang === 'tr' ? 'tr_TR' : lang === 'ru' ? 'ru_RU' : 'ur_PK'}">
    <meta property="og:site_name" content="${escapeHtml(ui.siteTitle)}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}">
    <meta name="twitter:description" content="${escapeHtml(ui.tagline)}">
    <meta name="twitter:image" content="${OG_IMAGE_URL}">

    <!-- Feature 13: dark-mode OG image variant removed — only a single og-image.png exists in icons/ -->

    <!-- PWA -->
    <link rel="manifest" href="../manifest.webmanifest">
    <meta name="theme-color" content="#1d4ed8">
    <meta name="application-name" content="DE Test">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="DE Test">

    <!-- Standard favicons (browser tabs) -->
    <link rel="icon" href="../icons/favicon.ico" sizes="48x48">
    <link rel="icon" type="image/png" sizes="16x16" href="../icons/16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="../icons/32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="../icons/48.png">
    <link rel="icon" type="image/png" sizes="192x192" href="../icons/192.png">
    <link rel="shortcut icon" href="../icons/favicon.ico">

    <!-- Apple touch icons (iOS home screen, all common device sizes) -->
    <link rel="apple-touch-icon" href="../icons/180.png">
    <link rel="apple-touch-icon" sizes="57x57" href="../icons/57.png">
    <link rel="apple-touch-icon" sizes="60x60" href="../icons/60.png">
    <link rel="apple-touch-icon" sizes="72x72" href="../icons/72.png">
    <link rel="apple-touch-icon" sizes="76x76" href="../icons/76.png">
    <link rel="apple-touch-icon" sizes="114x114" href="../icons/114.png">
    <link rel="apple-touch-icon" sizes="120x120" href="../icons/120.png">
    <link rel="apple-touch-icon" sizes="144x144" href="../icons/144.png">
    <link rel="apple-touch-icon" sizes="152x152" href="../icons/152.png">
    <link rel="apple-touch-icon" sizes="180x180" href="../icons/180.png">

    <!-- Android / Chrome (primarily served via manifest.webmanifest, direct links as fallback) -->
    <link rel="icon" type="image/png" sizes="512x512" href="../icons/512.png">

    <!-- Windows tiles -->
    <meta name="msapplication-TileColor" content="#1d4ed8">
    <meta name="msapplication-TileImage" content="../icons/144.png">
    <meta name="msapplication-square70x70logo" content="../icons/70.png">
    <meta name="msapplication-square150x150logo" content="../icons/150.png">
    <meta name="msapplication-square310x310logo" content="../icons/310.png">
    <meta name="msapplication-config" content="none">

    <!-- Structured Data: BreadcrumbList + WebPage -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "${escapeHtml(ui.siteTitle)}", "item": "${SITE_BASE_URL}/" },
            { "@type": "ListItem", "position": 2, "name": "${escapeHtml(title)}", "item": "${SITE_BASE_URL}/${lang}/${slug}.html" }
          ]
        },
        {
          "@type": "WebPage",
          "@id": "${SITE_BASE_URL}/${lang}/${slug}.html",
          "url": "${SITE_BASE_URL}/${lang}/${slug}.html",
          "name": "${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}",
          "description": "${escapeHtml(buildMetaDesc(lang, title, slug))}",
          "inLanguage": "${lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : lang === 'de' ? 'de' : lang === 'tr' ? 'tr' : lang === 'ru' ? 'ru' : 'ur-PK'}",
          "isPartOf": { "@id": "${SITE_BASE_URL}/" },
          "publisher": {
            "@type": "Person",
            "name": "Abdullah Butt",
            "url": "${GITHUB_URL}"
          }
        }
      ]
    }
    </script>
    ${buildFaqSchema(bodyHtml, lang)}

    <script>
        // Anti-flash: apply saved theme before any paint happens
        (function () {
            try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || t === 'light') {
                    document.documentElement.setAttribute('data-bs-theme', t);
                }
            } catch (e) {}
        })();
    </script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    ${urduFont}
    <style>
        :root {
            --page-bg: #f5f7fb;
            --page-text: #1f2937;
            --muted-text: #475569;
            --card-bg: #ffffff;
            --card-shadow: 0 0.5rem 1.5rem rgba(15, 23, 42, 0.08);
            --primary: #1d4ed8;
            --primary-hover: #1e40af;
            --border: #e5e7eb;
            --table-stripe: #f8fafc;
            --table-hover: #eaf3ff;
        }
        [data-bs-theme="dark"] {
            --page-bg: #0b1121;
            --page-text: #e2e8f0;
            --muted-text: #94a3b8;
            --card-bg: #111827;
            --card-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.45);
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --border: #1f2937;
            --table-stripe: #172033;
            --table-hover: #1f2a44;
        }
        body {
            background: var(--page-bg);
            color: var(--page-text);
            ${bodyFont}
        }
        .site-nav {
            background: var(--card-bg);
            border-bottom: 1px solid var(--border);
            padding: 0.75rem 1rem;
            position: sticky;
            top: 0;
            z-index: 1030;
        }
        .site-nav .brand {
            font-weight: 800;
            color: var(--page-text);
            text-decoration: none;
        }
        .nav-actions { display: flex; gap: 0.5rem; align-items: center; }
        .lang-dropdown {
            position: relative;
            display: inline-block;
        }
        .lang-dropdown-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            background: var(--card-bg);
            border: 1.5px solid var(--border);
            border-radius: 999px;
            padding: 0.28rem 0.75rem;
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--text);
            cursor: pointer;
            white-space: nowrap;
            transition: border-color 0.15s;
        }
        .lang-dropdown-btn:hover { border-color: var(--primary); }
        .lang-dropdown-menu {
            display: none;
            position: absolute;
            right: 0;
            top: calc(100% + 6px);
            background: var(--card-bg);
            border: 1.5px solid var(--border);
            border-radius: 0.6rem;
            min-width: 160px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            z-index: 999;
            overflow: hidden;
        }
        .lang-dropdown-menu a {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.55rem 0.9rem;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text);
            text-decoration: none;
            transition: background 0.1s;
        }
        .lang-dropdown-menu a:hover { background: color-mix(in srgb,var(--primary) 8%,var(--card-bg)); }
        .lang-dropdown-menu a.active {
            background: color-mix(in srgb,var(--primary) 12%,var(--card-bg));
            color: var(--primary);
            font-weight: 700;
        }
        .lang-dropdown.open .lang-dropdown-menu { display: block; }
            background: transparent;
            border: 1px solid var(--border);
            color: var(--page-text);
            border-radius: 999px;
            padding: 0.35rem 0.9rem;
            font-size: 0.875rem;
            text-decoration: none;
            cursor: pointer;
        }
        .nav-actions .btn-lang:hover, .nav-actions .btn-theme:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        /* Quiz button — solid accent so it stands out from the other nav items */
        .nav-actions .btn-quiz {
            background: var(--primary);
            color: #fff;
            border: 1px solid var(--primary);
            border-radius: 999px;
            padding: 0.35rem 0.9rem;
            font-size: 0.875rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
        }
        .nav-actions .btn-quiz:hover {
            background: var(--primary-hover);
            border-color: var(--primary-hover);
            color: #fff;
        }
        main {
            max-width: 960px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .content-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 1rem;
            box-shadow: var(--card-shadow);
            padding: clamp(1.25rem, 3vw, 2.5rem);
        }
        .content-card img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1rem auto;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
        }
        h1, h2, h3, h4 {
            color: var(--page-text);
            font-weight: 700;
        }
        h1 { margin-bottom: 1.25rem; }
        h2 { margin-top: 2rem; margin-bottom: 1rem; }
        .table-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 1rem 0 1.5rem;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            background: var(--card-bg);
        }
        .table-wrap table {
            margin: 0;
            border: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0 1.5rem;
            background: var(--card-bg);
            table-layout: auto;
        }
        table th, table td {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            vertical-align: top;
            overflow-wrap: anywhere;
            word-break: normal;
            hyphens: auto;
            min-width: 0;
        }
        table th {
            background: var(--primary);
            color: #fff;
            text-align: ${dir === 'rtl' ? 'right' : 'left'};
            white-space: nowrap;
        }
        table tr:nth-child(even) td { background: var(--table-stripe); }
        table tr:hover td { background: var(--table-hover); }

        /* On Urdu (RTL) pages, column 1 = ✅/○ (center),
           column 2 = German text (must stay LTR + left-aligned),
           column 3 = Urdu text (RTL, right-aligned via page direction).
           Without this fix, dir="rtl" on <html> makes the German column
           also right-aligned, which looks broken. */
        [dir="rtl"] table td:nth-child(2),
        [dir="rtl"] table th:nth-child(2) {
            direction: ltr;
            text-align: left;
        }
        [dir="rtl"] table td:nth-child(1),
        [dir="rtl"] table th:nth-child(1) {
            text-align: center;
        }
        /* Ensure all table cells on Urdu/Arabic pages use the Nastaleeq font,
           not a Bootstrap-overridden fallback */
        [dir="rtl"] table td,
        [dir="rtl"] table th {
            font-family: ${lang === 'ur' ? "'Jameel Noori Nastaleeq'" : lang === 'ar' ? "'Indopak Nastaleeq'" : 'inherit'}, serif;
        }
        [dir="rtl"] table td:nth-child(2),
        [dir="rtl"] table th:nth-child(2) {
            font-family: 'Inter', system-ui, sans-serif;
        }

        @media (max-width: 720px) {
            .table-wrap table {
                min-width: 540px;
            }
            table th, table td {
                padding: 0.6rem 0.75rem;
                font-size: 0.92rem;
            }
        }
        code {
            background: var(--table-stripe);
            padding: 0.15rem 0.4rem;
            border-radius: 0.25rem;
            color: var(--primary);
        }
        a { color: var(--primary); }
        a:hover { color: var(--primary-hover); }
        blockquote {
            border-${dir === 'rtl' ? 'right' : 'left'}: 4px solid var(--primary);
            margin: 1rem 0;
            padding: 0.5rem 1rem;
            background: var(--table-stripe);
            color: var(--muted-text);
        }
        footer {
            margin-top: 3rem;
            padding: 1.75rem 1rem 1.5rem;
            background: var(--card-bg);
            border-top: 1px solid var(--border);
            color: var(--muted-text);
            font-size: 0.9rem;
        }
        footer .foot-row {
            max-width: 960px;
            margin: 0 auto;
            padding: 0 1rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
            justify-content: space-between;
        }
        footer .foot-brand .title {
            font-weight: 600;
            color: var(--page-text);
            margin-bottom: 0.15rem;
        }
        footer .foot-brand .sub {
            font-size: 0.85rem;
        }
        footer .foot-links {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: center;
        }
        footer .btn-foot {
            display: inline-block;
            padding: 0.35rem 0.85rem;
            border-radius: 0.4rem;
            border: 1px solid var(--border);
            color: var(--muted-text);
            text-decoration: none;
            font-size: 0.85rem;
            background: transparent;
        }
        footer .btn-foot:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        footer .btn-foot.foot-highlight {
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            color: #fff;
            border-color: transparent;
            font-weight: 700;
            padding: 0.4rem 1rem;
            box-shadow: 0 2px 10px rgba(234,88,12,0.35);
        }
        footer .btn-foot.foot-highlight:hover {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
            transform: translateY(-1px);
        }
        footer .btn-foot.foot-wordfeather {
            background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
            color: #fff;
            border-color: transparent;
            font-weight: 700;
            padding: 0.4rem 1rem;
        }
        footer .btn-foot.foot-wordfeather:hover {
            background: linear-gradient(135deg, #7c3aed 0%, #1d4ed8 100%);
            transform: translateY(-1px);
        }
        footer .foot-meta {
            max-width: 960px;
            margin: 1rem auto 0;
            padding: 0 1rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--muted-text);
        }
        @media (max-width: 600px) {
            footer .foot-row { flex-direction: column; text-align: center; gap: 0.75rem; }
            footer .foot-links { justify-content: center; }
        }
        footer a { text-decoration: none; }
        .nav-pager {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
            align-items: center;
            justify-content: space-between;
            margin: 1.25rem 0;
            padding: 0.85rem 1rem;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 0.65rem;
        }
        .nav-pager .pager-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.5rem 0.9rem;
            background: transparent;
            color: var(--page-text);
            border: 1px solid var(--border);
            border-radius: 0.45rem;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .nav-pager .pager-btn:hover:not(.disabled) {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        .nav-pager .pager-btn.disabled {
            opacity: 0.4;
            pointer-events: none;
            cursor: not-allowed;
        }
        .nav-pager .pager-jump {
            flex: 1 1 200px;
            min-width: 0;
        }
        .nav-pager--jump-only .pager-jump {
            flex: 1 1 auto;
            width: 100%;
        }
        .nav-pager .pager-jump select {
            width: 100%;
            padding: 0.5rem 0.75rem;
            background: var(--card-bg);
            color: var(--page-text);
            border: 1px solid var(--border);
            border-radius: 0.45rem;
            font-size: 0.9rem;
            font-family: inherit;
            cursor: pointer;
        }
        .nav-pager .pager-jump select:focus {
            outline: 2px solid var(--primary);
            outline-offset: 1px;
        }
        @media (max-width: 600px) {
            .nav-pager { gap: 0.5rem; }
            .nav-pager .pager-btn { font-size: 0.85rem; padding: 0.45rem 0.7rem; }
        }
        /* ── Progress tracker ────────────────────────────── */
        .mark-learned-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            margin: 0.5rem 0 1.25rem;
            padding: 0.35rem 0.85rem;
            font-size: 0.82rem;
            font-weight: 600;
            border-radius: 999px;
            border: 1.5px solid var(--border);
            background: transparent;
            color: var(--muted-text);
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
        }
        .mark-learned-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        .mark-learned-btn.learned {
            background: #059669;
            border-color: #059669;
            color: #fff;
        }
        .mark-learned-btn.learned:hover {
            background: #047857;
            border-color: #047857;
        }
        /* Progress bar on index page */
        .progress-tracker {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            margin-bottom: 1.5rem;
        }
        .progress-tracker .pt-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 0.6rem;
            color: var(--page-text);
        }
        .progress-tracker .pt-pct {
            color: var(--primary);
            font-size: 0.95rem;
        }
        .progress-tracker .pt-bar-bg {
            background: var(--border);
            border-radius: 999px;
            height: 10px;
            overflow: hidden;
            margin-bottom: 0.6rem;
        }
        .progress-tracker .pt-bar-fill {
            height: 100%;
            background: #059669;
            border-radius: 999px;
            transition: width 0.4s ease;
            min-width: 0;
        }
        .progress-tracker .pt-reset {
            font-size: 0.78rem;
            color: var(--muted-text);
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            text-decoration: underline;
        }
        .progress-tracker .pt-reset:hover { color: var(--primary); }
        .back-to-top {
            position: fixed;
            bottom: 1.5rem;
            ${dir === 'rtl' ? 'left' : 'right'}: 1.5rem;
            width: 3.25rem;
            height: 3.25rem;
            border-radius: 50%;
            background: var(--primary);
            color: #fff;
            border: 2px solid var(--card-bg);
            font-size: 1.5rem;
            font-weight: 700;
            box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.35);
            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transform: translateY(0.5rem);
            transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
            z-index: 1050;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
        .back-to-top.visible {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .back-to-top:hover { background: var(--primary-hover); }

        /* Feature 9 — Report error button */
        .report-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-top: 2rem;
            padding: 0.45rem 0.9rem;
            font-size: 0.85rem;
            color: var(--muted-text);
            border: 1px solid var(--border);
            border-radius: 0.4rem;
            text-decoration: none;
            background: transparent;
        }
        .report-btn:hover {
            color: #dc2626;
            border-color: #dc2626;
        }

        /* Feature 8 — Print / Save as PDF styles */
        @media print {
            .site-nav, .nav-pager, .back-to-top, footer,
            .report-btn, .mark-learned-btn, .progress-tracker,
            #updateBanner, #installHint, #pwaBar { display: none !important; }
            body { background: #fff; color: #000; font-size: 11pt; }
            .content-card {
                box-shadow: none;
                border: none;
                padding: 0;
            }
            main { max-width: 100%; margin: 0; padding: 0; }
            table th { background: #1d4ed8 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            a { color: #000; text-decoration: none; }
            a[href]::after { content: ''; } /* suppress URL printing */
            h1, h2, h3 { page-break-after: avoid; }
            table { page-break-inside: avoid; }
            .table-wrap { overflow: visible; }
        }
    </style>
</head>
<body>
    <nav class="site-nav">
        <div class="container-fluid d-flex justify-content-between align-items-center">
            <a class="brand" href="./index.html">${escapeHtml(ui.siteTitle)}</a>
            <div class="nav-actions">
                <a class="btn-quiz" href="../quiz.html?lang=${lang}" title="Practice Quiz">🎯 Quiz</a>
                <div class="lang-dropdown" id="langDrop">
                    <button class="lang-dropdown-btn" onclick="document.getElementById('langDrop').classList.toggle('open')" aria-haspopup="true" aria-label="${escapeHtml(ui.pickerHint)}">
                        ${lang === 'en' ? '<span class="fi fi-gb"></span> EN'
                        : lang === 'ur' ? '<span class="fi fi-pk"></span> UR'
                        : lang === 'ar' ? '<span class="fi fi-sa"></span> AR'
                        : lang === 'tr' ? '<span class="fi fi-tr"></span> TR'
                        : lang === 'ru' ? '<span class="fi fi-ru"></span> RU'
                        : '<span class="fi fi-de"></span> DE'} ▾
                    </button>
                    <div class="lang-dropdown-menu" role="menu">
                        <a href="../en/${slug}.html" ${lang === 'en' ? 'class="active"' : ''} role="menuitem"><span class="fi fi-gb"></span> English</a>
                        <a href="../de/${slug}.html" ${lang === 'de' ? 'class="active"' : ''} role="menuitem"><span class="fi fi-de"></span> Deutsch</a>
                        <a href="../tr/${slug}.html" ${lang === 'tr' ? 'class="active"' : ''} role="menuitem"><span class="fi fi-tr"></span> Türkçe</a>
                        <a href="../ru/${slug}.html" ${lang === 'ru' ? 'class="active"' : ''} role="menuitem"><span class="fi fi-ru"></span> Русский</a>
                        <a href="../ur/${slug}.html" ${lang === 'ur' ? 'class="active"' : ''} role="menuitem" style="font-family:'Jameel Noori Nastaleeq',serif;font-size:1.05rem;"><span class="fi fi-pk"></span> اردو</a>
                        <a href="../ar/${slug}.html" ${lang === 'ar' ? 'class="active"' : ''} role="menuitem" style="font-family:'Indopak Nastaleeq',serif;font-size:1.05rem;"><span class="fi fi-sa"></span> عربي</a>
                    </div>
                </div>
                <button class="btn-theme" id="themeToggle" aria-label="Toggle theme">🌓</button>
            </div>
        </div>
    </nav>
    ${slug === 'index' ? renderPwaBar(lang) : renderWordfeatherBanner(lang)}
    <script>
    // Close lang dropdown when clicking outside
    document.addEventListener('click', function(e) {
        var d = document.getElementById('langDrop');
        if (d && !d.contains(e.target)) d.classList.remove('open');
    });
    </script>

    <main>
        <p><a href="${slug === 'index' ? '../index.html?stay' : './index.html'}">${escapeHtml(slug === 'index' ? ui.changeLang : ui.back)}</a></p>
        ${renderNavPager({ lang, slug })}
        <article class="content-card">
            ${bodyHtml}
        </article>
        ${renderNavPager({ lang, slug })}
        ${slug !== 'index' ? `
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem;">
            <a class="report-btn" href="${GITHUB_URL}/issues/new?title=${encodeURIComponent(`Correction: ${title}`)}&body=${encodeURIComponent(`**Page:** ${SITE_BASE_URL}/${lang}/${slug}.html\n\n**Issue:**\n\n`)}" target="_blank" rel="noopener">${escapeHtml(ui.reportBtn)}</a>
            <button class="report-btn" onclick="window.print()" style="cursor:pointer;border:1px solid var(--border);">${escapeHtml(ui.printBtn)}</button>
        </div>` : ''}
    </main>

    <footer>
        <div class="foot-row">
            <div class="foot-brand">
                <div class="title">${escapeHtml(ui.footerTagline)}</div>
                <div class="sub">${escapeHtml(ui.footerSubtag)}</div>
            </div>
            <div class="foot-links">
                <a class="btn-foot" href="${BAMF_CATALOG_URL}" target="_blank" rel="noopener">${escapeHtml(ui.bamfCatalog)}</a>
                <a class="btn-foot" href="${BAMF_TEST_CENTER_URL}" target="_blank" rel="noopener">${escapeHtml(ui.bamfTestCenter)}</a>
                <a class="btn-foot" href="${GITHUB_URL}" target="_blank" rel="noopener">${escapeHtml(ui.starLabel)}</a>
                <a class="btn-foot foot-wordfeather" href="${WORDFEATHER_URL}" target="_blank" rel="noopener">${escapeHtml(ui.wordfeatherBtn)}</a>
                <a class="btn-foot foot-highlight" href="${PAYPAL_URL}" target="_blank" rel="noopener">${escapeHtml(ui.supportBtn)}</a>
                <a class="btn-foot" href="../privacy.html">${escapeHtml(ui.privacyLink)}</a>
            </div>
        </div>
        <div class="foot-meta">${escapeHtml(ui.lastUpdated)}: ${BUILD_DATE}</div>
    </footer>

    <button class="back-to-top" id="backToTop" aria-label="${escapeHtml(ui.backToTop)}" title="${escapeHtml(ui.backToTop)}">↑</button>

    <script>
        // Feature 7 — Random question navigation
        window.goRandom = function() {
            const all = ${JSON.stringify(ORDERED_ALL)};
            const current = '${slug}';
            const choices = all.filter(s => s !== current);
            const pick = choices[Math.floor(Math.random() * choices.length)];
            window.location.href = './' + pick + '.html';
        };

        // Progress tracker — mark questions as learned
        (function() {
            const KEY = 'gct_learned';
            const isUrdu   = document.documentElement.lang === 'ur';
            const isArabic = document.documentElement.lang === 'ar';
            const isGerman = document.documentElement.lang === 'de';
            const isTurkish = document.documentElement.lang === 'tr';
            const isRussian = document.documentElement.lang === 'ru';

            function getSet() {
                try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
                catch(e) { return new Set(); }
            }
            function saveSet(s) {
                try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch(e) {}
            }

            // Inject a mark button after every question <h3>
            document.querySelectorAll('.content-card h3').forEach(h3 => {
                const m = h3.textContent.match(/(?:Question|Frage|Soru|Вопрос|سوال|السؤال)\\s+(\\d+)/);
                if (!m) return;
                const qId = parseInt(m[1], 10);
                if (isNaN(qId)) return;

                const learned = getSet().has(qId);
                const btn = document.createElement('button');
                btn.className = 'mark-learned-btn' + (learned ? ' learned' : '');
                btn.dataset.qid = qId;
                btn.textContent = learned
                    ? (isUrdu ? '✓ سیکھ لیا' : isArabic ? '✓ تعلّمته' : isGerman ? '✓ Gelernt' : isTurkish ? '✓ Öğrenildi' : isRussian ? '✓ Изучено' : '✓ Learned')
                    : (isUrdu ? '＋ سیکھیں' : isArabic ? '＋ علّمه' : isGerman ? '＋ Als gelernt markieren' : isTurkish ? '＋ Öğrenildi olarak işaretle' : isRussian ? '＋ Отметить как изученное' : '＋ Mark as learned');
                btn.setAttribute('aria-pressed', String(learned));

                btn.addEventListener('click', () => {
                    const s = getSet();
                    const nowLearned = !s.has(qId);
                    nowLearned ? s.add(qId) : s.delete(qId);
                    saveSet(s);
                    btn.classList.toggle('learned', nowLearned);
                    btn.setAttribute('aria-pressed', String(nowLearned));
                    btn.textContent = nowLearned
                        ? (isUrdu ? '✓ سیکھ لیا' : isArabic ? '✓ تعلّمته' : isGerman ? '✓ Gelernt' : isTurkish ? '✓ Öğrenildi' : isRussian ? '✓ Изучено' : '✓ Learned')
                        : (isUrdu ? '＋ سیکھیں' : isArabic ? '＋ علّمه' : isGerman ? '＋ Als gelernt markieren' : isTurkish ? '＋ Öğrenildi olarak işaretle' : isRussian ? '＋ Отметить как изученное' : '＋ Mark as learned');
                });

                h3.insertAdjacentElement('afterend', btn);
            });
        })();

        // Theme already applied by inline script in <head> — this handles the toggle click
        const root = document.documentElement;
        document.getElementById('themeToggle').addEventListener('click', () => {
            const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });

        // Back-to-top button — appears once user scrolls a bit
        const btt = document.getElementById('backToTop');
        const toggleBtt = () => btt.classList.toggle('visible', window.scrollY > 120);
        window.addEventListener('scroll', toggleBtt, { passive: true });
        toggleBtt();
        btt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Register PWA service worker — enables offline study mode + auto-update
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const reg = await navigator.serviceWorker.register('../sw.js');
                    // Force an immediate update check on every page load
                    reg.update().catch(() => {});
                    // Re-check periodically while page is open
                    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

                    // When SW broadcasts that an update is live, show a banner
                    navigator.serviceWorker.addEventListener('message', (e) => {
                        if (e.data && e.data.type === 'SW_UPDATED') showUpdateBanner();
                    });

                    // Also detect updates the standard way (waiting worker)
                    reg.addEventListener('updatefound', () => {
                        const nw = reg.installing;
                        if (!nw) return;
                        nw.addEventListener('statechange', () => {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                                // A new SW is installed alongside the active one
                                showUpdateBanner(nw);
                            }
                        });
                    });

                    // Auto-reload when the controlling SW changes (after user taps "Refresh")
                    let reloading = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (reloading) return;
                        reloading = true;
                        window.location.reload();
                    });
                } catch (e) { /* SW unavailable, no problem */ }
            });

            function showUpdateBanner(waitingWorker) {
                if (document.getElementById('updateBanner')) return;
                const bar = document.createElement('div');
                bar.id = 'updateBanner';
                bar.setAttribute('role', 'status');
                bar.innerHTML = '🔄 New version available — <button id="updateBtn">Refresh</button>';
                bar.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:0.6rem 1rem;border-radius:0.5rem;font-size:0.9rem;box-shadow:0 0.5rem 1.25rem rgba(0,0,0,0.3);z-index:1060;display:flex;gap:0.6rem;align-items:center';
                document.body.appendChild(bar);
                document.getElementById('updateBtn').style.cssText = 'background:#fff;color:#1d4ed8;border:0;padding:0.3rem 0.75rem;border-radius:0.35rem;font-weight:600;cursor:pointer;font-size:0.85rem';
                document.getElementById('updateBtn').addEventListener('click', () => {
                    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
                    else window.location.reload();
                });
            }
        }
    </script>

    <!-- Cloudflare Web Analytics (privacy-friendly, no cookies, GDPR-compliant) -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CLOUDFLARE_ANALYTICS_TOKEN}"}'></script>
</body>
</html>`;
    // Replace flag emoji with flag-icons CSS spans (fixes Chrome on Windows)
    return applyFlagIcons(html);
}

// ---------- Per-language index page ----------
function renderIndex({ lang, slugs }) {
    const ui = UI[lang];
    const titles = TITLES[lang];
    const dir = (lang === 'ur' || lang === 'ar') ? 'rtl' : 'ltr';
    const isUr = lang === 'ur';
    const isAr = lang === 'ar';
    const isDe = lang === 'de';
    const isTr = lang === 'tr';
    const isRu = lang === 'ru';

    // Question set cards — 6 sets with range labels
    const qSets = [
        { slug: 'questions-001-050', range: '1–50'   },
        { slug: 'questions-051-100', range: '51–100'  },
        { slug: 'questions-101-150', range: '101–150' },
        { slug: 'questions-151-200', range: '151–200' },
        { slug: 'questions-201-250', range: '201–250' },
        { slug: 'questions-251-300', range: '251–300' },
    ];

    // State slugs sorted
    const stateSlugs = ORDERED_STATES;

    // Intro text per language
    const intro = {
        en: 'The <strong>Einbürgerungstest</strong> (Leben in Deutschland test) is required for German Permanent Residence and Citizenship. The test is in German — use this free guide to study every official question with English translation and clear explanation.',
        ur: 'جرمن مستقل اقامت (Niederlassungserlaubnis) اور شہریت کے لیے <strong>Einbürgerungstest</strong> پاس کرنا ضروری ہے۔ یہ امتحان جرمن زبان میں ہوتا ہے — اس مفت گائیڈ میں ہر سرکاری سوال کا اردو ترجمہ اور آسان وضاحت موجود ہے۔',
        ar: 'يُعدّ اختبار <strong>Einbürgerungstest</strong> (Leben in Deutschland) شرطاً للحصول على الإقامة الدائمة والجنسية الألمانية. الاختبار باللغة الألمانية — استخدم هذا الدليل المجاني لدراسة جميع الأسئلة الرسمية مع الترجمة العربية والشرح الوافي.',
        de: 'Der <strong>Einbürgerungstest</strong> (Leben in Deutschland) ist Voraussetzung für die Niederlassungserlaubnis und die deutsche Staatsbürgerschaft. Dieser kostenlose Leitfaden enthält alle offiziellen Fragen mit markierten Antworten und Erklärungen auf Deutsch.',
        tr: '<strong>Einbürgerungstest</strong> (Leben in Deutschland sınavı), Almanya Oturma İzni ve Vatandaşlığı için zorunludur. Sınav Almanca yapılır — bu ücretsiz rehberde tüm resmi sorular işaretli cevaplar ve Türkçe açıklamalarla yer almaktadır.',
        ru: 'Для получения вида на жительство (Niederlassungserlaubnis) и гражданства Германии необходимо сдать <strong>Einbürgerungstest</strong> (Leben in Deutschland). Тест проходит на немецком языке. В этом бесплатном пособии — все официальные вопросы с выделенными ответами и пояснениями на русском языке.',
    };

    const headings = {
        en: { qs: '📖 General Questions', states: '🗺️ State Questions', howLabel: '❓ How it works', howText: 'The test has <strong>33 questions</strong> — 30 from the general pool and 3 from your state. You need <strong>17 correct</strong> to pass. <a href="../quiz.html?lang=en">Take the practice quiz →</a>', statsLabel: '' },
        ur: { qs: '📖 عمومی سوالات', states: '🗺️ ریاستی سوالات', howLabel: '❓ امتحان کیسے ہوتا ہے؟', howText: 'امتحان میں <strong>33 سوالات</strong> ہوتے ہیں — 30 عمومی اور 3 آپ کی ریاست کے۔ پاس کرنے کے لیے <strong>17 درست</strong> جوابات ضروری ہیں۔ <a href="../quiz.html?lang=ur">مشق کوئز دیں ←</a>' },
        ar: { qs: '📖 الأسئلة العامة', states: '🗺️ أسئلة الولايات', howLabel: '❓ كيف يعمل الاختبار؟', howText: 'يحتوي الاختبار على <strong>33 سؤالاً</strong> — 30 من الأسئلة العامة و3 من ولايتك. تحتاج إلى <strong>17 إجابة صحيحة</strong> للنجاح. <a href="../quiz.html?lang=ar">ابدأ اختبار التدريب ←</a>' },
        de: { qs: '📖 Allgemeine Fragen', states: '🗺️ Länderfragen', howLabel: '❓ Wie funktioniert der Test?', howText: 'Der Test hat <strong>33 Fragen</strong> — 30 aus dem allgemeinen Pool und 3 aus Ihrem Bundesland. Sie benötigen <strong>17 richtige</strong> Antworten zum Bestehen. <a href="../quiz.html?lang=de">Zum Übungsquiz →</a>' },
        tr: { qs: '📖 Genel Sorular', states: '🗺️ Eyalet Soruları', howLabel: '❓ Sınav nasıl işler?', howText: 'Sınav <strong>33 sorudan</strong> oluşur — 30 genel havuzdan, 3 eyaletinizden. Geçmek için <strong>17 doğru</strong> yanıt gerekir. <a href="../quiz.html?lang=tr">Pratik sınavı başlat →</a>' },
        ru: { qs: '📖 Общие вопросы', states: '🗺️ Вопросы по землям', howLabel: '❓ Как устроен тест?', howText: 'Тест состоит из <strong>33 вопросов</strong> — 30 из общего пула и 3 из вашей земли. Чтобы сдать, нужно <strong>17 правильных</strong> ответов. <a href="../quiz.html?lang=ru">Перейти к тренировке →</a>' },
    };

    const h = headings[lang] || headings.en;

    // Stats bar
    const stats = lang === 'ur'
        ? `<div class="idx-stats"><span>📋 300+ سوالات</span><span>🗺️ 16 ریاستیں</span><span>✅ درست جوابات</span><span>💡 ہر سوال کی وضاحت</span></div>`
        : lang === 'ar'
        ? `<div class="idx-stats"><span>📋 300+ سؤال</span><span>🗺️ 16 ولاية</span><span>✅ الإجابات مُميَّزة</span><span>💡 شرح لكل سؤال</span></div>`
        : lang === 'de'
        ? `<div class="idx-stats"><span>📋 300+ Fragen</span><span>🗺️ 16 Bundesländer</span><span>✅ Antworten markiert</span><span>💡 Erklärung je Frage</span></div>`
        : lang === 'tr'
        ? `<div class="idx-stats"><span>📋 300+ Soru</span><span>🗺️ 16 Eyalet</span><span>✅ Cevaplar işaretli</span><span>💡 Her soru için açıklama</span></div>`
        : isRu
        ? `<div class="idx-stats"><span>📋 300+ вопросов</span><span>🗺️ 16 земель</span><span>✅ Ответы выделены</span><span>💡 Пояснение к каждому вопросу</span></div>`
        : `<div class="idx-stats"><span>📋 300+ questions</span><span>🗺️ 16 Bundesländer</span><span>✅ Answers highlighted</span><span>💡 Explanation per question</span></div>`;

    // Question set cards
    const qCards = qSets.map(({ slug, range }) => {
        const label = isUr ? `سوالات ${range}` : isAr ? `الأسئلة ${range}` : isDe ? `Fragen ${range}` : isTr ? `Sorular ${range}` : isRu ? `Вопросы ${range}` : `Questions ${range}`;
        return `<a class="idx-card" href="./${slug}.html">
            <span class="idx-card-icon">📝</span>
            <span class="idx-card-label">${label}</span>
        </a>`;
    }).join('');

    // State cards
    const stateCards = stateSlugs.map(slug => {
        const t = titles[slug] || slug;
        return `<a class="idx-card idx-card--state" href="./${slug}.html">
            <span class="idx-card-label">${escapeHtml(t)}</span>
        </a>`;
    }).join('');

    // Quiz CTA
    const quizCta = lang === 'ur'
        ? `<a class="idx-quiz-cta" href="../quiz.html?lang=ur">🎯 مشق کوئز شروع کریں — اصل Einbürgerungstest کی طرح</a>`
        : lang === 'ar'
        ? `<a class="idx-quiz-cta" href="../quiz.html?lang=ar">🎯 ابدأ اختبار التدريب — محاكاة لاختبار Einbürgerungstest الفعلي</a>`
        : lang === 'de'
        ? `<a class="idx-quiz-cta" href="../quiz.html?lang=de">🎯 Übungsquiz starten — wie der echte Einbürgerungstest</a>`
        : lang === 'tr'
        ? `<a class="idx-quiz-cta" href="../quiz.html?lang=tr">🎯 Pratik Sınavı Başlat — gerçek Einbürgerungstest gibi</a>`
        : isRu
        ? `<a class="idx-quiz-cta" href="../quiz.html?lang=ru">🎯 Начать тренировочный тест — как настоящий Einbürgerungstest</a>`
        : `<a class="idx-quiz-cta" href="../quiz.html?lang=en">🎯 Start Practice Quiz — simulates the real Einbürgerungstest</a>`;

    const body = `
        <style>
        /* ── Search ─────────────────────────────────────────── */
        .idx-search-wrap {
            margin-bottom: 1.25rem;
            position: relative;
        }
        .idx-search-input {
            width: 100%;
            padding: .7rem 1rem .7rem 2.6rem;
            border: 1.5px solid var(--border);
            border-radius: .65rem;
            font-size: .95rem;
            font-family: inherit;
            background: var(--card-bg);
            color: var(--page-text);
            outline: none;
            transition: border-color .15s;
            box-sizing: border-box;
        }
        .idx-search-input:focus { border-color: var(--primary); }
        .idx-search-icon {
            position: absolute;
            left: .85rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 1rem;
            pointer-events: none;
            color: var(--muted-text);
        }
        .idx-search-results {
            display: none;
            margin-top: .5rem;
            border: 1.5px solid var(--border);
            border-radius: .65rem;
            overflow: hidden;
            background: var(--card-bg);
        }
        .idx-search-results.visible { display: block; }
        .idx-search-result {
            display: block;
            padding: .7rem 1rem;
            border-bottom: 1px solid var(--border);
            text-decoration: none;
            color: var(--page-text);
            transition: background .1s;
            font-size: .88rem;
            line-height: 1.5;
        }
        .idx-search-result:last-child { border-bottom: none; }
        .idx-search-result:hover { background: color-mix(in srgb,var(--primary) 8%,var(--card-bg)); }
        .idx-search-result-num {
            font-weight: 700;
            color: var(--primary);
            font-size: .8rem;
            margin-bottom: .15rem;
        }
        .idx-search-result-text {
            color: var(--page-text);
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        .idx-search-empty {
            padding: 1rem;
            text-align: center;
            color: var(--muted-text);
            font-size: .88rem;
        }
        [dir="rtl"] .idx-search-input { padding: .7rem 2.6rem .7rem 1rem; }
        [dir="rtl"] .idx-search-icon  { left: auto; right: .85rem; }
        </style>

        <h1 style="margin-bottom:.75rem;">${escapeHtml(ui.siteTitle)}</h1>

        <div class="idx-search-wrap">
            <span class="idx-search-icon">🔍</span>
            <input class="idx-search-input" id="searchInput" type="search"
                placeholder="${isUr ? 'سوالات تلاش کریں…' : isAr ? 'ابحث في الأسئلة…' : isDe ? 'Fragen suchen…' : isTr ? 'Sorularda ara…' : isRu ? 'Поиск вопросов…' : 'Search questions…'}"
                autocomplete="off" aria-label="${isUr ? 'سوالات تلاش کریں' : isAr ? 'ابحث في الأسئلة' : isDe ? 'Fragen suchen' : isTr ? 'Sorularda ara' : isRu ? 'Поиск вопросов' : 'Search questions'}">
            <div class="idx-search-results" id="searchResults" role="listbox"></div>
        </div>
        <script>
        (function(){
            const lang = '${lang}';
            const isUr = lang === 'ur';
            const isAr = lang === 'ar';
            const isDe = lang === 'de';
            const isTr = lang === 'tr';
            const isRu = lang === 'ru';
            let searchData = null;

            // Load search index lazily on first keypress
            function loadIndex(cb) {
                if (searchData) { cb(); return; }
                fetch('../search-index.json')
                    .then(r => r.json())
                    .then(d => { searchData = d; cb(); })
                    .catch(() => { searchData = []; });
            }

            function highlight(text, query) {
                if (!query || !text) return escHtml(text);
                const lower = text.toLowerCase();
                const lq    = query.toLowerCase();
                const idx   = lower.indexOf(lq);
                if (idx === -1) return escHtml(text);
                return escHtml(text.slice(0, idx)) +
                    '<mark style="background:rgba(37,99,235,.15);border-radius:2px;">' +
                    escHtml(text.slice(idx, idx + query.length)) +
                    '</mark>' +
                    escHtml(text.slice(idx + query.length));
            }
            function escHtml(s) {
                return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            }

            const input   = document.getElementById('searchInput');
            const results = document.getElementById('searchResults');

            input.addEventListener('input', function() {
                const q = this.value.trim();
                if (q.length < 2) { results.classList.remove('visible'); return; }
                loadIndex(() => doSearch(q));
            });

            function doSearch(q) {
                const lq = q.toLowerCase();
                const matches = searchData.filter(item =>
                    (item.de && item.de.toLowerCase().includes(lq)) ||
                    (isUr ? (item.ur && item.ur.toLowerCase().includes(lq))
                    : isAr ? (item.ar && item.ar.toLowerCase().includes(lq))
                           : (item.en && item.en.toLowerCase().includes(lq)))
                ).slice(0, 10);

                if (!matches.length) {
                    results.innerHTML = '<div class="idx-search-empty">' +
                        (isUr ? 'کوئی نتیجہ نہیں ملا۔' : isAr ? 'لا توجد نتائج.' : isDe ? 'Keine Ergebnisse gefunden.' : isTr ? 'Sonuç bulunamadı.' : isRu ? 'Ничего не найдено.' : 'No results found.') + '</div>';
                    results.classList.add('visible');
                    return;
                }

                results.innerHTML = matches.map(item => {
                    const href = './' + item.slug + '.html#q-' + item.id;
                    const primary = highlight(isUr ? (item.ur || item.de) : isAr ? (item.ar || item.de) : item.de, q);
                    return '<a class="idx-search-result" href="' + escHtml(href) + '">' +
                        '<div class="idx-search-result-num">' + (isUr ? 'سوال ' : isAr ? 'السؤال ' : isDe ? 'Frage ' : isTr ? 'Soru ' : isRu ? 'Вопрос ' : 'Question ') + item.id + '</div>' +
                        '<div class="idx-search-result-text">' + primary + '</div>' +
                        '</a>';
                }).join('');
                results.classList.add('visible');
            }

            // Close results when clicking outside
            document.addEventListener('click', e => {
                if (!input.contains(e.target) && !results.contains(e.target))
                    results.classList.remove('visible');
            });
        })();
        </script>
        <style>
        .idx-intro {
            background: color-mix(in srgb, var(--primary) 7%, var(--card-bg));
            border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
            border-radius: .75rem;
            padding: 1.1rem 1.25rem;
            font-size: .97rem;
            line-height: 1.7;
            margin-bottom: 1.25rem;
        }
        .idx-stats {
            display: flex;
            flex-wrap: wrap;
            gap: .4rem .9rem;
            font-size: .85rem;
            color: var(--muted-text);
            margin-bottom: 1.5rem;
        }
        .idx-how {
            background: color-mix(in srgb, var(--success, #059669) 8%, var(--card-bg));
            border: 1px solid color-mix(in srgb, var(--success, #059669) 20%, var(--border));
            border-radius: .75rem;
            padding: 1rem 1.25rem;
            font-size: .92rem;
            line-height: 1.7;
            margin-bottom: 1.75rem;
        }
        .idx-how strong { color: var(--page-text); }
        .idx-how a { color: var(--primary); font-weight: 600; }
        .idx-section-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 1.75rem 0 .75rem;
        }
        .idx-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
            gap: .55rem;
            margin-bottom: .5rem;
        }
        .idx-grid--states {
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }
        .idx-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: .3rem;
            padding: .85rem .6rem;
            background: var(--card-bg);
            border: 1.5px solid var(--border);
            border-radius: .65rem;
            text-decoration: none;
            color: var(--page-text);
            font-size: .88rem;
            font-weight: 600;
            text-align: center;
            transition: border-color .15s, background .15s, transform .1s;
            line-height: 1.4;
        }
        .idx-card:hover {
            border-color: var(--primary);
            background: color-mix(in srgb, var(--primary) 8%, var(--card-bg));
            transform: translateY(-1px);
            color: var(--page-text);
        }
        .idx-card-icon { font-size: 1.4rem; }
        .idx-card--state { flex-direction: row; justify-content: start; gap: .5rem; font-size: .85rem; padding: .7rem .85rem; }
        .idx-quiz-cta {
            display: block;
            margin: 1.75rem 0 .5rem;
            padding: 1rem 1.25rem;
            background: var(--primary);
            color: #fff;
            font-weight: 700;
            font-size: 1rem;
            text-align: center;
            border-radius: .75rem;
            text-decoration: none;
            transition: background .15s;
        }
        .idx-quiz-cta:hover { background: var(--primary-hover, #1e40af); color: #fff; }
        @media (max-width: 480px) {
            .idx-grid { grid-template-columns: 1fr 1fr; }
            .idx-grid--states { grid-template-columns: 1fr 1fr; }
        }
        </style>

        <div class="idx-intro">${intro[lang] || intro.en}</div>

        ${stats}

        <div class="idx-how"><strong>${escapeHtml(h.howLabel)}</strong><br>${h.howText}</div>

        ${quizCta}

        <div class="progress-tracker" id="progressTracker">
            <div class="pt-header">
                <span>${isUr ? '📚 پیش رفت:' : isAr ? '📚 التقدم:' : isDe ? '📚 Fortschritt:' : isTr ? '📚 İlerleme:' : isRu ? '📚 Прогресс:' : '📚 Progress:'} <strong id="ptCount">0</strong> / 300 ${isUr ? 'سوالات سیکھ لیے' : isAr ? 'سؤال تعلّمته' : isDe ? 'Fragen gelernt' : isTr ? 'soru öğrenildi' : isRu ? 'вопросов изучено' : 'questions learned'}</span>
                <span class="pt-pct" id="ptPct">0%</span>
            </div>
            <div class="pt-bar-bg"><div class="pt-bar-fill" id="ptFill" style="width:0%"></div></div>
            <button class="pt-reset" onclick="if(confirm('${isUr ? 'تمام پیش رفت مٹا دی جائے؟' : isAr ? 'هل تريد إعادة تعيين كل التقدم؟' : isDe ? 'Gesamten Fortschritt zurücksetzen?' : isTr ? 'Tüm ilerleme sıfırlansın mı?' : isRu ? 'Сбросить весь прогресс?' : 'Reset all progress?'}')){localStorage.removeItem('gct_learned');location.reload();}">${isUr ? 'پیش رفت ری سیٹ کریں' : isAr ? 'إعادة تعيين التقدم' : isDe ? 'Fortschritt zurücksetzen' : isTr ? 'İlerlemeyi sıfırla' : isRu ? 'Сбросить прогресс' : 'Reset progress'}</button>
        </div>
        <script>
        (function(){
            try {
                var learned = JSON.parse(localStorage.getItem('gct_learned')||'[]');
                var n = learned.length;
                var pct = Math.min(100, Math.round(n/300*100));
                document.getElementById('ptCount').textContent = n;
                document.getElementById('ptPct').textContent = pct+'%';
                document.getElementById('ptFill').style.width = pct+'%';
            } catch(e){}
        })();
        </script>

        <p class="idx-section-title">${escapeHtml(h.qs)}</p>
        <div class="idx-grid">${qCards}</div>

        <p class="idx-section-title">${escapeHtml(h.states)}</p>
        <div class="idx-grid idx-grid--states">${stateCards}</div>
    `;

    return renderPage({ lang, title: ui.siteTitle, bodyHtml: body, slug: 'index' });
}

// ---------- Helpers ----------
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugFromFile(filename) {
    return filename.replace(/\.md$/i, '');
}

// ---------- Main ----------
function buildLang(lang) {
    const srcDir = SOURCES[lang];
    const outDir = OUTPUTS[lang];

    if (!fs.existsSync(srcDir)) {
        console.error(`✗ Source missing for ${lang}: ${srcDir}`);
        console.error(`  Clone the ${lang === 'ur' ? 'urdu' : lang === 'ar' ? 'arabic' : 'english'} branch there first.`);
        process.exit(1);
    }

    ensureDir(outDir);

    const mdFiles = fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.md') && !EXCLUDE.has(f));

    const slugs = [];
    let readmeHtml = null;

    for (const file of mdFiles) {
        const slug = slugFromFile(file);
        const isReadme = /^README$/i.test(slug);
        const md = fs.readFileSync(path.join(srcDir, file), 'utf8');
        // Ensure a blank line before `---` separators so they render as
        // horizontal rules, not as setext-style h2 underlines.
        let preprocessed = md.replace(/([^\n])\n---\s*$/gm, '$1\n\n---');

        // For German/Turkish/Russian pages: strip the English translation column.
        if (lang === 'de' || lang === 'tr' || lang === 'ru') {
            preprocessed = preprocessed.split('\n').map(line => {
                const t = line.trim();
                // Remove English translation label line.
                // Source format: **🇬🇧** question text  (no "English:" suffix)
                if (/^\*\*🇬🇧\*\*/.test(t)) return '';
                // Also catch older format: **🇬🇧 English:** or **🇬🇧 Englisch:**
                if (/^\*\*🇬🇧\s*(English|Englisch):?\*\*/.test(t)) return '';
                // Table rows: remove the last pipe-separated column (English)
                if (t.startsWith('|') && (line.match(/\|/g) || []).length >= 4) {
                    const parts = line.split('|');
                    parts.splice(parts.length - 2, 1);
                    return parts.join('|');
                }
                // Translate nav links that come from the markdown source
                return line
                    .replace(/⬅ Previous: Questions (\d+)–(\d+)/g, '⬅ Vorherige: Fragen $1–$2')
                    .replace(/Previous: Questions (\d+)–(\d+)/g, 'Vorherige: Fragen $1–$2')
                    .replace(/Next: Questions (\d+)–(\d+)/g, 'Nächste: Fragen $1–$2')
                    .replace(/Note: Questions (\d+)–(\d+) cover[^.]+\./g,
                        'Hinweis: Fragen $1–$2 umfassen spätere Geschichte, Geographie, Kultur, Gesellschaft, Religion und Alltag.')
                    .replace(/Always refer to the official BAMF catalog[^.]*\./g,
                        'Bitte beachten Sie stets den offiziellen BAMF-Fragenkatalog für den genauen Wortlaut.');
            }).join('\n');
        }

        let bodyHtml = marked.parse(preprocessed);
        bodyHtml = bodyHtml.replace(
            /<table([^>]*)>([\s\S]*?)<\/table>/g,
            '<div class="table-wrap"><table$1>$2</table></div>'
        );

        // Add anchor IDs to question headings so search results can link directly.
        // "Question 42" → <h3 id="q-42">Question 42</h3>
        // "سوال 42"     → <h3 id="q-42">سوال 42</h3>
        bodyHtml = bodyHtml.replace(
            /<h3>((Question|Frage|Soru|Вопрос|سوال|السؤال)\s+(\d+))(?:\s*[—–-].*?)?<\/h3>/g,
            (match, full, prefix, num) => {
                // Re-wrap with id, preserving any trailing text (e.g. " — Coat of Arms")
                const innerHtml = match.slice(4, -5); // strip outer <h3> ... </h3>
                return `<h3 id="q-${num}">${innerHtml}</h3>`;
            }
        );

        // For German pages: translate all English-sourced content into German.
        if (lang === 'de') {
            // H1 headings
            bodyHtml = bodyHtml
                .replace(/General Questions — Part 1 \(Questions 1–50\)/g, 'Allgemeine Fragen — Teil 1 (Fragen 1–50)')
                .replace(/General Questions — Part 2 \(Questions 51–100\)/g, 'Allgemeine Fragen — Teil 2 (Fragen 51–100)')
                .replace(/General Questions — Part 3 \(Questions 101–150\)/g, 'Allgemeine Fragen — Teil 3 (Fragen 101–150)')
                .replace(/General Questions — Part 4 \(Questions 151–200\)/g, 'Allgemeine Fragen — Teil 4 (Fragen 151–200)')
                .replace(/General Questions — Part 5 \(Questions 201–250\)/g, 'Allgemeine Fragen — Teil 5 (Fragen 201–250)')
                .replace(/General Questions — Part 6 \(Questions 251–300\)/g, 'Allgemeine Fragen — Teil 6 (Fragen 251–300)');
            // H2 topic headings
            bodyHtml = bodyHtml
                .replace(/Politics, Democracy, Basic Rights &amp; State Structure/g, 'Politik, Demokratie, Grundrechte &amp; Staatsstruktur')
                .replace(/Political System, Parties, Elections &amp; Government Structure/g, 'Politisches System, Parteien, Wahlen &amp; Regierungsstruktur')
                .replace(/Legal System, Government, EU &amp; Civic Life/g, 'Rechtssystem, Regierung, EU &amp; Bürgerleben')
                .replace(/German History: Nazi Era, WWII, Post-War Period/g, 'Deutsche Geschichte: NS-Zeit, Zweiter Weltkrieg, Nachkriegszeit')
                .replace(/History: Cold War, Reunification, Culture &amp; Geography/g, 'Geschichte: Kalter Krieg, Wiedervereinigung, Kultur &amp; Geographie')
                .replace(/Society, Culture, Daily Life, Religion &amp; Civic Knowledge/g, 'Gesellschaft, Kultur, Alltag, Religion &amp; Bürgerkunde');
            // Question headings: "Question N" → "Frage N" (also matches state
            // headings with trailing text, e.g. "Question 301 — Coat of Arms")
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-\d+">)Question (\d+)/g, '$1Frage $2'
            );
            // Explanation label
            bodyHtml = bodyHtml.replace(/📝 Explanation:/g, '📝 Erklärung:');
            // Navigation links from markdown source
            bodyHtml = bodyHtml
                .replace(/⬅ Back to Main README/g, '⬅ Zur Startseite')
                .replace(/⬅ Vorherige: Questions (\d+)–(\d+)/g, '⬅ Vorherige: Fragen $1–$2')
                .replace(/⬅ Previous:/g, '⬅ Vorherige:')
                .replace(/Next:/g, 'Nächste:')
                .replace(/← Back to index/g, '← Zurück')
                .replace(/Back to Main README/g, 'Zur Startseite');

            // Inject German explanations — single combined regex captures both
            // the question ID from <h3> and the blockquote in one match,
            // avoiding the stateful tracking problem.
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const deText = DE_EXPLANATIONS[parseInt(qid, 10)];
                    if (!deText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Erklärung:</strong> ${deText}</p>\n</blockquote>`;
                }
            );
            // Also replace format with existing "Erklärung:" label (Q1-100 where label was applied first)
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝 Erklärung:<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const deText = DE_EXPLANATIONS[parseInt(qid, 10)];
                    if (!deText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Erklärung:</strong> ${deText}</p>\n</blockquote>`;
                }
            );
            // State pages Q306-310 section: translate heading and labels
            bodyHtml = bodyHtml
                .replace(/Questions 306–310 — Additional State Facts/g, 'Fragen 306–310 — Weitere Fakten zum Bundesland')
                .replace(/<p>Key facts for your preparation:<\/p>/g, '<p>Wichtige Fakten für Ihre Vorbereitung:</p>')
                .replace(/<strong>Parliament:<\/strong>/g, '<strong>Parlament:</strong>')
                .replace(/<strong>Neighbors\/Borders:<\/strong>/g, '<strong>Nachbarn/Grenzen:</strong>')
                .replace(/<strong>Major cities:<\/strong>/g, '<strong>Wichtige Städte:</strong>')
                // English border descriptions → German
                .replace(/Surrounded by Schleswig-Holstein and Niedersachsen/g, 'Wird von Schleswig-Holstein und Niedersachsen umgeben')
                .replace(/Surrounded entirely by Brandenburg/g, 'Vollständig von Brandenburg umgeben')
                .replace(/Surrounded by Niedersachsen \(Lower Saxony\)/g, 'Wird von Niedersachsen umgeben')
                .replace(/No international borders\. Borders:/g, 'Keine Auslandsgrenze. Grenzt an:')
                .replace(/No international borders; borders/g, 'Keine Auslandsgrenze; grenzt an:')
                .replace(/Poland, Baltic Sea; borders/g, 'Polen, Ostsee; grenzt an:')
                .replace(/Poland, Czech Republic; borders/g, 'Polen, Tschechien; grenzt an:')
                .replace(/Denmark, North Sea, Baltic Sea; borders/g, 'Dänemark, Nordsee, Ostsee; grenzt an:')
                .replace(/France, Luxembourg, Belgium; borders/g, 'Frankreich, Luxemburg, Belgien; grenzt an:')
                .replace(/France, Luxembourg; borders/g, 'Frankreich, Luxemburg; grenzt an:')
                .replace(/Austria, Czech Republic, Switzerland \(via Lake Constance\)/g, 'Österreich, Tschechien, Schweiz (über den Bodensee)')
                .replace(/Netherlands, North Sea; borders/g, 'Niederlande, Nordsee; grenzt an:')
                .replace(/Abgeordnetenhaus \(House of Representatives\)/g, 'Abgeordnetenhaus')
                .replace(/\bHamburg is a single city-state\b/g, 'Hamburg ist ein Stadtstaat')
                .replace(/\bBerlin is a single city-state with 12 districts \(Bezirke\)\b/g, 'Berlin ist ein Stadtstaat mit 12 Bezirken')
                .replace(/Bremen and Bremerhaven \(the state consists of two cities\)/g, 'Bremen und Bremerhaven (das Land besteht aus zwei Städten)')
                .replace(/\(via Lake Constance\)/g, '(über den Bodensee)')
                .replace(/Poland, and the states of/g, 'Polen sowie die Bundesländer');
        }

        if (lang === 'tr') {
            // H1 headings → Turkish
            bodyHtml = bodyHtml
                .replace(/General Questions — Part 1 \(Questions 1–50\)/g,   'Genel Sorular — Bölüm 1 (Sorular 1–50)')
                .replace(/General Questions — Part 2 \(Questions 51–100\)/g,  'Genel Sorular — Bölüm 2 (Sorular 51–100)')
                .replace(/General Questions — Part 3 \(Questions 101–150\)/g, 'Genel Sorular — Bölüm 3 (Sorular 101–150)')
                .replace(/General Questions — Part 4 \(Questions 151–200\)/g, 'Genel Sorular — Bölüm 4 (Sorular 151–200)')
                .replace(/General Questions — Part 5 \(Questions 201–250\)/g, 'Genel Sorular — Bölüm 5 (Sorular 201–250)')
                .replace(/General Questions — Part 6 \(Questions 251–300\)/g, 'Genel Sorular — Bölüm 6 (Sorular 251–300)');
            // H2 topic headings → Turkish
            bodyHtml = bodyHtml
                .replace(/Politics, Democracy, Basic Rights &amp; State Structure/g,       'Siyaset, Demokrasi, Temel Haklar &amp; Devlet Yapısı')
                .replace(/Political System, Parties, Elections &amp; Government Structure/g,'Siyasi Sistem, Partiler, Seçimler &amp; Hükümet Yapısı')
                .replace(/Legal System, Government, EU &amp; Civic Life/g,                 'Hukuk Sistemi, Hükümet, AB &amp; Vatandaşlık Hayatı')
                .replace(/German History: Nazi Era, WWII, Post-War Period/g,               'Alman Tarihi: Nazi Dönemi, İkinci Dünya Savaşı, Savaş Sonrası')
                .replace(/History: Cold War, Reunification, Culture &amp; Geography/g,     'Tarih: Soğuk Savaş, Yeniden Birleşme, Kültür &amp; Coğrafya')
                .replace(/Society, Culture, Daily Life, Religion &amp; Civic Knowledge/g,  'Toplum, Kültür, Günlük Yaşam, Din &amp; Vatandaşlık Bilgisi');
            // Question headings: "Question N" → "Soru N" (also matches state
            // headings with trailing text, e.g. "Question 301 — Coat of Arms")
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-\d+">)Question (\d+)/g, '$1Soru $2'
            );
            // Explanation label
            bodyHtml = bodyHtml.replace(/📝 Explanation:/g, '📝 Açıklama:');
            // Navigation links
            bodyHtml = bodyHtml
                .replace(/⬅ Back to Main README/g, '⬅ Ana Sayfaya Dön')
                .replace(/⬅ Previous: Questions (\d+)–(\d+)/g, '⬅ Önceki: Sorular $1–$2')
                .replace(/⬅ Previous:/g, '⬅ Önceki:')
                .replace(/Next:/g, 'Sonraki:')
                .replace(/Back to Main README/g, 'Ana Sayfaya Dön')
                .replace(/← Back to index/g, '← Geri')
                // State page H1 title
                .replace(/— State Questions \(301–310\)/g, '— Eyalet Soruları (301–310)')
                .replace(/State Questions \(301–310\)/g, 'Eyalet Soruları (301–310)')
                // State page navigation links from source
                .replace(/⬅ Previous: State Questions/g, '⬅ Önceki Eyalet Soruları');
            // Inject Turkish explanations
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const trText = TR_EXPLANATIONS[parseInt(qid, 10)];
                    if (!trText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Açıklama:</strong> ${trText}</p>\n</blockquote>`;
                }
            );
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝 Açıklama:<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const trText = TR_EXPLANATIONS[parseInt(qid, 10)];
                    if (!trText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Açıklama:</strong> ${trText}</p>\n</blockquote>`;
                }
            );
            // Inject bilingual question + answer table (Turkish column alongside German)
            bodyHtml = injectBilingualTable(bodyHtml, TR_QUESTIONS, 'tr');

            // ── State page italic answer hints → Turkish ──────────────────
            // Generic map / warning hints (same for all states)
            bodyHtml = bodyHtml
                .replace(/🖼️ Identify this state on a map of Germany\./g, '🖼️ Bu eyaleti Almanya haritasında bulun.')
                .replace(/🖼️ Identify on numbered map\./g, '🖼️ Numaralı haritada bulun.')
                .replace(/⚠️ Check current officeholder before your test\./g, '⚠️ Sınavdan önce güncel ismi kontrol edin.')
                .replace(/⚠️ Check current officeholder\. As of 2025:/g, '⚠️ Güncel ismi kontrol edin. 2025 itibarıyla:')
                .replace(/⚠️ Note: This answer changes with elections\. Always check the current Minister-President before your test\./g, '⚠️ Not: Bu cevap seçimlerle değişebilir. Sınavdan önce güncel Eyalet Başbakanı\'nı kontrol edin.')
                .replace(/⚠️ Note: Answer options and the correct answer depend on the current catalog version\./g, '⚠️ Not: Cevap seçenekleri ve doğru cevap güncel katalog sürümüne göre değişebilir.')
                .replace(/\(largest state in western Germany\)/g, '(Batı Almanya\'nın en büyük eyaleti)')
                .replace(/\(other options vary\)/g, '(diğer seçenekler değişir)')
                .replace(/\(other number\)/g, '(diğer numara)')
                .replace(/\(Karte\)/g, '(Harita)')
                .replace(/\(varies\)/g, '(değişir)')
                .replace(/\(Current Minister-President at time of test\)/g, '(Sınav tarihindeki güncel Eyalet Başbakanı)')
                .replace(/The number pointing to the large western state/g, 'Büyük batı eyaletini gösteren numara')
                .replace(/other options vary/g, 'diğer seçenekler değişir');
            // State-specific coat of arms descriptions
            bodyHtml = bodyHtml
                .replace(/🖼️ Select the image showing three black lions on a golden shield with deer and griffin supporters\./g, '🖼️ Geyik ve grifonla desteklenen altın kalkan üzerinde üç siyah aslanı gösteren resmi seçin.')
                .replace(/🖼️ White and blue diamond pattern \(Bavarian rhombi\/lozenges\)/g, '🖼️ Beyaz ve mavi baklava deseni (Bavyera elmasları)')
                .replace(/🖼️ Bear on white background/g, '🖼️ Beyaz zemin üzerinde ayı')
                .replace(/🖼️ Red eagle on white background/g, '🖼️ Beyaz zemin üzerinde kırmızı kartal')
                .replace(/🖼️ Key and coat of arms with the Bremen key/g, '🖼️ Bremen anahtarı ile anahtar ve arma')
                .replace(/🖼️ White castle gate on red background/g, '🖼️ Kırmızı zemin üzerinde beyaz kale kapısı')
                .replace(/🖼️ Red and white striped lion on blue background/g, '🖼️ Mavi zemin üzerinde kırmızı-beyaz çizgili aslan')
                .replace(/🖼️ Bull head \(Mecklenburg\) and griffin \(Pomerania\)/g, '🖼️ Boğa başı (Mecklenburg) ve grifon (Pomeranya)')
                .replace(/🖼️ White horse \(Sachsenross\) on red background/g, '🖼️ Kırmızı zemin üzerinde beyaz at (Sachsenross)')
                .replace(/🖼️ This question shows 4 images of different coats of arms\. The correct answer shows the NRW coat of arms with the Rhine River \(wavy line\), the Westphalian horse, and the Lippe rose\./g, '🖼️ Bu soruda dört farklı arma resmi gösterilir. Doğru cevap; Ren Nehri (dalgalı çizgi), Vestfalya atı ve Lippe gülü içeren NRW armasını gösterir.')
                .replace(/🖼️ This question shows a map of Germany with federal states\. You need to identify NRW\./g, '🖼️ Bu soruda federal eyaletlerle Almanya haritası gösterilir. NRW\'yi belirlemeniz gerekir.')
                .replace(/🖼️ This question shows a map of Germany with numbered federal states\. You need to identify which number corresponds to NRW\./g, '🖼️ Bu soruda numaralı federal eyaletlerle Almanya haritası gösterilir. Hangi numaranın NRW\'ye karşılık geldiğini belirlemeniz gerekir.')
                .replace(/🖼️ Cross, wheel, and lion representing the three historical regions/g, '🖼️ Üç tarihi bölgeyi temsil eden haç, tekerlek ve aslan')
                .replace(/🖼️ Shield with lion, cross, and eagle representing historical territories/g, '🖼️ Tarihi bölgeleri temsil eden aslan, haç ve kartal içeren kalkan')
                .replace(/🖼️ Green and white diagonal stripes with a crown of rue/g, '🖼️ Ruta tacıyla yeşil ve beyaz çapraz çizgiler')
                .replace(/🖼️ Black and gold eagle/g, '🖼️ Siyah ve altın kartal')
                .replace(/🖼️ Two lions on blue and red background/g, '🖼️ Mavi ve kırmızı zemin üzerinde iki aslan')
                .replace(/🖼️ Red and white striped lion with blue claws on blue background/g, '🖼️ Mavi zemin üzerinde mavi pençeli kırmızı-beyaz çizgili aslan')
                .replace(/🖼️ The large southwestern state\./g, '🖼️ Güneybatıdaki büyük eyalet.')
                .replace(/Berlin \(is both capital and state\)/g, 'Berlin (hem başkent hem eyalet)')
                .replace(/Hamburg \(is both city and state\)/g, 'Hamburg (hem şehir hem eyalet)')
                .replace(/Hannover \(Hanover\)/g, 'Hannover')
                .replace(/🖼️ Similar to Question 301 — shows images of coats of arms\. Select the one with the Rhine wave, Westphalian horse, and Lippe rose\./g, '🖼️ 301. Soru\'ya benzer — arma resimleri gösterilir. Ren dalgası, Vestfalya atı ve Lippe gülü içereni seçin.')
                .replace(/🖼️ Identify Baden-Württemberg in southwestern Germany, bordering France and Switzerland\./g, '🖼️ Fransa ve İsviçre ile sınır komşusu olan güneybatı Almanya\'da Baden-Württemberg\'i haritada bulun.')
                .replace(/München \(Munich\)/g, 'München')
                .replace(/Remaining questions cover:[^<]*/g, 'Kalan sorular: ');
            // Q306-310 section heading and labels → Turkish
            bodyHtml = bodyHtml
                .replace(/Questions 306–310 — Additional State Facts/g, 'Sorular 306–310 — Eyalete İlişkin Ek Bilgiler')
                .replace(/<p>Key facts for your preparation:<\/p>/g, '<p>Hazırlığınız için önemli bilgiler:</p>')
                .replace(/<strong>Parliament:<\/strong>/g, '<strong>Parlamento:</strong>')
                .replace(/<strong>Neighbors\/Borders:<\/strong>/g, '<strong>Komşu Eyaletler/Sınırlar:</strong>')
                .replace(/<strong>Major cities:<\/strong>/g, '<strong>Önemli Şehirler:</strong>')
                .replace(/Surrounded by Schleswig-Holstein and Niedersachsen/g, 'Wird von Schleswig-Holstein und Niedersachsen umgeben')
                .replace(/Surrounded entirely by Brandenburg/g, 'Vollständig von Brandenburg umgeben')
                .replace(/Surrounded by Niedersachsen \(Lower Saxony\)/g, 'Wird von Niedersachsen umgeben')
                .replace(/No international borders\. Borders:/g, 'Keine Auslandsgrenze. Grenzt an:')
                .replace(/No international borders; borders/g, 'Keine Auslandsgrenze; grenzt an:')
                .replace(/Poland, Baltic Sea; borders/g, 'Polen, Ostsee; grenzt an:')
                .replace(/Poland, Czech Republic; borders/g, 'Polen, Tschechien; grenzt an:')
                .replace(/Denmark, North Sea, Baltic Sea; borders/g, 'Dänemark, Nordsee, Ostsee; grenzt an:')
                .replace(/France, Luxembourg, Belgium; borders/g, 'Frankreich, Luxemburg, Belgien; grenzt an:')
                .replace(/France, Luxembourg; borders/g, 'Frankreich, Luxemburg; grenzt an:')
                .replace(/Austria, Czech Republic, Switzerland \(via Lake Constance\)/g, 'Österreich, Tschechien, Schweiz (über den Bodensee)')
                .replace(/Netherlands, North Sea; borders/g, 'Niederlande, Nordsee; grenzt an:')
                .replace(/Abgeordnetenhaus \(House of Representatives\)/g, 'Abgeordnetenhaus')
                .replace(/\bHamburg is a single city-state\b/g, 'Hamburg ist ein Stadtstaat')
                .replace(/\bBerlin is a single city-state with 12 districts \(Bezirke\)\b/g, 'Berlin ist ein Stadtstaat mit 12 Bezirken')
                .replace(/Bremen and Bremerhaven \(the state consists of two cities\)/g, 'Bremen und Bremerhaven (das Land besteht aus zwei Städten)')
                .replace(/Poland, and the states of/g, 'Polen sowie die Bundesländer');
        }

        if (lang === 'ru') {
            // H1 headings → Russian
            bodyHtml = bodyHtml
                .replace(/General Questions — Part 1 \(Questions 1–50\)/g,   'Общие вопросы — Часть 1 (Вопросы 1–50)')
                .replace(/General Questions — Part 2 \(Questions 51–100\)/g,  'Общие вопросы — Часть 2 (Вопросы 51–100)')
                .replace(/General Questions — Part 3 \(Questions 101–150\)/g, 'Общие вопросы — Часть 3 (Вопросы 101–150)')
                .replace(/General Questions — Part 4 \(Questions 151–200\)/g, 'Общие вопросы — Часть 4 (Вопросы 151–200)')
                .replace(/General Questions — Part 5 \(Questions 201–250\)/g, 'Общие вопросы — Часть 5 (Вопросы 201–250)')
                .replace(/General Questions — Part 6 \(Questions 251–300\)/g, 'Общие вопросы — Часть 6 (Вопросы 251–300)');
            // H2 topic headings → Russian
            bodyHtml = bodyHtml
                .replace(/Politics, Democracy, Basic Rights &amp; State Structure/g,       'Политика, демократия, основные права и государственный строй')
                .replace(/Political System, Parties, Elections &amp; Government Structure/g,'Политическая система, партии, выборы и структура правительства')
                .replace(/Legal System, Government, EU &amp; Civic Life/g,                 'Правовая система, правительство, ЕС и гражданская жизнь')
                .replace(/German History: Nazi Era, WWII, Post-War Period/g,               'История Германии: нацизм, Вторая мировая война, послевоенный период')
                .replace(/History: Cold War, Reunification, Culture &amp; Geography/g,     'История: холодная война, объединение, культура и география')
                .replace(/Society, Culture, Daily Life, Religion &amp; Civic Knowledge/g,  'Общество, культура, повседневная жизнь, религия и гражданские знания');
            // Question headings: "Question N" → "Вопрос N" (also matches state
            // headings with trailing text, e.g. "Question 301 — Coat of Arms")
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-\d+">)Question (\d+)/g, '$1Вопрос $2'
            );
            // Explanation label and nav links
            bodyHtml = bodyHtml
                .replace(/📝 Explanation:/g, '📝 Пояснение:')
                .replace(/⬅ Back to Main README/g, '⬅ На главную')
                .replace(/⬅ Previous: Questions (\d+)–(\d+)/g, '⬅ Предыдущие: Вопросы $1–$2')
                .replace(/⬅ Previous:/g, '⬅ Предыдущие:')
                .replace(/Next:/g, 'Следующие:')
                .replace(/Back to Main README/g, 'На главную')
                .replace(/← Back to index/g, '← Назад')
                .replace(/— State Questions \(301–310\)/g, '— Вопросы по земле (301–310)')
                .replace(/State Questions \(301–310\)/g, 'Вопросы по земле (301–310)');
            // Inject Russian explanations
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const ruText = RU_EXPLANATIONS[parseInt(qid, 10)];
                    if (!ruText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Пояснение:</strong> ${ruText}</p>\n</blockquote>`;
                }
            );
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝 Пояснение:<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const ruText = RU_EXPLANATIONS[parseInt(qid, 10)];
                    if (!ruText) return match;
                    return `${prefix}<blockquote>\n<p><strong>📝 Пояснение:</strong> ${ruText}</p>\n</blockquote>`;
                }
            );
            // Inject bilingual question + answer table (Russian column alongside German)
            bodyHtml = injectBilingualTable(bodyHtml, RU_QUESTIONS, 'ru');

            // ── State page italic answer hints → Russian ───────────────────
            bodyHtml = bodyHtml
                .replace(/🖼️ Identify this state on a map of Germany\./g, '🖼️ Определите эту землю на карте Германии.')
                .replace(/🖼️ Identify on numbered map\./g, '🖼️ Определите на пронумерованной карте.')
                .replace(/⚠️ Check current officeholder before your test\./g, '⚠️ Проверьте актуального главу перед экзаменом.')
                .replace(/⚠️ Check current officeholder\. As of 2025:/g, '⚠️ Проверьте актуального главу. По состоянию на 2025 год:')
                .replace(/⚠️ Note: This answer changes with elections\. Always check the current Minister-President before your test\./g, '⚠️ Примечание: ответ меняется после выборов. Всегда проверяйте действующего премьер-министра земли перед экзаменом.')
                .replace(/⚠️ Note: Answer options and the correct answer depend on the current catalog version\./g, '⚠️ Примечание: варианты ответов и правильный ответ зависят от актуальной версии каталога.')
                .replace(/\(largest state in western Germany\)/g, '(крупнейшая земля западной Германии)')
                .replace(/\(other options vary\)/g, '(другие варианты различаются)')
                .replace(/\(other number\)/g, '(другой номер)')
                .replace(/\(Karte\)/g, '(Карта)')
                .replace(/\(varies\)/g, '(варьируется)')
                .replace(/\(Current Minister-President at time of test\)/g, '(действующий премьер-министр земли на момент экзамена)')
                .replace(/The number pointing to the large western state/g, 'Номер, указывающий на крупную западную землю')
                .replace(/other options vary/g, 'другие варианты различаются');
            // State-specific coat of arms
            bodyHtml = bodyHtml
                .replace(/🖼️ Select the image showing three black lions on a golden shield with deer and griffin supporters\./g, '🖼️ Выберите изображение с тремя чёрными львами на золотом щите, поддерживаемом оленем и грифоном.')
                .replace(/🖼️ White and blue diamond pattern \(Bavarian rhombi\/lozenges\)/g, '🖼️ Бело-голубой ромбовидный узор (баварские ромбы)')
                .replace(/🖼️ Bear on white background/g, '🖼️ Медведь на белом фоне')
                .replace(/🖼️ Red eagle on white background/g, '🖼️ Красный орёл на белом фоне')
                .replace(/🖼️ Key and coat of arms with the Bremen key/g, '🖼️ Ключ и герб с бременским ключом')
                .replace(/🖼️ White castle gate on red background/g, '🖼️ Белые крепостные ворота на красном фоне')
                .replace(/🖼️ Red and white striped lion on blue background/g, '🖼️ Красно-белый полосатый лев на синем фоне')
                .replace(/🖼️ Bull head \(Mecklenburg\) and griffin \(Pomerania\)/g, '🖼️ Бычья голова (Мекленбург) и грифон (Померания)')
                .replace(/🖼️ White horse \(Sachsenross\) on red background/g, '🖼️ Белый конь (Sachsenross) на красном фоне')
                .replace(/🖼️ This question shows 4 images of different coats of arms\. The correct answer shows the NRW coat of arms with the Rhine River \(wavy line\), the Westphalian horse, and the Lippe rose\./g, '🖼️ В этом вопросе показаны 4 изображения разных гербов. Правильный ответ показывает герб NRW с рекой Рейн (волнистая линия), вестфальским конём и липпской розой.')
                .replace(/🖼️ This question shows a map of Germany with federal states\. You need to identify NRW\./g, '🖼️ В этом вопросе показана карта Германии с федеральными землями. Вам нужно определить NRW.')
                .replace(/🖼️ This question shows a map of Germany with numbered federal states\. You need to identify which number corresponds to NRW\./g, '🖼️ В этом вопросе показана карта Германии с пронумерованными землями. Вам нужно определить, какой номер соответствует NRW.')
                .replace(/🖼️ Cross, wheel, and lion representing the three historical regions/g, '🖼️ Крест, колесо и лев, представляющие три исторических региона')
                .replace(/🖼️ Shield with lion, cross, and eagle representing historical territories/g, '🖼️ Щит со львом, крестом и орлом, представляющими исторические территории')
                .replace(/🖼️ Green and white diagonal stripes with a crown of rue/g, '🖼️ Зелёные и белые диагональные полосы с рутовым венцом')
                .replace(/🖼️ Black and gold eagle/g, '🖼️ Чёрно-золотой орёл')
                .replace(/🖼️ Two lions on blue and red background/g, '🖼️ Два льва на синем и красном фоне')
                .replace(/🖼️ Red and white striped lion with blue claws on blue background/g, '🖼️ Красно-белый полосатый лев с синими когтями на синем фоне')
                .replace(/🖼️ The large southwestern state\./g, '🖼️ Крупная юго-западная земля.')
                .replace(/Berlin \(is both capital and state\)/g, 'Берлин (и столица, и земля)')
                .replace(/Hamburg \(is both city and state\)/g, 'Гамбург (и город, и земля)')
                .replace(/Hannover \(Hanover\)/g, 'Hannover')
                .replace(/🖼️ Similar to Question 301 — shows images of coats of arms\. Select the one with the Rhine wave, Westphalian horse, and Lippe rose\./g, '🖼️ Аналогично вопросу 301 — показаны изображения гербов. Выберите тот, что содержит рейнскую волну, вестфальского коня и липпскую розу.')
                .replace(/🖼️ Identify Baden-Württemberg in southwestern Germany, bordering France and Switzerland\./g, '🖼️ Определите Баден-Вюртемберг на карте юго-западной Германии, граничащей с Францией и Швейцарией.')
                .replace(/München \(Munich\)/g, 'München')
                .replace(/Remaining questions cover:[^<]*/g, 'Оставшиеся вопросы: ');
            // Q306-310 section heading and labels → Russian
            bodyHtml = bodyHtml
                .replace(/Questions 306–310 — Additional State Facts/g, 'Вопросы 306–310 — Дополнительные факты о земле')
                .replace(/<p>Key facts for your preparation:<\/p>/g, '<p>Важные факты для подготовки:</p>')
                .replace(/<strong>Parliament:<\/strong>/g, '<strong>Парламент:</strong>')
                .replace(/<strong>Neighbors\/Borders:<\/strong>/g, '<strong>Соседи/Границы:</strong>')
                .replace(/<strong>Major cities:<\/strong>/g, '<strong>Крупные города:</strong>')
                .replace(/Surrounded by Schleswig-Holstein and Niedersachsen/g, 'Wird von Schleswig-Holstein und Niedersachsen umgeben')
                .replace(/Surrounded entirely by Brandenburg/g, 'Vollständig von Brandenburg umgeben')
                .replace(/Surrounded by Niedersachsen \(Lower Saxony\)/g, 'Wird von Niedersachsen umgeben')
                .replace(/No international borders\. Borders:/g, 'Keine Auslandsgrenze. Grenzt an:')
                .replace(/No international borders; borders/g, 'Keine Auslandsgrenze; grenzt an:')
                .replace(/Poland, Baltic Sea; borders/g, 'Polen, Ostsee; grenzt an:')
                .replace(/Poland, Czech Republic; borders/g, 'Polen, Tschechien; grenzt an:')
                .replace(/Denmark, North Sea, Baltic Sea; borders/g, 'Dänemark, Nordsee, Ostsee; grenzt an:')
                .replace(/France, Luxembourg, Belgium; borders/g, 'Frankreich, Luxemburg, Belgien; grenzt an:')
                .replace(/France, Luxembourg; borders/g, 'Frankreich, Luxemburg; grenzt an:')
                .replace(/Austria, Czech Republic, Switzerland \(via Lake Constance\)/g, 'Österreich, Tschechien, Schweiz (über den Bodensee)')
                .replace(/Netherlands, North Sea; borders/g, 'Niederlande, Nordsee; grenzt an:')
                .replace(/Abgeordnetenhaus \(House of Representatives\)/g, 'Abgeordnetenhaus')
                .replace(/\bHamburg is a single city-state\b/g, 'Hamburg ist ein Stadtstaat')
                .replace(/\bBerlin is a single city-state with 12 districts \(Bezirke\)\b/g, 'Berlin ist ein Stadtstaat mit 12 Bezirken')
                .replace(/Bremen and Bremerhaven \(the state consists of two cities\)/g, 'Bremen und Bremerhaven (das Land besteht aus zwei Städten)')
                .replace(/Poland, and the states of/g, 'Polen sowie die Bundesländer');
        }

        // State-question explanations (DE/TR/RU): the flat dicts above can't
        // disambiguate id 301 across 16 different states, so apply a second,
        // state-keyed override pass here. Only runs for state pages.
        if (['de', 'tr', 'ru'].includes(lang) && STATE_EXPLANATIONS[slug]) {
            const stateLabel = lang === 'de' ? '📝 Erklärung:' : lang === 'tr' ? '📝 Açıklama:' : '📝 Пояснение:';
            const overrides = STATE_EXPLANATIONS[slug];
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">(?:(?!<h3)[\s\S])*?<\/h3>(?:(?!<h3)[\s\S])*?)<blockquote>\n<p><strong>📝[^<]*<\/strong> [\s\S]*?<\/p>\n<\/blockquote>/g,
                (match, prefix, qid) => {
                    const entry = overrides[qid];
                    const text = entry && entry[lang];
                    if (!text) return match;
                    return `${prefix}<blockquote>\n<p><strong>${stateLabel}</strong> ${text}</p>\n</blockquote>`;
                }
            );
        }

        // State sub-heading labels (DE/TR/RU): "Question 301 — Coat of Arms"
        // → "Frage 301 — Wappen" / "Soru 301 — Arma" / "Вопрос 301 — Герб".
        // Same 10 labels, in order, for every state — matched positionally
        // by each question's position (301=index 0 .. 310=index 9) rather
        // than by the English text itself, so this doesn't depend on exactly
        // matching old wording.
        if (['de', 'tr', 'ru'].includes(lang) && STATE_SUBHEADING_LABELS[lang] && slug !== 'index') {
            const labels = STATE_SUBHEADING_LABELS[lang];
            bodyHtml = bodyHtml.replace(
                /(<h3 id="q-(\d+)">[^—<]*—\s*)([^<]*)(<\/h3>)/g,
                (match, prefix, qid, oldLabel, suffix) => {
                    const n = parseInt(qid, 10);
                    if (n < 301 || n > 310) return match; // only state questions
                    const label = labels[n - 301];
                    if (!label) return match;
                    return `${prefix}${label}${suffix}`;
                }
            );
        }

        // State-question text + options (TR/RU only — DE pages show German
        // as the base "Deutsch" column already, so no second column is
        // needed there). Mirrors the STATE_EXPLANATIONS override above:
        // disambiguates id 301-310 by state slug, since injectBilingualTable's
        // flat QUESTIONS_MAP intentionally skips ids > 300 (see its own guard).
        if (['tr', 'ru'].includes(lang) && STATE_QUESTIONS[slug] && slug !== 'index') {
            const langLabel = lang === 'tr' ? 'Türkçe' : 'Русский';
            const flagClass = lang === 'tr' ? 'fi-tr' : 'fi-ru';
            const countryName = lang === 'tr' ? 'Türkiye' : 'Russia';
            const overrides = STATE_QUESTIONS[slug];

            const BLOCK_RE = /(<h3 id="q-(\d+)">[^<]*<\/h3>)((?:(?!<h3 id=)[\s\S])*?)(<div class="table-wrap"><table>[\s\S]*?<\/table><\/div>)/g;
            bodyHtml = bodyHtml.replace(BLOCK_RE, (match, h3, qid, between, table) => {
                const n = parseInt(qid, 10);
                if (n < 301 || n > 310) return match;
                const entry = overrides[qid];
                if (!entry || !entry[lang] || !entry[lang].q || !entry[lang].opts) return match;
                const { q: translatedQ, opts: translatedOpts } = entry[lang];

                const translatedQpara = `<p><strong><span class="fi ${flagClass}" role="img" aria-label="${countryName}" title="${countryName}"></span> ${langLabel}:</strong> ${translatedQ}</p>`;
                const newBetween = between.replace(/(<p><strong>[\s\S]*?<\/strong>[\s\S]*?<\/p>)/, `$1${translatedQpara}`);

                let optIndex = 0;
                const newTable = table
                    .replace(/<th>Deutsch<\/th>/, `<th>Deutsch</th><th>${langLabel}</th>`)
                    .replace(/(<tr>[\s\S]*?<\/tr>)/g, (rowFull) => {
                        if (rowFull.includes('<th>')) return rowFull;
                        const translation = translatedOpts[optIndex] || '';
                        optIndex++;
                        const isCorrect = /<strong>/.test(rowFull);
                        const translatedCell = isCorrect ? `<td><strong>${translation}</strong></td>` : `<td>${translation}</td>`;
                        return rowFull.replace(/<\/tr>$/, `${translatedCell}</tr>`);
                    });

                return `${h3}${newBetween}${newTable}`;
            });
        }

        // Rewrite internal .md links for the static site:
        //   README.md   → index.html  (per-language home)
        //   anything.md → anything.html
        bodyHtml = bodyHtml.replace(
            /href="(?!https?:\/\/|mailto:|#)([^"#]+)\.md(#[^"]*)?"/g,
            (match, name, anchor) => {
                const target = /^README$/i.test(name) ? 'index' : name;
                return `href="${target}.html${anchor || ''}"`;
            }
        );

        // Rewrite GitHub "blob" links to local site paths:
        //   .../blob/english/questions-001-050.md → ./questions-001-050.html (same lang)
        //                                       or → ../en/... (cross lang)
        //   .../blob/urdu/README.md              → ../ur/index.html   etc.
        bodyHtml = bodyHtml.replace(
            /href="https?:\/\/github\.com\/[^/]+\/[^/"]+\/blob\/(english|urdu)\/([^"#]+)\.md(#[^"]*)?"/g,
            (match, branch, name, anchor) => {
                const branchCode = branch === 'english' ? 'en' : 'ur';
                const target = /^README$/i.test(name) ? 'index' : name;
                const path = branchCode === lang
                    ? `./${target}.html`
                    : `../${branchCode}/${target}.html`;
                return `href="${path}${anchor || ''}"`;
            }
        );

        if (isReadme) {
            // Strip the "Support This Project" section from the README — our footer
            // adds its own support CTA on every page, so we avoid duplication here.
            bodyHtml = bodyHtml.replace(/<h2[^>]*>[^<]*Support[^<]*<\/h2>[\s\S]*$/i, '');
            // README content becomes the index page body — don’t emit README.html
            readmeHtml = bodyHtml;
            continue;
        }

        const title = (TITLES[lang][slug]) || slug;

        // Inject state intro paragraph above the question content for state pages
        const isStatePage = ORDERED_STATES.includes(slug);
        if (isStatePage && STATE_INTROS[slug]) {
            const intro = STATE_INTROS[slug][lang] || STATE_INTROS[slug].en;
            const dir = (lang === 'ur' || lang === 'ar') ? 'rtl' : 'ltr';
            const fontStyle = lang === 'ur' ? "font-family:'Jameel Noori Nastaleeq',serif;line-height:2.1;"
                            : lang === 'ar' ? "font-family:'Indopak Nastaleeq',serif;line-height:2.1;"
                            : '';
            const introHtml = `<div class="state-intro" dir="${dir}" style="background:color-mix(in srgb,var(--primary) 7%,var(--card-bg));border:1px solid color-mix(in srgb,var(--primary) 20%,var(--border));border-radius:.75rem;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:.96rem;line-height:1.75;${fontStyle}">${intro}</div>`;
            bodyHtml = introHtml + bodyHtml;
        }

        const html = () => renderPage({ lang, title, bodyHtml, slug });
        const wrote = writeIfChanged(path.join(outDir, `${slug}.html`), html, `${lang}/${slug}.html`);
        slugs.push(slug);
        console.log(`  ${wrote ? '✓' : '·'} ${lang}/${slug}.html${wrote ? '' : ' (unchanged)'}`);
    }

    // Per-language index: always use the purpose-built renderIndex homepage.
    // We no longer use README.md content as the index — it was designed for
    // GitHub readers, not website visitors, and was inconsistent between languages.
    const indexHtmlFn = () => renderIndex({ lang, slugs });
    const indexWrote = writeIfChanged(path.join(outDir, 'index.html'), indexHtmlFn, `${lang}/index.html`);
    console.log(`  ${indexWrote ? '✓' : '·'} ${lang}/index.html${indexWrote ? '' : ' (unchanged)'}`);
}

// Build a unique build ID — current ISO timestamp, sanitized for cache key use
const BUILD_ID = new Date().toISOString().replace(/[:.]/g, '-');

// ---------- Search index ----------
// Lightweight version of quiz-data for client-side search (~50KB vs 545KB).
// Contains id, German text, English text, Urdu text — no options/answers.
function generateSearchIndex() {
    const quizData = JSON.parse(fs.readFileSync(path.join(ROOT, 'quiz-data.json'), 'utf8'));
    const index = quizData.general.map(q => ({
        id:  q.id,
        de:  q.de  || '',
        en:  q.en  || '',
        ur:  q.ur  || '',
        ar:  q.ar  || '',
        // precompute slug so search results link directly to the right page
        slug: (() => {
            const g = Math.ceil(q.id / 50);
            const s = (g - 1) * 50 + 1;
            const e = g * 50;
            return `questions-${String(s).padStart(3,'0')}-${String(e).padStart(3,'0')}`;
        })(),
    }));
    fs.writeFileSync(path.join(ROOT, 'search-index.json'), JSON.stringify(index));
    console.log(`✓ search-index.json written (${index.length} questions)`);
}

function stampServiceWorker() {
    const srcPath = path.join(ROOT, 'sw.template.js');
    const outPath = path.join(ROOT, 'sw.js');
    // If a template file exists, prefer that. Otherwise read sw.js itself
    // (which has __BUILD_ID__ as a placeholder) and stamp it.
    const source = fs.existsSync(srcPath)
        ? fs.readFileSync(srcPath, 'utf8')
        : fs.readFileSync(outPath, 'utf8');
    const stamped = source.replace(/__BUILD_ID__/g, BUILD_ID);
    fs.writeFileSync(outPath, stamped);
    console.log(`✓ sw.js stamped with build ID: ${BUILD_ID}`);
}

// ---------- Sitemap & robots.txt ----------
function buildSitemap() {
    const allSlugs = [...ORDERED_QUESTIONS, ...ORDERED_STATES];
    const today = BUILD_DATE;

    // For the two static pages not covered by the per-language content loop
    // (the root landing page and quiz.html), use each file's real filesystem
    // modification date instead of blanket "today" — otherwise these two
    // entries would force sitemap.xml to look different on every single
    // build, even when nothing anywhere actually changed.
    const fileLastMod = (relPath) => {
        try {
            return fs.statSync(path.join(ROOT, relPath)).mtime.toISOString().slice(0, 10);
        } catch (e) {
            return today; // file missing/unreadable — fall back safely
        }
    };
    const rootIndexDate = fileLastMod('index.html');
    const quizHtmlDate = fileLastMod('quiz.html');

    // Priority map: index and question sets are most important
    const priority = (slug) => {
        if (slug === 'index') return '1.0';
        if (slug.startsWith('questions-')) return '0.9';
        return '0.7'; // state pages
    };
    const changefreq = (slug) => slug.startsWith('questions-') ? 'monthly' : 'yearly';

    let urls = '';

    // Landing page
    urls += `
  <url>
    <loc>${SITE_BASE_URL}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/index.html"/>
    <xhtml:link rel="alternate" hreflang="de" href="${SITE_BASE_URL}/de/index.html"/>
    <xhtml:link rel="alternate" hreflang="tr" href="${SITE_BASE_URL}/tr/index.html"/>
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE_BASE_URL}/ru/index.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/index.html"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE_BASE_URL}/ar/index.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/index.html"/>
    <lastmod>${rootIndexDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`;

    // Quiz page — high priority, it's a key feature page
    urls += `
  <url>
    <loc>${SITE_BASE_URL}/quiz.html</loc>
    <lastmod>${quizHtmlDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.95</priority>
  </url>`;

    // Per-language index pages
    for (const lang of ['en', 'ur', 'ar', 'de', 'tr', 'ru']) {
        const indexDate = PAGE_LASTMOD.get(`${lang}/index.html`) || today;
        urls += `
  <url>
    <loc>${SITE_BASE_URL}/${lang}/index.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/index.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/index.html"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE_BASE_URL}/ar/index.html"/>
    <xhtml:link rel="alternate" hreflang="de" href="${SITE_BASE_URL}/de/index.html"/>
    <xhtml:link rel="alternate" hreflang="tr" href="${SITE_BASE_URL}/tr/index.html"/>
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE_BASE_URL}/ru/index.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/index.html"/>
    <lastmod>${indexDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.95</priority>
  </url>`;
    }

    // Content pages — one <url> entry per language per slug, each carrying
    // the full set of hreflang alternates so search engines know every
    // language version of every page exists.
    const ALL_LANGS = ['en', 'de', 'tr', 'ru', 'ur', 'ar'];
    for (const slug of allSlugs) {
        const p = priority(slug);
        const cf = changefreq(slug);
        for (const lang of ALL_LANGS) {
            const altLinks = ALL_LANGS
                .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_BASE_URL}/${l}/${slug}.html"/>`)
                .join('\n');
            const pageDate = PAGE_LASTMOD.get(`${lang}/${slug}.html`) || today;
            urls += `
  <url>
    <loc>${SITE_BASE_URL}/${lang}/${slug}.html</loc>
${altLinks}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/${slug}.html"/>
    <lastmod>${pageDate}</lastmod>
    <changefreq>${cf}</changefreq>
    <priority>${p}</priority>
  </url>`;
        }
    }

    // Only rewrite sitemap.xml if it actually differs from what's on disk —
    // same reasoning as the HTML pages: a file with no real changes
    // shouldn't get touched just because the build ran on a new day.
    const sitemapPath = path.join(ROOT, 'sitemap.xml');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

    const normalize = (s) => s.replace(/\r\n/g, '\n');
    const existingSitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : null;
    if (existingSitemap && normalize(existingSitemap) === normalize(sitemap)) {
        console.log('· sitemap.xml unchanged');
    } else {
        fs.writeFileSync(sitemapPath, sitemap);
        console.log('✓ sitemap.xml written');
    }

    // robots.txt
    const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_BASE_URL}/sitemap.xml
`;
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
    console.log('✓ robots.txt written');
}

function main() {
    console.log('Building bilingual site...\n');
    for (const lang of ['en', 'ur', 'ar', 'de', 'tr', 'ru']) {
        console.log(`[${lang}]`);
        buildLang(lang);
    }
    // Make sure GitHub Pages doesn’t treat this as Jekyll
    fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
    console.log('\n✓ .nojekyll written');
    // Also copy favicon.ico to the site root — browsers automatically
    // request /favicon.ico at the domain root as a legacy fallback,
    // regardless of the <link rel="icon"> tags in <head>. Having it there
    // too silences that (harmless but noisy) 404 in the console.
    const faviconSrc = path.join(ROOT, 'icons', 'favicon.ico');
    const faviconDest = path.join(ROOT, 'favicon.ico');
    if (fs.existsSync(faviconSrc)) {
        fs.copyFileSync(faviconSrc, faviconDest);
        console.log('✓ favicon.ico copied to site root');
    }

    buildSitemap();
    generateQuizData();
    generateSearchIndex();
    stampServiceWorker();
    console.log('\nDone. Commit and push the `html` branch, then enable GitHub Pages.');
}

main();
