// v10.40 — Lot 2 : sens de lecture arabe, accords fille/garçon, voix arabe vocalisée,
// majuscules des noms allemands, classificateurs chinois.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appSource } from './app-source.mjs';
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };
globalThis.document = { documentElement: { dir: 'ltr' } };

const { setLocaleChildGender, localeLexicon } = await import('../modules/locales.js');
const { cardWord, cardSpeechText, zhClassifierAt, germanNoun } = await import('../modules/languages.js');
const { mirrorArrows } = await import('../modules/util.js');
const { defaultCards } = await import('../data.js');
const ok = (m) => console.log(`✓ ${m}`);

const cards = defaultCards();
const byId = (id) => { const c = cards.find((x) => x.id === id); assert.ok(c, id); return c; };
const tired = byId('c-emotions-fatigue');

// 2.2 Accords avec l'enfant
setLocaleChildGender('girl');
assert.equal(cardWord(tired, 'es'), 'Cansada');
assert.equal(cardWord(tired, 'it'), 'Stanca');
assert.equal(cardWord(tired, 'pt'), 'Cansada');
assert.equal(cardWord(tired, 'ar'), 'متعبة');
assert.equal(cardSpeechText(tired, 'ar'), 'مُتْعَبَة');
setLocaleChildGender('boy');
assert.equal(cardWord(tired, 'es'), 'Cansado');
assert.equal(cardWord(tired, 'it'), 'Stanco');
assert.equal(cardWord(tired, 'pt'), 'Cansado');
assert.equal(cardWord(tired, 'ar'), 'متعب');
assert.equal(cardSpeechText(tired, 'ar'), 'مُتْعَب');
assert.equal(cardWord(byId('c-emotions-content'), 'it'), 'Contento');
assert.equal(cardWord(byId('c-besoins-calme'), 'es'), 'Tranquilo');
assert.equal(cardWord(tired, 'en'), 'Tired');
ok('fille / garçon : cansada / cansado, stanca / stanco, متعبة / متعب');
assert.equal(cardWord(byId('c-personnes-maitresse'), 'ar'), 'المعلمة');
ok('un nom garde son propre genre (المعلمة)');
setLocaleChildGender('girl');

// 2.3 Voix arabe vocalisée (Tashkeel) sur toutes les cartes
const HARAKAT = /[ً-ْ]/;
const forms = (v) => (typeof v === 'string' ? [{ tts: v }] : [v, ...(v.gender && typeof v.gender === 'object' ? Object.values(v.gender) : [])]);
const missing = Object.entries(localeLexicon('ar')).filter(([, v]) => forms(v).some((f) => !f.tts || !HARAKAT.test(f.tts)));
assert.deepEqual(missing.map(([k]) => k), []);
ok(`arabe : ${Object.keys(localeLexicon('ar')).length} mots avec voyelles pour la voix`);

// 2.3 Allemand : nom avec majuscule
for (const c of cards.filter((x) => x.gram === 'noun')) {
  const w = cardWord(c, 'de');
  assert.equal(w.charAt(0), w.charAt(0).toLocaleUpperCase('de'), `${c.id} : ${w}`);
}
assert.equal(germanNoun({ gram: 'noun' }, 'apfel'), 'Apfel');
assert.equal(germanNoun({ gram: 'verb' }, 'essen'), 'essen');
ok('allemand : chaque nom commence par une majuscule');

// 2.3 Chinois : classificateur après un nombre ou « ce »
const items = (a, b) => [{ card: a, lang: 'zh' }, { card: b, lang: 'zh' }];
const numCard = (word) => ({ id: `x-${word}`, fr: word, gram: 'adj' });
// Une carte du parent « 1 » ou « 一 » : son mot chinois est lu sur la carte (pas de lexique).
assert.equal(zhClassifierAt(items(numCard('1'), byId('c-manger-pomme')), 1), '个');
assert.equal(zhClassifierAt(items(numCard('3'), byId('c-boire-eau')), 1), '杯');
assert.equal(zhClassifierAt(items(numCard('2'), byId('c-manger-banane')), 1), '根');
assert.equal(zhClassifierAt(items(byId('c-base-je-veux'), byId('c-manger-pomme')), 1), '');
assert.equal(zhClassifierAt([{ card: numCard('1'), lang: 'fr' }, { card: byId('c-manger-pomme'), lang: 'zh' }], 1), '');
assert.equal(zhClassifierAt(items(numCard('1'), byId('c-manger-pomme')), 0), '');
ok('chinois : 1 + 苹果 → 个苹果, 3 + 水 → 杯水, rien après « 我要 »');

// 2.1 Sens de lecture arabe
assert.equal(mirrorArrows('Suivante →'), 'Suivante →');
document.documentElement.dir = 'rtl';
assert.equal(mirrorArrows('Suivante →'), 'Suivante ←');
assert.equal(mirrorArrows('← Retour'), '→ Retour');
document.documentElement.dir = 'ltr';
const app = appSource(); // v10.42 : app.js + ses modules découpés
assert.match(app, /document\.documentElement\.dir = langInfo\(state\.lang\)\.rtl \? 'rtl' : 'ltr'/);
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
assert.ok(!/text-align:\s*left/.test(css), 'text-align: left reste dans style.css');
assert.ok(!/(^|[;{\s])(border-left|padding-left|margin-right):/m.test(css), 'côté gauche/droit fixe dans style.css');
ok('arabe : page en rtl, flèches retournées, marges qui suivent le sens de lecture');
console.log('test-lot2-langues : OK');
