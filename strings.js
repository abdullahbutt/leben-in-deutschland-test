/**
 * strings.js — small per-language UI strings used by build.js (index page, nav).
 *
 * Shape: STR[key][lang]. Missing languages fall back to English, so a new
 * language shows English for anything not translated yet instead of breaking.
 * Use t(key, lang) from build.js.
 */

const STR = {
    // Option label for the quiz in the nav pager's jump list.
    quizOption: {
        en: 'Practice Quiz', ur: 'کوئز / مشق', ar: 'اختبار التدريب', de: 'Quiz / Üben', tr: 'Practice Quiz', ru: 'Practice Quiz',
    },

    // Index page: the row of four highlights under the title.
    idxStats: {
        en: `<div class="idx-stats"><span>📋 300+ questions</span><span>🗺️ 16 Bundesländer</span><span>✅ Answers highlighted</span><span>💡 Explanation per question</span></div>`,
        ur: `<div class="idx-stats"><span>📋 300+ سوالات</span><span>🗺️ 16 ریاستیں</span><span>✅ درست جوابات</span><span>💡 ہر سوال کی وضاحت</span></div>`,
        ar: `<div class="idx-stats"><span>📋 300+ سؤال</span><span>🗺️ 16 ولاية</span><span>✅ الإجابات مُميَّزة</span><span>💡 شرح لكل سؤال</span></div>`,
        de: `<div class="idx-stats"><span>📋 300+ Fragen</span><span>🗺️ 16 Bundesländer</span><span>✅ Antworten markiert</span><span>💡 Erklärung je Frage</span></div>`,
        tr: `<div class="idx-stats"><span>📋 300+ Soru</span><span>🗺️ 16 Eyalet</span><span>✅ Cevaplar işaretli</span><span>💡 Her soru için açıklama</span></div>`,
        ru: `<div class="idx-stats"><span>📋 300+ вопросов</span><span>🗺️ 16 земель</span><span>✅ Ответы выделены</span><span>💡 Пояснение к каждому вопросу</span></div>`,
    },

    // Index page: word in front of a question range, e.g. "Questions 1–50".
    idxRange: {
        en: 'Questions', ur: 'سوالات', ar: 'الأسئلة', de: 'Fragen', tr: 'Sorular', ru: 'Вопросы',
    },

    // Index page: big call-to-action link text for the quiz.
    idxQuizCta: {
        en: '🎯 Start Practice Quiz — simulates the real Einbürgerungstest',
        ur: '🎯 مشق کوئز شروع کریں — اصل Einbürgerungstest کی طرح',
        ar: '🎯 ابدأ اختبار التدريب — محاكاة لاختبار Einbürgerungstest الفعلي',
        de: '🎯 Übungsquiz starten — wie der echte Einbürgerungstest',
        tr: '🎯 Pratik Sınavı Başlat — gerçek Einbürgerungstest gibi',
        ru: '🎯 Начать тренировочный тест — как настоящий Einbürgerungstest',
    },

    searchPlaceholder: {
        en: 'Search questions…', ur: 'سوالات تلاش کریں…', ar: 'ابحث في الأسئلة…', de: 'Fragen suchen…', tr: 'Sorularda ara…', ru: 'Поиск вопросов…',
    },
    searchAria: {
        en: 'Search questions', ur: 'سوالات تلاش کریں', ar: 'ابحث في الأسئلة', de: 'Fragen suchen', tr: 'Sorularda ara', ru: 'Поиск вопросов',
    },
    // Search results (client side).
    noResults: {
        en: 'No results found.', ur: 'کوئی نتیجہ نہیں ملا۔', ar: 'لا توجد نتائج.', de: 'Keine Ergebnisse gefunden.', tr: 'Sonuç bulunamadı.', ru: 'Ничего не найдено.',
    },
    questionWord: {
        en: 'Question ', ur: 'سوال ', ar: 'السؤال ', de: 'Frage ', tr: 'Soru ', ru: 'Вопрос ',
    },

    // "Mark as learned" button on every question (shared page script).
    learnedLabel: {
        en: '✓ Learned', ur: '✓ سیکھ لیا', ar: '✓ تعلّمته', de: '✓ Gelernt', tr: '✓ Öğrenildi', ru: '✓ Изучено',
    },
    markLabel: {
        en: '＋ Mark as learned', ur: '＋ سیکھیں', ar: '＋ علّمه', de: '＋ Als gelernt markieren', tr: '＋ Öğrenildi olarak işaretle', ru: '＋ Отметить как изученное',
    },

    // Progress tracker on the index page.
    progressLabel: {
        en: '📚 Progress:', ur: '📚 پیش رفت:', ar: '📚 التقدم:', de: '📚 Fortschritt:', tr: '📚 İlerleme:', ru: '📚 Прогресс:',
    },
    progressSuffix: {
        en: 'questions learned', ur: 'سوالات سیکھ لیے', ar: 'سؤال تعلّمته', de: 'Fragen gelernt', tr: 'soru öğrenildi', ru: 'вопросов изучено',
    },
    stateProgressLabel: {
        en: '🗺️ State questions:', ur: '🗺️ ریاستی سوالات:', ar: '🗺️ أسئلة الولايات:', de: '🗺️ Länderfragen:', tr: '🗺️ Eyalet soruları:', ru: '🗺️ Вопросы по землям:',
    },
    stateProgressSuffix: {
        en: 'learned', ur: 'سیکھ لیے', ar: 'تعلّمتها', de: 'gelernt', tr: 'öğrenildi', ru: 'изучено',
    },
    resetConfirm: {
        en: 'Reset all progress?', ur: 'تمام پیش رفت مٹا دی جائے؟', ar: 'هل تريد إعادة تعيين كل التقدم؟', de: 'Gesamten Fortschritt zurücksetzen?', tr: 'Tüm ilerleme sıfırlansın mı?', ru: 'Сбросить весь прогресс?',
    },
    resetButton: {
        en: 'Reset progress', ur: 'پیش رفت ری سیٹ کریں', ar: 'إعادة تعيين التقدم', de: 'Fortschritt zurücksetzen', tr: 'İlerlemeyi sıfırla', ru: 'Сбросить прогресс',
    },
};

/** Look up a string for `lang`, falling back to English. */
function t(key, lang) {
    const entry = STR[key];
    if (!entry) throw new Error(`strings.js: unknown key "${key}"`);
    return entry[lang] !== undefined ? entry[lang] : entry.en;
}

module.exports = { STR, t };
