#!/usr/bin/env node
/**
 * tools/merge-batch.js — validate a translated batch and merge it into the language's files.
 *
 *   node tools/merge-batch.js uk tools/batches/uk-general-001-050.json
 *   node tools/merge-batch.js uk tools/batches/uk-state-bayern.json
 *
 * General batch: { "questions": { "1": { "q": "...", "opts": ["..","..","..",".."] } },
 *                  "explanations": { "1": "..." } }
 * State batch:   { "state": "bayern",
 *                  "items": { "301": { "q": "...", "opts": [...], "exp": "..." } } }
 *
 * Writes <lang>-questions.json / <lang>-explanations.json (general) and
 * <lang>-state-questions.json / <lang>-state-explanations.json (state).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const [lang, file] = process.argv.slice(2);
if (!lang || !file) { console.error('usage: merge-batch.js <lang> <batch.json>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'quiz-data.json'), 'utf8'));
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));

function readJson(name) {
    const p = path.join(ROOT, name);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}
function writeJson(name, obj) {
    // numeric-looking keys sort ascending numerically, others alphabetically
    const sorted = {};
    Object.keys(obj).sort((a, b) => (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : a - b).forEach(k => { sorted[k] = obj[k]; });
    fs.writeFileSync(path.join(ROOT, name), JSON.stringify(sorted, null, 2));
}
const bad = [];
const okText = t => typeof t === 'string' && t.trim().length > 0;
// The Ukrainian/Farsi text must not be left as the source language by mistake.
function check(id, q, srcOpts) {
    if (!okText(q.q)) bad.push(`${id}: empty question`);
    if (!Array.isArray(q.opts) || q.opts.length !== srcOpts) bad.push(`${id}: needs ${srcOpts} options`);
    else q.opts.forEach((o, i) => { if (!okText(o)) bad.push(`${id}: option ${i + 1} empty`); });
}

if (batch.questions || batch.explanations) {
    const qs = readJson(`${lang}-questions.json`);
    const ex = readJson(`${lang}-explanations.json`);
    const src = new Map(data.general.map(q => [String(q.id), q]));
    for (const [id, q] of Object.entries(batch.questions || {})) {
        if (!src.has(id)) { bad.push(`${id}: not a general question id`); continue; }
        check(id, q, src.get(id).options.length);
        qs[id] = { q: q.q, opts: q.opts };
    }
    for (const [id, t] of Object.entries(batch.explanations || {})) {
        if (!src.has(id)) { bad.push(`${id}: explanation for unknown id`); continue; }
        if (!okText(t)) bad.push(`${id}: empty explanation`);
        ex[id] = t;
    }
    if (bad.length) { console.error('✗ batch rejected:\n  ' + bad.join('\n  ')); process.exit(1); }
    writeJson(`${lang}-questions.json`, qs);
    writeJson(`${lang}-explanations.json`, ex);
    console.log(`✓ merged ${Object.keys(batch.questions || {}).length} questions, ${Object.keys(batch.explanations || {}).length} explanations -> ${lang}-questions.json (${Object.keys(qs).length}/300), ${lang}-explanations.json (${Object.keys(ex).length}/300)`);
} else if (batch.state) {
    const slug = batch.state;
    const st = data.states[slug];
    if (!st) { console.error('unknown state ' + slug); process.exit(1); }
    const sq = readJson(`${lang}-state-questions.json`);
    const se = readJson(`${lang}-state-explanations.json`);
    sq[slug] = sq[slug] || {};
    se[slug] = se[slug] || {};
    const srcByNum = new Map(st.questions.map(q => [q.id.split('-').pop(), q]));
    for (const [n, it] of Object.entries(batch.items || {})) {
        if (!srcByNum.has(n)) { bad.push(`${slug} ${n}: not a state question`); continue; }
        check(`${slug} ${n}`, it, srcByNum.get(n).options.length);
        if (!okText(it.exp)) bad.push(`${slug} ${n}: empty explanation`);
        sq[slug][n] = { q: it.q, opts: it.opts };
        se[slug][n] = it.exp;
    }
    if (bad.length) { console.error('✗ batch rejected:\n  ' + bad.join('\n  ')); process.exit(1); }
    writeJson(`${lang}-state-questions.json`, sq);
    writeJson(`${lang}-state-explanations.json`, se);
    console.log(`✓ merged state ${slug}: ${Object.keys(batch.items).length} items (${Object.keys(sq).length}/16 states started)`);
} else {
    console.error('batch must have questions/explanations or state/items');
    process.exit(1);
}
