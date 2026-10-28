#!/usr/bin/env node
/**
 * bump-sw.js
 *
 * Re-stamps sw.js with a fresh BUILD_ID, forcing every visitor's browser
 * to treat the cache as stale and fetch new content — without touching
 * any other file (no HTML regeneration, no quiz-data.json rewrite).
 *
 * Use this when you just want to force-refresh cached clients (e.g. after
 * fixing a bug you already deployed, or on a schedule) and don't have any
 * actual content changes to rebuild.
 *
 * For real content changes, still use `npm run build` as normal — this
 * script is only for the narrow "just bump the cache" case.
 *
 * Usage: node bump-sw.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BUILD_ID = new Date().toISOString().replace(/[:.]/g, '-');

function bumpServiceWorker() {
    const outPath = path.join(ROOT, 'sw.js');
    if (!fs.existsSync(outPath)) {
        console.error(`✗ sw.js not found at ${outPath} — run \`npm run build\` first.`);
        process.exit(1);
    }

    // Replace only the cache version in the already-built sw.js, so the page list
    // and the shared-script hash that build.js stamped stay untouched.
    const source = fs.readFileSync(outPath, 'utf8');
    const versionRe = /const CACHE_VERSION = '[^']*';/;
    if (!versionRe.test(source)) {
        console.error(`✗ sw.js has no CACHE_VERSION line — aborting.`);
        process.exit(1);
    }

    const stamped = source.replace(versionRe, `const CACHE_VERSION = '${BUILD_ID}';`);
    fs.writeFileSync(outPath, stamped);
    console.log(`✓ sw.js re-stamped with build ID: ${BUILD_ID}`);
    console.log(`  (only sw.js was touched — no other files were regenerated)`);
}

bumpServiceWorker();
