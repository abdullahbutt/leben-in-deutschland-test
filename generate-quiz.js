#!/usr/bin/env node
/**
 * generate-quiz.js
 * Parses all English + Urdu markdown question files and produces quiz-data.json.
 * Called automatically by build.js main().
 *
 * Output: quiz-data.json at project root.
 * Structure:
 *   { version, general: [...], states: { slug: { name_*, questions: [...] } } }
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = __dirname;
const SRC_EN     = path.join(ROOT, 'sources', 'english');
const SRC_UR     = path.join(ROOT, 'sources', 'urdu');
const SRC_AR     = path.join(ROOT, 'sources', 'arabic');

// ─── Markdown parser ─────────────────────────────────────────────────────────

/**
 * Pre-process markdown to join table rows that span multiple lines.
 * Some questions in the source have a blank line inside a | ... | cell
 * (e.g. Q63's correct answer spans 3 lines). This collapses them into
 * single lines before the regex parser runs.
 */
function normalizeTableRows(content) {
    const lines = content.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // A table row starts with | but an incomplete one doesn't end with |
        if (line.startsWith('|') && !line.trimEnd().endsWith('|')) {
            let combined = line;
            while (i + 1 < lines.length) {
                i++;
                const next = lines[i].trim();
                if (next === '') continue; // skip blank lines inside the cell
                combined += ' ' + next;
                if (combined.trimEnd().endsWith('|')) break;
            }
            result.push(combined);
        } else {
            result.push(line);
        }
    }
    return result.join('\n');
}

/**
 * Parse questions from a markdown file.
 * Returns: [{ id, de, translated, options: [{de,translated}], correct, explanation }]
 *   `translated` is English or Urdu depending on which file is parsed.
 */
