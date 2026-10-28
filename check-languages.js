/**
 * check-languages.js — completeness check for every language in languages.js.
 *
 * build.js calls checkLanguages(ctx) with its translation tables. For ENABLED
 * languages any gap is an error (the build stops, so English never leaks onto a
 * live page). For disabled (work-in-progress) languages `node build.js --report`
 * prints what is still missing instead.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function keysOf(o) { return Object.keys(o || {}); }

function checkLanguage(code, ctx) {
    const { LANGS, UI, TITLES, STATE_INTROS, META_DESCS, META_DESC_TEMPLATES, A11Y,
            STATE_SUBHEADING_LABELS, INDEX_INTRO, INDEX_HEADINGS, STR,
            PHRASES, LOCALES, DICT, ORDERED_ALL } = ctx;
    const L = LANGS[code];
    const problems = [];
    const add = (area, msg) => problems.push(`${area}: ${msg}`);

    if (code !== 'en') {
        // --- build.js tables keyed by language ---------------------------------
        const ui = UI[code];
        if (!ui) add('UI', 'no entry in UI (build.js)');
        else {
            const miss = keysOf(UI.en).filter(k => ui[k] === undefined);
            if (miss.length) add('UI', `${miss.length} missing keys: ${miss.slice(0, 6).join(', ')}${miss.length > 6 ? ', …' : ''}`);
        }
        const titles = TITLES[code];
        if (!titles) add('TITLES', 'no entry');
        else {
            const miss = keysOf(TITLES.en).filter(k => !titles[k]);
            if (miss.length) add('TITLES', `${miss.length} missing slugs: ${miss.slice(0, 5).join(', ')}`);
        }
        const noIntro = ORDERED_ALL.filter(s => STATE_INTROS[s] && !STATE_INTROS[s][code]);
        if (noIntro.length) add('STATE_INTROS', `missing for ${noIntro.length} states: ${noIntro.slice(0, 4).join(', ')}…`);
        if (!A11Y[code]) add('A11Y', 'no entry');
        if (!INDEX_INTRO[code]) add('INDEX_INTRO', 'no entry');
        if (!INDEX_HEADINGS[code]) add('INDEX_HEADINGS', 'no entry');
        const labels = STATE_SUBHEADING_LABELS[code];
        if (!labels || labels.length !== 10) add('STATE_SUBHEADING_LABELS', 'needs 10 labels');
        // Meta descriptions: either explicit entries or a template set.
        if (!META_DESC_TEMPLATES[code] && !(META_DESCS[code] && META_DESCS[code].index)) {
            add('META', 'no META_DESC_TEMPLATES / META_DESCS entry (pages would get English descriptions)');
        }
        // strings.js
        const missStr = keysOf(STR).filter(k => STR[k][code] === undefined);
        if (missStr.length) add('strings.js', `${missStr.length} keys missing: ${missStr.slice(0, 6).join(', ')}${missStr.length > 6 ? ', …' : ''}`);
    }

    // --- dictionary languages (pages built from English markdown + dictionaries) --
    if (L.kind === 'dictionary') {
        const loc = LOCALES[code];
        if (!loc) add('locale', `locales/${code}.json missing`);
        else {
            if (!loc.questionWord) add('locale', 'questionWord missing');
            if (!loc.explanationLabel) add('locale', 'explanationLabel missing');
            if (!Array.isArray(loc.phrases) || loc.phrases.length !== PHRASES.length) {
                add('locale', `phrases must have ${PHRASES.length} entries`);
            } else {
                // Phrases a language leaves null are fine unless a page actually uses them;
                // build.js reports those after building (see reportPhraseCoverage).
            }
            if (!loc.bilingual && code !== 'de') add('locale', 'bilingual {label, flagClass, countryName} missing');
        }
        const d = DICT[code] || { explanations: {}, questions: {} };
        const gen = Array.from({ length: 300 }, (_, i) => String(i + 1));
        const missExp = gen.filter(id => !d.explanations[id]);
        if (missExp.length) add('explanations', `${missExp.length}/300 general explanations missing`);
        if (code !== 'de') {
            const missQ = gen.filter(id => !(d.questions[id] && d.questions[id].q && d.questions[id].opts));
            if (missQ.length) add('questions', `${missQ.length}/300 general questions missing`);
        }
        // state questions / explanations (shared files keyed [slug][301..310][lang])
        const stExp = ctx.STATE_EXPLANATIONS, stQ = ctx.STATE_QUESTIONS;
        const states = ORDERED_ALL.filter(s => !/^questions-/.test(s));
        let missSE = 0, missSQ = 0;
        for (const s of states) for (let n = 301; n <= 310; n++) {
            const e = (stExp[s] || {})[String(n)];
            if (!e || !e[code]) missSE++;
            const q = (stQ[s] || {})[String(n)];
            if (code !== 'de' && (!q || !q[code] || !q[code].q)) missSQ++;
        }
        if (missSE) add('state-explanations', `${missSE}/160 missing`);
        if (missSQ) add('state-questions', `${missSQ}/160 missing`);
    }

    // --- static pages -------------------------------------------------------------
    const quiz = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
    if (!new RegExp(`^    ${code}: \\{ name:`, 'm').test(quiz)) add('quiz.html', 'not in LANGUAGES');
    if (!new RegExp(`^    ${code}: \\{\\s*$`, 'm').test(quiz)) add('quiz.html', 'no UI block');
    const root = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    if (!root.includes(`data-lang="${code}"`)) add('index.html', 'no language button in the root picker');
    if (L.font) {
        if (!fs.existsSync(path.join(ROOT, 'fonts', L.font.file))) add('font', `fonts/${L.font.file} missing`);
    }
    return problems;
}

/**
 * @returns {{[code:string]: string[]}} problems per language
 */
function checkLanguages(ctx, { all = false } = {}) {
    const out = {};
    for (const code of Object.keys(ctx.LANGS)) {
        if (!all && !ctx.LANGS[code].enabled) continue;
        out[code] = checkLanguage(code, ctx);
    }
    return out;
}

module.exports = { checkLanguages };
