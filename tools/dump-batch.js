#!/usr/bin/env node
/**
 * tools/dump-batch.js — print a batch of source questions for translation.
 *
 *   node tools/dump-batch.js general 1 50        # general questions 1..50
 *   node tools/dump-batch.js state bayern        # the 10 questions of one state
 *
 * Output is plain text: German original + English translation of every question,
 * option (correct one marked *) and the English explanation.
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'quiz-data.json'), 'utf8'));

function show(q, label, num) {
    const lines = [];
    lines.push(`#${num} DE: ${q.de}`);
    lines.push(`    EN: ${q.en}${q.image ? '   [has image]' : ''}`);
    q.options.forEach((o, i) => lines.push(`    ${'ABCD'[i]}${i === q.correct ? '*' : ' '} ${o.de}  ||  ${o.en}`));
    lines.push(`    EXP: ${q.exp_en}`);
    console.log(lines.join('\n'));
}

const mode = process.argv[2];
if (mode === 'general') {
    const from = +process.argv[3], to = +process.argv[4];
    data.general.filter(q => q.id >= from && q.id <= to).forEach(q => show(q, 'g', q.id));
} else if (mode === 'state') {
    const slug = process.argv[3];
    const st = data.states[slug];
    if (!st) { console.error('unknown state ' + slug + '; known: ' + Object.keys(data.states).join(', ')); process.exit(1); }
    console.log(`STATE ${slug}  (${st.name_de} / ${st.name_en})`);
    st.questions.forEach(q => show(q, 's', q.id.split('-').pop()));
} else {
    console.error('usage: dump-batch.js general <from> <to> | state <slug>');
    process.exit(1);
}
