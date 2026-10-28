// Shared client script for all generated content pages (every enabled language).
// Source file: build.js replaces the ORDERED_ALL placeholder and writes assets/page.js.
// Edit THIS file (not assets/page.js), then run `npm run build`.
(function () {
    'use strict';

    const ORDERED_ALL = ["questions-001-050","questions-051-100","questions-101-150","questions-151-200","questions-201-250","questions-251-300","baden-wuerttemberg","bayern","berlin","brandenburg","bremen","hamburg","hessen","mecklenburg-vorpommern","niedersachsen","nordrhein-westfalen","rheinland-pfalz","saarland","sachsen","sachsen-anhalt","schleswig-holstein","thueringen"];
    // Per-language strings, generated from strings.js and the language registry by build.js.
    const I18N = {"learned":{"en":"✓ Learned","ur":"✓ سیکھ لیا","ar":"✓ تعلّمته","de":"✓ Gelernt","tr":"✓ Öğrenildi","ru":"✓ Изучено"},"mark":{"en":"＋ Mark as learned","ur":"＋ سیکھیں","ar":"＋ علّمه","de":"＋ Als gelernt markieren","tr":"＋ Öğrenildi olarak işaretle","ru":"＋ Отметить как изученное"},"questionWords":["Question","سوال","السؤال","Frage","Soru","Вопрос"]};
    const QUESTION_WORD_RE = new RegExp('(?:' + I18N.questionWords.join('|') + ')\\s+(\\d+)');
    const PAGE_SLUG = decodeURIComponent(location.pathname.split('/').pop() || '').replace(/\.html$/, '');

    // Random question navigation
    window.goRandom = function () {
        const choices = ORDERED_ALL.filter(s => s !== PAGE_SLUG);
        const pick = choices[Math.floor(Math.random() * choices.length)];
        window.location.href = './' + pick + '.html';
    };

    // Progress tracker — mark questions as learned
    (function () {
        const KEY = 'gct_learned';
        const lang = document.documentElement.lang;

        // State questions reuse numbers 301-310 in every Bundesland, so they are
        // stored as "<state-slug>-<n>"; general questions stay plain numbers.
        // Legacy plain numbers > 300 were ambiguous across states and are dropped.
        function getSet() {
            try {
                const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
                return new Set(Array.isArray(raw) ? raw.filter(v => typeof v === 'string' || (v >= 1 && v <= 300)) : []);
            }
            catch (e) { return new Set(); }
        }
        function saveSet(s) {
            try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {}
        }

        function label(learned) {
            const table = learned ? I18N.learned : I18N.mark;
            return table[lang] || table.en;
        }

        // Inject a mark button after every question <h3>
        document.querySelectorAll('.content-card h3').forEach(h3 => {
            const m = h3.textContent.match(QUESTION_WORD_RE);
            if (!m) return;
            const qNum = parseInt(m[1], 10);
            if (isNaN(qNum)) return;
            const qId = qNum > 300 ? PAGE_SLUG + '-' + qNum : qNum;

            const learned = getSet().has(qId);
            const btn = document.createElement('button');
            btn.className = 'mark-learned-btn' + (learned ? ' learned' : '');
            btn.dataset.qid = qId;
            btn.textContent = label(learned);
            btn.setAttribute('aria-pressed', String(learned));

            btn.addEventListener('click', () => {
                const s = getSet();
                const nowLearned = !s.has(qId);
                nowLearned ? s.add(qId) : s.delete(qId);
                saveSet(s);
                btn.classList.toggle('learned', nowLearned);
                btn.setAttribute('aria-pressed', String(nowLearned));
                btn.textContent = label(nowLearned);
            });

            h3.insertAdjacentElement('afterend', btn);
        });
    })();

    // Index page: per-state and total state-question progress (stored ids are "<slug>-<n>")
    (function () {
        const fill = document.getElementById('ptStateFill');
        if (!fill) return;
        let learned = [];
        try { learned = JSON.parse(localStorage.getItem('gct_learned') || '[]'); } catch (e) {}
        const ids = new Set(Array.isArray(learned) ? learned.filter(v => typeof v === 'string') : []);
        let total = 0;
        document.querySelectorAll('[data-count-for]').forEach(el => {
            const slug = el.getAttribute('data-count-for');
            let n = 0;
            for (let i = 301; i <= 310; i++) if (ids.has(slug + '-' + i)) n++;
            total += n;
            el.textContent = n ? n + '/10' : '';
            el.classList.toggle('done', n === 10);
        });
        const pct = Math.min(100, Math.round(total / 160 * 100));
        document.getElementById('ptStateCount').textContent = total;
        document.getElementById('ptStatePct').textContent = pct + '%';
        fill.style.width = pct + '%';
    })();

    // Theme already applied by inline script in <head> — this handles the toggle click
    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });
    }

    // Back-to-top button — appears once user scrolls a bit
    const btt = document.getElementById('backToTop');
    if (btt) {
        const toggleBtt = () => btt.classList.toggle('visible', window.scrollY > 120);
        window.addEventListener('scroll', toggleBtt, { passive: true });
        toggleBtt();
        btt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Register PWA service worker — enables offline study mode + auto-update
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const reg = await navigator.serviceWorker.register(new URL('../sw.js', location.href).href);
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
})();