function parseMd(filePath) {
    const raw     = fs.readFileSync(filePath, 'utf8');
    const content = normalizeTableRows(raw);  // fix multi-line table rows first
    const questions = [];

    // Split on question headers so each block starts with "### Question N" or "### سوال N"
    const rawBlocks = content.split(/(?=###\s+(?:Question|سوال)\s+\d+)/);

    for (const block of rawBlocks) {
        // Question number
        const numM = block.match(/###\s+(?:Question|سوال)\s+(\d+)/);
        if (!numM) continue;
        const id = parseInt(numM[1], 10);

        // German text (line after 🇩🇪)
        const deM = block.match(/\*\*🇩🇪(?:\s*Deutsch:)?\*\*\s*([^\n]+)/);
        const de = deM ? deM[1].trim() : '';

        // Optional image: ![...](path) — path is relative to the language
        // subfolder (e.g. "../images/21.png"); normalize to be relative to
        // the site root ("images/21.png") for use in quiz-data.json.
        const imgM = block.match(/!\[[^\]]*\]\(([^)]+)\)/);
        const image = imgM ? imgM[1].replace(/^(\.\.\/)+/, '') : undefined;

        // Translated text (line after 🇬🇧 or 🇵🇰 or 🇸🇦)
        const trM = block.match(/\*\*(?:🇬🇧|🇵🇰|🇸🇦)(?:[^*]*)?\*\*\s*([^\n]+)/);
        const translated = trM ? trM[1].trim() : '';

        // Table rows: | ○/✅ | **option** | **option** |
        const options  = [];
        let correct = -1;
        // Match rows that have ○ or ✅ as first cell
        const rowRe = /^\|\s*(✅|○)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/gm;
        let rm;
        while ((rm = rowRe.exec(block)) !== null) {
            const isCorrect = rm[1] === '✅';
            const c1 = rm[2].trim().replace(/^\*+|\*+$/g, '').trim(); // strip bold markers
            const c2 = rm[3].trim().replace(/^\*+|\*+$/g, '').trim();
            if (isCorrect) correct = options.length;
            options.push({ de: c1, translated: c2 });
        }

        // Must have at least 2 options and a correct answer
        if (options.length < 2 || correct === -1) continue;

        // Explanation from blockquote
        const explM = block.match(/^>\s*\*\*📝(?:[^*]*)?\*\*\s*([\s\S]*?)(?=\n---|###|$)/m);
        const explanation = explM
            ? explM[1].replace(/^>\s*/gm, '').replace(/\*\*/g, '').trim()
            : '';

        questions.push({ id, de, translated, options, correct, explanation, image });
    }

    return questions;
}

/**
 * Questions that can't be parsed from the source (only 1 option, or
 * free-form answers) but can be converted to valid 4-option MCQ with
 * added distractors.  These are hardcoded here so the quiz data is
 * correct and stable.
 */
const HARDCODED_EN = [
    // Q253 — Mindestlohn (source has only the correct option listed)
    {
        id: 253,
        de: 'Was ist der Mindestlohn in Deutschland?',
        translated: 'What is the minimum wage (Mindestlohn) in Germany?',
        options: [
            { de: 'ein freiwillig vereinbarter Stundenlohn zwischen Arbeitgeber und Arbeitnehmer', translated: 'a voluntarily agreed hourly wage between employer and employee' },
            { de: 'ein einheitlicher Monatslohn für alle Berufe', translated: 'a uniform monthly salary for all professions' },
            { de: 'eine staatliche Sozialleistung für Arbeitslose', translated: 'a state benefit for unemployed people' },
            { de: 'ein gesetzlich festgelegter Stundenlohn, den Arbeitgeber mindestens zahlen müssen', translated: 'a legally mandated hourly wage that employers must pay at minimum' },
        ],
        correct: 3,
        explanation: 'Germany introduced a statutory minimum wage (Mindestlohn) on 1 January 2015. It is a legally fixed minimum hourly rate that all employers must pay. The rate is periodically adjusted by the Minimum Wage Commission (Mindestlohnkommission).',
    },
    // Q271 — Name three neighboring countries (source lists only the correct trio)
    {
        id: 271,
        de: 'Welche dieser Ländergruppen sind ausschließlich Nachbarländer von Deutschland?',
        translated: 'Which of these groups of countries are ALL neighboring countries of Germany?',
        options: [
            { de: 'Spanien, Italien, Ungarn', translated: 'Spain, Italy, Hungary' },
            { de: 'Schweden, Griechenland, Portugal', translated: 'Sweden, Greece, Portugal' },
            { de: 'Frankreich, Polen, Österreich', translated: 'France, Poland, Austria' },
            { de: 'Finnland, Slowakei, Kroatien', translated: 'Finland, Slovakia, Croatia' },
        ],
        correct: 2,
        explanation: 'Germany has nine neighboring countries: Denmark, Poland, Czech Republic, Austria, Switzerland, France, Luxembourg, Belgium, and the Netherlands. France, Poland, and Austria are all in this list. Spain, Italy, Hungary, Sweden, Greece, Portugal, Finland, Slovakia, and Croatia do not share a border with Germany.',
    },
];

const HARDCODED_UR = [
    {
        id: 253,
        de: 'Was ist der Mindestlohn in Deutschland?',
        translated: 'جرمنی میں کم از کم اجرت (Mindestlohn) کیا ہے؟',
        options: [
            { de: 'ein freiwillig vereinbarter Stundenlohn zwischen Arbeitgeber und Arbeitnehmer', translated: 'آجر اور ملازم کے درمیان رضاکارانہ طور پر طے شدہ فی گھنٹہ اجرت' },
            { de: 'ein einheitlicher Monatslohn für alle Berufe', translated: 'تمام پیشوں کے لیے یکساں ماہانہ تنخواہ' },
            { de: 'eine staatliche Sozialleistung für Arbeitslose', translated: 'بے روزگاروں کے لیے سرکاری سماجی امداد' },
            { de: 'ein gesetzlich festgelegter Stundenlohn, den Arbeitgeber mindestens zahlen müssen', translated: 'قانونی طور پر مقرر کردہ کم از کم فی گھنٹہ اجرت جو آجر کو ادا کرنی ہوگی' },
        ],
        correct: 3,
        explanation: 'جرمنی نے 1 جنوری 2015 کو قانونی کم از کم اجرت (Mindestlohn) متعارف کرائی۔ یہ ایک قانونی طور پر مقرر کردہ کم از کم فی گھنٹہ شرح ہے جو تمام آجروں کو ادا کرنی ہوگی۔',
    },
    {
        id: 271,
        de: 'Welche dieser Ländergruppen sind ausschließlich Nachbarländer von Deutschland?',
        translated: 'ان گروہوں میں سے کون سے ممالک سبھی جرمنی کے ہمسایہ ممالک ہیں؟',
        options: [
            { de: 'Spanien, Italien, Ungarn', translated: 'اسپین، اٹلی، ہنگری' },
            { de: 'Schweden, Griechenland, Portugal', translated: 'سویڈن، یونان، پرتگال' },
            { de: 'Frankreich, Polen, Österreich', translated: 'فرانس، پولینڈ، آسٹریا' },
            { de: 'Finnland, Slowakei, Kroatien', translated: 'فن لینڈ، سلوواکیہ، کروشیا' },
        ],
        correct: 2,
        explanation: 'جرمنی کے نو ہمسایہ ممالک ہیں: ڈنمارک، پولینڈ، چیک ریپبلک، آسٹریا، سوئٹزرلینڈ، فرانس، لکسمبرگ، بیلجیم، اور نیدرلینڈز۔ فرانس، پولینڈ اور آسٹریا اس فہرست میں شامل ہیں۔',
    },
];

// ─── General questions (merge en + ur by id) ─────────────────────────────────

function buildGeneral() {
    const files = [
        'questions-001-050.md',
        'questions-051-100.md',
        'questions-101-150.md',
        'questions-151-200.md',
        'questions-201-250.md',
        'questions-251-300.md',
    ];

    const allEn = [];
    const allUr = [];
    const allAr = [];
    const arExists = fs.existsSync(SRC_AR);

    for (const f of files) {
        allEn.push(...parseMd(path.join(SRC_EN, f)));
        allUr.push(...parseMd(path.join(SRC_UR, f)));
        if (arExists && fs.existsSync(path.join(SRC_AR, f))) {
            allAr.push(...parseMd(path.join(SRC_AR, f)));
        }
    }

    // Inject hardcoded questions that couldn't be parsed from source
    for (const hq of HARDCODED_EN) {
        if (!allEn.find(q => q.id === hq.id)) allEn.push(hq);
    }
    for (const hq of HARDCODED_UR) {
        if (!allUr.find(q => q.id === hq.id)) allUr.push(hq);
    }

    const urMap = new Map(allUr.map(q => [q.id, q]));
    const arMap = new Map(allAr.map(q => [q.id, q]));

    const merged = allEn
        .map(enQ => {
            const urQ = urMap.get(enQ.id);
            const arQ = arMap.get(enQ.id);
            return {
                id:             enQ.id,
                de:             enQ.de,
                en:             enQ.translated,
                ur:             urQ ? urQ.translated : enQ.translated,
                ar:             arQ ? arQ.translated : '',
                ...(enQ.image ? { image: enQ.image } : {}),
                options:        enQ.options.map((opt, i) => ({
                    de: opt.de,
                    en: opt.translated,
                    ur: urQ ? (urQ.options[i]?.translated || opt.translated) : opt.translated,
                    ar: arQ ? (arQ.options[i]?.translated || '') : '',
                })),
                correct:        enQ.correct,
                exp_en:         enQ.explanation,
                exp_ur:         urQ ? urQ.explanation : enQ.explanation,
                exp_ar:         arQ ? arQ.explanation : '',
            };
        })
        .sort((a, b) => a.id - b.id);

    console.log(`  parsed ${merged.length} general questions`);
    return merged;
}

// ─── State questions (hardcoded MCQ with real distractors) ───────────────────
// Image-based questions (301 coat of arms, 302/304 map) and variable answers
// (305 current minister) cannot be reliably served as text MCQ, so we provide
// 3 reliable text-based questions per state that fully match the real test topics.

const STATE_CAPITALS = {
    'baden-wuerttemberg': { de: 'Stuttgart',   en: 'Stuttgart',           ur: 'اسٹوٹگارٹ',  ar: 'شتوتغارت'    },
    'bayern':             { de: 'München',      en: 'Munich (München)',    ur: 'میونخ',        ar: 'ميونيخ'       },
    'berlin':             { de: 'Berlin',       en: 'Berlin (city-state)', ur: 'برلن',         ar: 'برلين'        },
    'brandenburg':        { de: 'Potsdam',      en: 'Potsdam',            ur: 'پوٹسڈام',      ar: 'بوتسدام'      },
    'bremen':             { de: 'Bremen',       en: 'Bremen (city-state)', ur: 'بریمن',        ar: 'بريمن'        },
    'hamburg':            { de: 'Hamburg',      en: 'Hamburg (city-state)',ur: 'ہیمبرگ',       ar: 'هامبورغ'      },
    'hessen':             { de: 'Wiesbaden',    en: 'Wiesbaden',          ur: 'وِسبادن',      ar: 'فيسبادن'      },
    'mecklenburg-vorpommern': { de: 'Schwerin', en: 'Schwerin',           ur: 'شوَرین',       ar: 'شفيرين'       },
    'niedersachsen':      { de: 'Hannover',     en: 'Hanover (Hannover)', ur: 'ہینووَر',      ar: 'هانوفر'       },
    'nordrhein-westfalen':{ de: 'Düsseldorf',   en: 'Düsseldorf',         ur: 'ڈوسلڈورف',    ar: 'دوسلدورف'     },
    'rheinland-pfalz':    { de: 'Mainz',        en: 'Mainz',              ur: 'مائنز',        ar: 'ماينتس'       },
    'saarland':           { de: 'Saarbrücken',  en: 'Saarbrücken',        ur: 'زاربروکن',     ar: 'زاربروكن'     },
    'sachsen':            { de: 'Dresden',      en: 'Dresden',            ur: 'ڈریزڈن',       ar: 'دريسدن'       },
    'sachsen-anhalt':     { de: 'Magdeburg',    en: 'Magdeburg',          ur: 'ماگڈبرگ',      ar: 'ماغدبورغ'     },
    'schleswig-holstein': { de: 'Kiel',         en: 'Kiel',               ur: 'کیل',          ar: 'كيل'          },
    'thueringen':         { de: 'Erfurt',       en: 'Erfurt',             ur: 'ایرفرٹ',       ar: 'إرفورت'       },
};

// Parliament names (Q303-area: type of parliament)
const PARLIAMENTS = {
    'berlin':   { de: 'Abgeordnetenhaus', en: 'Abgeordnetenhaus (House of Representatives)', ur: 'ابجیارڈنیٹنہاؤس', ar: 'مجلس النواب (Abgeordnetenhaus)' },
    'bremen':   { de: 'Bremische Bürgerschaft', en: 'Bremische Bürgerschaft', ur: 'بریمش بورگرشافٹ', ar: 'البرلمان المواطني (Bremische Bürgerschaft)' },
    'hamburg':  { de: 'Bürgerschaft', en: 'Bürgerschaft', ur: 'بورگرشافٹ', ar: 'مجلس المواطنين (Bürgerschaft)' },
    '_default': { de: 'Landtag', en: 'Landtag (State Parliament)', ur: 'لانڈٹاگ', ar: 'البرلمان الولائي (Landtag)' },
};

// Head-of-government titles
const GOV_TITLES = {
    'berlin':  { de: 'Regierender Bürgermeister/in', en: 'Governing Mayor (Regierender Bürgermeister/in)', ur: 'حاکم میئر', ar: 'رئيس البلدية الحاكم (Regierender Bürgermeister/in)' },
    'bremen':  { de: 'Bürgermeister/in (Senatspräsident/in)', en: 'Mayor / Senate President', ur: 'میئر / سینیٹ صدر', ar: 'رئيس البلدية / رئيس مجلس الشيوخ' },
    'hamburg': { de: 'Erster Bürgermeister/in (Senatspräsident/in)', en: 'First Mayor / Senate President', ur: 'پہلا میئر / سینیٹ صدر', ar: 'رئيس البلدية الأول / رئيس مجلس الشيوخ' },
    '_default':{ de: 'Ministerpräsident/in', en: 'Minister-President (Ministerpräsident/in)', ur: 'وزیراعلیٰ (مِنسٹرپریزیڈنٹ)', ar: 'رئيس الوزراء الولائي (Ministerpräsident/in)' },
};

// 3 distractors for capital city questions — pick from other states' capitals
function capitalDistractors(slug) {
    const others = Object.entries(STATE_CAPITALS)
        .filter(([s]) => s !== slug)
        .map(([, v]) => v);
    // Shuffle deterministically using slug hash
    const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    others.sort((a, b) => (a.de.charCodeAt(0) * seed) % 97 - (b.de.charCodeAt(0) * seed) % 97);
    return others.slice(0, 3);
}

// Build state question set (3 solid MCQ questions per state)
function buildStateQuestion(slug, meta) {
    const capital = STATE_CAPITALS[slug];
    const parliament = PARLIAMENTS[slug] || PARLIAMENTS['_default'];
    const govTitle   = GOV_TITLES[slug]  || GOV_TITLES['_default'];

    // Wrong capitals (distractors)
    const dist = capitalDistractors(slug);

    // Shuffle correct answer position: position = slug.length % 4
    const pos = slug.length % 4;
    const capitalOptions = [...dist];
    capitalOptions.splice(pos, 0, capital);

    // Parliament distractors (always offer all 3 parliament types + one fake)
    const parlDistractors = [
        { de: 'Landtag',              en: 'Landtag',              ur: 'لانڈٹاگ',          ar: 'البرلمان الولائي (Landtag)'           },
        { de: 'Abgeordnetenhaus',     en: 'Abgeordnetenhaus',     ur: 'ابجیارڈنیٹنہاؤس',  ar: 'مجلس النواب (Abgeordnetenhaus)'       },
        { de: 'Bürgerschaft',         en: 'Bürgerschaft',         ur: 'بورگرشافٹ',         ar: 'مجلس المواطنين (Bürgerschaft)'        },
        { de: 'Volkskammer',          en: 'Volkskammer (defunct)', ur: 'فولکسکامر (تاریخی)',ar: 'مجلس الشعب السابق (Volkskammer)'      },
    ].filter(p => p.de !== parliament.de);
    const parlOptions = [...parlDistractors.slice(0, 3)];
    const parlPos = (slug.length + 1) % 4;
    parlOptions.splice(parlPos, 0, { de: parliament.de, en: parliament.en, ur: parliament.ur, ar: parliament.ar });

    // Gov-title distractors
    const govOptions = [
        { de: 'Ministerpräsident/in',             en: 'Minister-President',   ur: 'وزیراعلیٰ (مِنسٹرپریزیڈنٹ)', ar: 'رئيس الوزراء الولائي (Ministerpräsident/in)' },
        { de: 'Regierender Bürgermeister/in',     en: 'Governing Mayor',      ur: 'حاکم میئر',                   ar: 'رئيس البلدية الحاكم (Regierender Bürgermeister/in)' },
        { de: 'Erster Bürgermeister/in',          en: 'First Mayor',          ur: 'پہلا میئر',                   ar: 'رئيس البلدية الأول (Erster Bürgermeister/in)' },
        { de: 'Bundeskanzler/in',                 en: 'Federal Chancellor',   ur: 'وفاقی چانسلر',                ar: 'المستشار الفيدرالي (Bundeskanzler/in)' },
    ].filter(g => g.de !== govTitle.de);
    const govOptsArr = [...govOptions.slice(0, 3)];
    const govPos = (slug.length + 2) % 4;
    govOptsArr.splice(govPos, 0, { de: govTitle.de, en: govTitle.en, ur: govTitle.ur, ar: govTitle.ar });

    return [
        // Q1: Capital city
        {
            id: `${slug}-1`,
            de: `Wie heißt die Hauptstadt von ${meta.name_de}?`,
            en: `What is the capital city of ${meta.name_en}?`,
            ur: `${meta.name_ur} کا دارالحکومت کون سا ہے؟`,
            ar: `ما هي عاصمة ولاية ${meta.name_ar}؟`,
            options: capitalOptions.map(c => ({ de: c.de, en: c.en, ur: c.ur, ar: c.ar })),
            correct: pos,
            exp_en: `The capital of ${meta.name_en} is ${capital.en}.`,
            exp_ur: `${meta.name_ur} کا دارالحکومت ${capital.ur} ہے۔`,
            exp_ar: `عاصمة ${meta.name_ar} هي ${capital.ar}.`,
        },
        // Q2: Parliament name
        {
            id: `${slug}-2`,
            de: `Wie heißt das Landesparlament von ${meta.name_de}?`,
            en: `What is the state parliament of ${meta.name_en} called?`,
            ur: `${meta.name_ur} کی ریاستی پارلیمان کو کیا کہتے ہیں؟`,
            ar: `ما اسم البرلمان الولائي في ${meta.name_ar}؟`,
            options: parlOptions,
            correct: parlPos,
            exp_en: `The state parliament of ${meta.name_en} is called the ${parliament.en}.`,
            exp_ur: `${meta.name_ur} کی ریاستی پارلیمان کو ${parliament.ur} کہتے ہیں۔`,
            exp_ar: `يُسمّى البرلمان الولائي في ${meta.name_ar} بـ${parliament.ar}.`,
        },
        // Q3: Head of government title
        {
            id: `${slug}-3`,
            de: `Welchen Titel trägt das Staatsoberhaupt von ${meta.name_de}?`,
            en: `What title does the head of government of ${meta.name_en} hold?`,
            ur: `${meta.name_ur} کے سربراہِ حکومت کا عہدہ کیا ہے؟`,
            ar: `ما لقب رئيس حكومة ولاية ${meta.name_ar}؟`,
            options: govOptsArr,
            correct: govPos,
            exp_en: `The head of government of ${meta.name_en} holds the title of ${govTitle.en}.`,
            exp_ur: `${meta.name_ur} کے سربراہِ حکومت کا عہدہ ${govTitle.ur} ہے۔`,
            exp_ar: `يحمل رئيس حكومة ${meta.name_ar} لقب ${govTitle.ar}.`,
        },
    ];
}

function buildStates() {
    const stateMeta = {
        'baden-wuerttemberg': { name_de: 'Baden-Württemberg',    name_en: 'Baden-Württemberg',    name_ur: 'باڈن ورٹمبرگ',           name_ar: 'بادن-فورتمبرغ'          },
        'bayern':             { name_de: 'Bayern',               name_en: 'Bavaria (Bayern)',     name_ur: 'باویریا',                  name_ar: 'بافاريا'                 },
        'berlin':             { name_de: 'Berlin',               name_en: 'Berlin',               name_ur: 'برلن',                     name_ar: 'برلين'                   },
        'brandenburg':        { name_de: 'Brandenburg',          name_en: 'Brandenburg',          name_ur: 'برانڈنبرگ',               name_ar: 'براندنبورغ'              },
        'bremen':             { name_de: 'Bremen',               name_en: 'Bremen',               name_ur: 'بریمن',                    name_ar: 'بريمن'                   },
        'hamburg':            { name_de: 'Hamburg',              name_en: 'Hamburg',              name_ur: 'ہیمبرگ',                   name_ar: 'هامبورغ'                 },
        'hessen':             { name_de: 'Hessen',               name_en: 'Hesse (Hessen)',       name_ur: 'ہیسن',                     name_ar: 'هيسن'                    },
        'mecklenburg-vorpommern': { name_de: 'Mecklenburg-Vorpommern', name_en: 'Mecklenburg-Vorpommern', name_ur: 'میکلنبرگ-فورپومرن', name_ar: 'مكلنبورغ-فوربومرن'    },
        'niedersachsen':      { name_de: 'Niedersachsen',        name_en: 'Lower Saxony',         name_ur: 'نیڈرزاخسن',               name_ar: 'سكسونيا السفلى'          },
        'nordrhein-westfalen':{ name_de: 'Nordrhein-Westfalen',  name_en: 'North Rhine-Westphalia',name_ur: 'نارڈرائن ویسٹ فالن',    name_ar: 'شمال الراين-وستفاليا'    },
        'rheinland-pfalz':    { name_de: 'Rheinland-Pfalz',     name_en: 'Rhineland-Palatinate', name_ur: 'رائن لینڈ-فالز',          name_ar: 'راينلاند-بفالتس'         },
        'saarland':           { name_de: 'Saarland',            name_en: 'Saarland',             name_ur: 'زارلینڈ',                 name_ar: 'زارلاند'                 },
        'sachsen':            { name_de: 'Sachsen',              name_en: 'Saxony (Sachsen)',     name_ur: 'زاخسن',                   name_ar: 'ساكسونيا'                },
        'sachsen-anhalt':     { name_de: 'Sachsen-Anhalt',      name_en: 'Saxony-Anhalt',        name_ur: 'زاخسن-انہالٹ',            name_ar: 'ساكسونيا-أنهالت'        },
        'schleswig-holstein': { name_de: 'Schleswig-Holstein',   name_en: 'Schleswig-Holstein',   name_ur: 'شلیسوگ-ہولسٹائن',        name_ar: 'شليسفيغ-هولشتاين'       },
        'thueringen':         { name_de: 'Thüringen',           name_en: 'Thuringia (Thüringen)', name_ur: 'تھیورنگن',               name_ar: 'تورينغن'                 },
    };

    const states = {};
    for (const [slug, meta] of Object.entries(stateMeta)) {
        const realQuestions = buildStateQuestionsFromMd(slug, meta);
        states[slug] = {
            slug,
            name_de: meta.name_de,
            name_en: meta.name_en,
            name_ur: meta.name_ur,
            name_ar: meta.name_ar,
            questions: realQuestions || buildStateQuestion(slug, meta),
        };
        const source = realQuestions ? 'from markdown source' : 'synthetic fallback';
        console.log(`  state: ${slug} (${states[slug].questions.length} questions, ${source})`);
    }
    return states;
}

// Try to build a state's questions from a real markdown source file
// (sources/english/{slug}.md, merged with sources/urdu/{slug}.md and
// sources/arabic/{slug}.md). Returns null if no real source file exists
// or it contains no parseable questions, so callers can fall back to the
// synthetic generator for states that haven't been written yet.
function buildStateQuestionsFromMd(slug, meta) {
    const enPath = path.join(SRC_EN, `${slug}.md`);
    if (!fs.existsSync(enPath)) return null;

    const enQs = parseMd(enPath);
    if (enQs.length === 0) return null;

    const urPath = path.join(SRC_UR, `${slug}.md`);
    const arPath = path.join(SRC_AR, `${slug}.md`);
    const urQs = fs.existsSync(urPath) ? parseMd(urPath) : [];
    const arQs = fs.existsSync(arPath) ? parseMd(arPath) : [];
    const urMap = new Map(urQs.map(q => [q.id, q]));
    const arMap = new Map(arQs.map(q => [q.id, q]));

    return enQs
        .map(enQ => {
            const urQ = urMap.get(enQ.id);
            const arQ = arMap.get(enQ.id);
            return {
                id:      `${slug}-${enQ.id}`,
                de:      enQ.de,
                en:      enQ.translated,
                ur:      urQ ? urQ.translated : enQ.translated,
                ar:      arQ ? arQ.translated : '',
                ...(enQ.image ? { image: enQ.image } : {}),
                options: enQ.options.map((opt, i) => ({
                    de: opt.de,
                    en: opt.translated,
                    ur: urQ ? (urQ.options[i]?.translated || opt.translated) : opt.translated,
                    ar: arQ ? (arQ.options[i]?.translated || '') : '',
                })),
                correct: enQ.correct,
                exp_en:  enQ.explanation,
                exp_ur:  urQ ? urQ.explanation : enQ.explanation,
                exp_ar:  arQ ? arQ.explanation : '',
            };
        })
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function generateQuizData() {
    console.log('\n[quiz-data]');
    const general = buildGeneral();
    const states  = buildStates();

    const outPath = path.join(ROOT, 'quiz-data.json');
    const todaysDate = new Date().toISOString().slice(0, 10);

    // Only stamp today's date if the actual question data changed —
    // otherwise re-running the build on a new day would touch this file
    // (and every page's embedded quiz-data reference) for no real reason.
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
    let existingVersion = null;
    if (existing) {
        try { existingVersion = JSON.parse(existing).version; } catch (e) { /* ignore */ }
    }
    const candidateOldDated = JSON.stringify({ version: existingVersion || todaysDate, general, states }, null, 2);
    const normalize = (s) => s.replace(/\r\n/g, '\n');

    let finalOutput;
    if (existing && existingVersion && normalize(candidateOldDated) === normalize(existing)) {
        finalOutput = existing; // truly unchanged — keep the file exactly as-is
        console.log(`· quiz-data.json unchanged (still version ${existingVersion})`);
    } else {
        finalOutput = JSON.stringify({ version: todaysDate, general, states }, null, 2);
        fs.writeFileSync(outPath, finalOutput);
        const kb = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`✓ quiz-data.json written (${general.length} general, ${Object.keys(states).length} states, ${kb} KB)`);
    }
}

module.exports = { generateQuizData };
