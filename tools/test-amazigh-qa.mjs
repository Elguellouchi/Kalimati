#!/usr/bin/env node
/**
 * v10.7 : contrôles automatiques de l'amazigh (dossier Drive « kalimati-amazigh-final », relu et corrigé).
 * Usage : node tools/test-amazigh-qa.mjs
 * Vérifie :
 *  1. Aucun secret dans les fichiers touchés ; aucun code kabyle (kab) ; 4 variétés séparées.
 *  2. Tifinagh cohérent avec les lettres latines (convention IRCAM, « e » muet non écrit) : lexique et conjugaison.
 *  3. Un mot amazigh pour chaque carte de départ (sauf cartes personnelles) et chaque carte « Vie au village ».
 *  4. Conjugaison amazighe aux 3 temps (verbe seul, « je veux » + nom) et français / darija inchangés.
 *  5. Service worker : nouvelle version, modules amazighs, caches des voix gardés.
 *  6. Liste des cartes de l'outil PC (tools/amazigh-cards.json) à jour avec le lexique.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Les modules de l'appli attendent un navigateur : petits remplaçants, seulement pour les lire ici.
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const ROOT = process.env.KALIMATI_QA_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const VARIETIES = ['shi', 'tzm', 'rif', 'zgh'];

// Lettres latines -> tifinagh (IRCAM). Le « e » muet ne s'écrit pas.
const TIF = { a: 'ⴰ', b: 'ⴱ', c: 'ⵛ', č: 'ⵛ', š: 'ⵛ', d: 'ⴷ', ḍ: 'ⴹ', e: '', ɛ: 'ⵄ', f: 'ⴼ', g: 'ⴳ', ɣ: 'ⵖ', h: 'ⵀ', ḥ: 'ⵃ', i: 'ⵉ', j: 'ⵊ', k: 'ⴽ', l: 'ⵍ', m: 'ⵎ', n: 'ⵏ', o: 'ⵓ', q: 'ⵇ', r: 'ⵔ', ṛ: 'ⵕ', s: 'ⵙ', ṣ: 'ⵚ', t: 'ⵜ', ṭ: 'ⵟ', u: 'ⵓ', w: 'ⵡ', x: 'ⵅ', y: 'ⵢ', z: 'ⵣ', ẓ: 'ⵥ', ʷ: 'ⵯ' };
function toTifinagh(lat) {
  let out = '';
  for (const ch of String(lat).normalize('NFC').toLowerCase()) {
    if (ch in TIF) out += TIF[ch];
    else if (/[\s\-?!.,()'’·]/.test(ch)) out += ch;
    else out += `[${ch}]`;
  }
  return out;
}

async function main() {
  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  };

  const files = ['app.js', 'db.js', 'speech.js', 'editor.js', 'sw.js', 'style.css', 'modules/languages.js', 'modules/amazigh-lexicon.js',
    'modules/morphology.js', 'modules/eye-and-packs.js', 'modules/voice-packs.js', 'modules/dashboard.js', 'tools/generate-amazigh-voices.py'];

  await check('Aucun secret dans les fichiers touchés', () => {
    const forbidden = [/service_role/i, /sb_secret_/i, /sk-proj-/i, /sk-live-/i, /OPENAI_API_KEY\s*=/, /AIza[0-9A-Za-z_-]{20}/];
    for (const rel of files) for (const re of forbidden) assert.equal(re.test(read(rel)), false, `Secret interdit dans ${rel}`);
  });

  await check('4 variétés séparées (shi / tzm / rif / zgh), aucun code kabyle', () => {
    const txt = read('modules/languages.js');
    assert.match(txt, /AMAZIGH_LANGS\s*=\s*\[\s*'shi'\s*,\s*'tzm'\s*,\s*'rif'\s*,\s*'zgh'\s*\]/);
    assert.equal(/\bkab_Latn\b|code:\s*'kab'/.test(txt), false);
  });

  const lexSrc = read('modules/amazigh-lexicon.js');
  const pairRe = /\{ lat: '([^']*)', tif: '([^']*)' \}/g;
  await check('Tifinagh = lettres latines (lexique)', () => {
    const bad = [...lexSrc.matchAll(pairRe)].filter((m) => toTifinagh(m[1]) !== m[2].normalize('NFC'));
    assert.equal(bad.length, 0, bad.map((m) => `${m[1]} -> ${m[2]} (attendu ${toTifinagh(m[1])})`).join('\n'));
  });

  await check('Tifinagh = lettres latines (conjugaison)', () => {
    const src = read('modules/morphology.js');
    const pairs = [...src.matchAll(pairRe), ...src.matchAll(/\['([^'\]]*)', '([ⴰ-⵿][^']*)'\]/g)];
    assert.ok(pairs.length > 100, `seulement ${pairs.length} formes trouvées`);
    const bad = pairs.filter((m) => toTifinagh(m[1]) !== m[2].normalize('NFC'));
    assert.equal(bad.length, 0, bad.map((m) => `${m[1]} -> ${m[2]} (attendu ${toTifinagh(m[1])})`).join('\n'));
  });

  const { amazighEntry } = await import(path.join(ROOT, 'modules/amazigh-lexicon.js'));
  const { cardWord, isAmazighLang, formatAmazighText } = await import(path.join(ROOT, 'modules/languages.js'));
  const { inflectStrip } = await import(path.join(ROOT, 'modules/morphology.js'));
  const { THEMATIC_PACKS } = await import(path.join(ROOT, 'modules/eye-and-packs.js'));
  const { defaultCards } = await import(path.join(ROOT, 'data.js'));
  const cards = defaultCards();

  await check('Un mot amazigh pour chaque carte de départ (sauf « Sœur / Frère » et « Thérapeute », personnelles)', () => {
    const personal = new Set(['c-personnes-ghita', 'c-personnes-hosna']);
    assert.ok(cards.length >= 90, `${cards.length} cartes de départ`);
    for (const card of cards) {
      if (personal.has(card.id)) continue;
      for (const code of VARIETIES) {
        const entry = amazighEntry(card.fr, code);
        assert.ok(entry && entry.lat && entry.tif, `Mot manquant : ${card.fr} (${code})`);
      }
    }
  });

  await check('Pack « Vie au village » : 20 cartes, mot amazigh dans les 4 variétés et les 3 écritures', () => {
    const pack = THEMATIC_PACKS.find((p) => p.id === 'vie-au-village');
    assert.ok(pack, 'pack vie-au-village introuvable');
    assert.equal(pack.cards.length, 20);
    for (const card of pack.cards) {
      assert.match(card.id, /^c-rural-[a-z]+$/);
      for (const code of VARIETIES) {
        const entry = amazighEntry(card.fr, code);
        assert.ok(entry && entry.lat && entry.tif, `Carte rurale sans mot : ${card.id} (${code})`);
        assert.equal(cardWord(card, code, { scriptMode: 'latin' }), entry.lat);
        assert.equal(cardWord(card, code, { scriptMode: 'tifinagh' }), entry.tif);
      }
      assert.ok(cardWord(card, 'shi', { scriptMode: 'both' }).includes(' · '));
    }
  });

  await check('Écritures : tifinagh + latin, latin seul, tifinagh seul', () => {
    assert.equal(formatAmazighText({ lat: 'Aɣrum', tif: 'ⴰⵖⵔⵓⵎ' }, 'both'), 'Aɣrum · ⴰⵖⵔⵓⵎ');
    assert.equal(formatAmazighText({ lat: 'Aɣrum', tif: 'ⴰⵖⵔⵓⵎ' }, 'latin'), 'Aɣrum');
    assert.equal(formatAmazighText({ lat: 'Aɣrum', tif: 'ⴰⵖⵔⵓⵎ' }, 'tifinagh'), 'ⴰⵖⵔⵓⵎ');
    assert.equal(cardWord({ fr: 'Mot du parent' }, 'shi'), 'Mot du parent');
  });

  await check('Conjugaison amazighe (3 temps) et français / darija inchangés', () => {
    const by = (id) => cards.find((c) => c.id === id);
    const want = by('c-base-je-veux');
    const pain = by('c-manger-pain');
    const manger = by('c-actions-manger');
    for (const code of VARIETIES) {
      assert.equal(isAmazighLang(code), true);
      const forms = new Set();
      for (const tense of ['past', 'present', 'future']) {
        const res = inflectStrip([{ card: want, lang: code }, { card: pain, lang: code }], { tense, lang: code });
        assert.ok(res.sentenceAmazighLat.length > 5 && res.sentenceAmazighTif.length > 5);
        assert.equal(res.speechText, res.sentenceFr, 'la phrase amazighe ne doit pas partir vers la voix du téléphone');
        forms.add(inflectStrip([{ card: manger, lang: code }], { tense, lang: code }).sentenceAmazighLat);
      }
      assert.equal(forms.size, 3, `« Manger » doit changer avec le temps (${code}) : ${[...forms].join(' | ')}`);
    }
    const shi = inflectStrip([{ card: want, lang: 'shi' }, { card: pain, lang: 'shi' }], { tense: 'present', lang: 'shi' });
    assert.equal(shi.sentenceAmazighLat, 'Riɣ ad ččeɣ aɣrum');
    assert.equal(shi.sentenceAmazighTif, 'ⵔⵉⵖ ⴰⴷ ⵛⵛⵖ ⴰⵖⵔⵓⵎ');
    const fr = inflectStrip([{ card: want, lang: 'fr' }, { card: pain, lang: 'fr' }], { tense: 'present' });
    assert.equal(fr.sentenceFr, 'Je veux manger du pain');
    assert.equal(fr.sentenceDr, 'bghit nakoul l-khobz');
    assert.equal(fr.tokens[1].displayLabel, 'manger du pain');
    const dr = inflectStrip([{ card: want, lang: 'dr' }, { card: pain, lang: 'dr' }], { tense: 'present' });
    assert.equal(dr.tokens[1].displayLabel, 'nakoul l-khobz');
  });

  await check('Service worker : nouvelle version, modules amazighs, police, caches des voix gardés', () => {
    const sw = read('sw.js');
    const version = /const CACHE = 'kalimati-v(\d+)-(\d+)';/.exec(sw);
    assert.ok(version && (Number(version[1]) > 10 || (Number(version[1]) === 10 && Number(version[2]) >= 7)), 'CACHE doit être v10-7 ou plus');
    assert.match(sw, /kalimati-amazigh-voices-/);
    assert.match(sw, /\.\/modules\/amazigh-lexicon\.js/);
    assert.match(sw, /\.\/modules\/voice-packs\.js/);
    assert.match(sw, /NotoSansTifinagh-Regular\.woff2/);
    assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts/NotoSansTifinagh-Regular.woff2')).size > 10000, 'police tifinagh absente');
  });

  await check('Liste des cartes de l’outil PC à jour (node tools/export-amazigh-cards.mjs)', async () => {
    const { amazighCards } = await import(path.join(ROOT, 'tools/export-amazigh-cards.mjs'));
    const fresh = await amazighCards(ROOT);
    const saved = JSON.parse(read('tools/amazigh-cards.json'));
    assert.deepEqual(saved.cards, JSON.parse(JSON.stringify(fresh)), 'relancez : node tools/export-amazigh-cards.mjs');
    assert.equal(fresh.some((c) => /^c-personnes-(moi|ghita|hosna)$/.test(c.id)), false, 'carte personnelle dans la liste');
  });

  console.log(`\n🎉 Contrôles amazighs réussis (${passed}/${passed}).`);
}

main().catch((err) => {
  console.error('❌ Échec :', err.message || err);
  process.exit(1);
});
