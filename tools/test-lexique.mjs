import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, defaultCards } from '../data.js';
import { CORE_MOTOR_PLAN_V1 } from '../modules/core-vocabulary-plan.js';
import {
  parseCsv,
  validateCategoriesCsv,
  validateLexiqueCsv,
  computeReviewStatus,
  normalizeForbiddenText,
  containsForbiddenName,
  canonicalRevision,
  buildLexiqueData,
  renderLexiqueModule,
  renderMissingVoices,
  importLexique,
  planLexiqueApplication,
  isLexicallyCustomized,
  matchesHistoricalCard,
  cardPassesReviewFilter,
  computeLexiqueStats,
} from '../modules/lexique-core.js';
import { initLexiqueSettings } from '../modules/lexique-init.js';
import { layoutFingerprint } from '../modules/grid-layout.js';
import { writeOutputsAtomically } from '../tools/import-lexique.mjs';

const HEADER = 'wordId;niveau;palier;categorie;role;emoji;fr;dr_lat;dr_ar;ar;pos_2;pos_3;pos_4;pos_5;relecteur_fr;relecteur_dr;date_relecture;note;fonction';
const COLUMNS = HEADER.split(';');
const CATEGORY_HEADER = 'id;fr;dr;ar;emoji;color';
const TODAY = '2026-11-27';
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'tools', 'import-lexique.mjs');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const base = defaultCards();
const options = { categories: CATEGORIES, defaultCards: base, forbiddenNames: [], today: TODAY };

function fixtureWord(overrides = {}) {
  return {
    wordId: 'w-fixture', niveau: 'noyau', palier: '1', categorie: 'base', role: 'social',
    emoji: '🙂', fr: 'fixture', dr_lat: 'fixture', dr_ar: 'فيxtures', ar: '',
    pos_2: '1:1', pos_3: '1:1', pos_4: '1:1', pos_5: '1:1',
    relecteur_fr: '', relecteur_dr: '', date_relecture: '', note: '', fonction: '',
    ...overrides,
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function lexiqueCsv(rows, header = COLUMNS) {
  return `${header.join(';')}\n${rows.map((row) => header.map((key) => csvCell(row[key])).join(';')).join('\n')}\n`;
}

function validate(rows, extra = {}, header = COLUMNS) {
  return validateLexiqueCsv(lexiqueCsv(rows, header), { ...options, ...extra });
}

function hasReason(result, reason) {
  return result.errors.some((error) => error.reason === reason);
}

// 1. Exemple : 21 mots du plan moteur, tous brouillons, sans relecture choisie.
{
  const result = validateLexiqueCsv(await read('lexique/lexique-exemple.csv'), options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.words.length, 21);
  assert.ok(result.words.every((word) => word.status === 'brouillon'));
  for (const planned of CORE_MOTOR_PLAN_V1) {
    const word = result.words.find((entry) => entry.wordId === `w-${planned.id.slice(2)}`);
    const card = base.find((entry) => entry.id === planned.id);
    assert.ok(word, planned.id);
    assert.equal(word.fr, planned.fr);
    assert.equal(word.drLat, planned.dr);
    assert.equal(word.drAr, planned.ar);
    assert.equal(word.categorie, planned.cat);
    assert.equal(word.role, planned.gram);
    assert.equal(word.palier, planned.stage);
    assert.equal(word.emoji, card.emoji);
    assert.deepEqual(word.positions['4'], { row: planned.gridRow, col: planned.gridCol });
    assert.equal(word.legacyId, planned.id);
    assert.equal(word.relecteurFr, '');
    assert.equal(word.relecteurDr, '');
    assert.equal(word.dateRevision, '');
  }
  console.log('test-lexique 1 exemple : OK');
}

// 2. Parseur : BOM, CRLF, champs cités, guillemet échappé, multiligne, lignes vides.
{
  const parsed = parseCsv('\uFEFFa;b\r\n"x;y";"z""q"\r\n"ligne 1\n\nligne 3";v\r\n\r\n', ['a', 'b']);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.header, ['a', 'b']);
  assert.deepEqual(parsed.rows.map((row) => row.cells), [['x;y', 'z"q'], ['ligne 1\n\nligne 3', 'v']]);
  assert.equal(parsed.rows[1].line, 3);
  assert.equal(parseCsv('a;b\n"x;y', ['a', 'b']).errors[0].reason, 'guillemet_non_ferme');
  console.log('test-lexique 2 parseur : OK');
}

// 3. En-tête et structure : colonnes, ordre, cellules, guillemets.
{
  assert.ok(hasReason(validate([fixtureWord()], {}, COLUMNS.filter((column) => column !== 'fr')), 'colonne_manquante'));
  assert.ok(hasReason(validate([fixtureWord()], {}, [...COLUMNS, 'fr']), 'colonne_dupliquee'));
  assert.ok(hasReason(validate([fixtureWord()], {}, [...COLUMNS, 'inconnu']), 'colonne_inconnue'));
  const wrongOrder = [...COLUMNS];
  [wrongOrder[6], wrongOrder[7]] = [wrongOrder[7], wrongOrder[6]];
  assert.ok(hasReason(validate([fixtureWord()], {}, wrongOrder), 'ordre_colonnes_invalide'));
  const extraCell = `${HEADER}\n${COLUMNS.map((key) => csvCell(fixtureWord()[key])).join(';')};x\n`;
  assert.ok(hasReason(validateLexiqueCsv(extraCell, options), 'nombre_cellules_incorrect'));
  const missingCell = `${HEADER}\n${COLUMNS.slice(0, -1).map((key) => csvCell(fixtureWord()[key])).join(';')}\n`;
  assert.ok(hasReason(validateLexiqueCsv(missingCell, options), 'nombre_cellules_incorrect'));
  const optionalAbsent = validate([fixtureWord()], {}, COLUMNS.filter((column) => !['ar', 'note', 'fonction'].includes(column)));
  assert.deepEqual(optionalAbsent.errors, []);
  assert.equal(optionalAbsent.words[0].arStandard, '');
  const categoryOptions = { baseCategories: CATEGORIES, forbiddenNames: [], today: TODAY };
  const baseRedeclared = validateCategoriesCsv(`${CATEGORY_HEADER}\nbase;Base;دابا;قاعدة;🙂;#112233\n`, categoryOptions);
  assert.ok(hasReason(baseRedeclared, 'categorie_base_interdite'));
  const categoryWithoutArabic = validateCategoriesCsv(`${CATEGORY_HEADER}\nfixture;Fixture;Fixture;;🙂;#112233\n`, categoryOptions);
  assert.ok(categoryWithoutArabic.errors.some((error) => error.field === 'ar' && error.reason === 'champ_obligatoire_vide'));
  console.log('test-lexique 3 en-tete : OK');
}

// 4. Champs : identité, énumérations, textes, date et emoji.
{
  assert.ok(hasReason(validate([fixtureWord({ wordId: 'fixture' })]), 'wordId_invalide'));
  assert.ok(hasReason(validate([fixtureWord(), fixtureWord()]), 'wordId_duplique'));
  for (const [field, value] of [['niveau', 'autre'], ['palier', '5'], ['role', 'autre'], ['fonction', 'autre']]) {
    assert.ok(hasReason(validate([fixtureWord({ [field]: value })]), 'valeur_invalide'), field);
  }
  for (const field of ['fr', 'dr_lat', 'dr_ar']) {
    assert.ok(hasReason(validate([fixtureWord({ [field]: '   ' })]), 'champ_obligatoire_vide'), field);
    assert.ok(hasReason(validate([fixtureWord({ [field]: 'x'.repeat(41) })]), 'texte_trop_long'), field);
  }
  assert.ok(hasReason(validate([fixtureWord({ date_relecture: '2026-02-30' })]), 'date_invalide'));
  assert.ok(hasReason(validate([fixtureWord({ date_relecture: '2026-11-28' })]), 'date_future'));
  assert.ok(hasReason(validate([fixtureWord({ emoji: 'fixture' })]), 'emoji_invalide'));
  assert.ok(hasReason(validate([fixtureWord({ emoji: '🙂'.repeat(17) })]), 'emoji_trop_long'));
  assert.deepEqual(validate([fixtureWord({ emoji: '👩🏽‍⚕️', fr: '  fixture  ' })]).words[0].fr, 'fixture');
  console.log('test-lexique 4 champs : OK');
}

// 5. Positions : collision locale, catégories distinctes et bornes.
{
  const duplicate = validate([
    fixtureWord({ wordId: 'w-fixture-a' }),
    fixtureWord({ wordId: 'w-fixture-b' }),
  ]);
  assert.ok(hasReason(duplicate, 'position_dupliquee'));
  const separate = validate([
    fixtureWord({ wordId: 'w-fixture-a' }),
    fixtureWord({ wordId: 'w-fixture-b', categorie: 'manger' }),
  ]);
  assert.deepEqual(separate.errors, []);
  for (const position of ['0:1', '-1:1', '1.5:1', '1:0', '1:3']) {
    assert.ok(hasReason(validate([fixtureWord({ pos_2: position })]), 'position_invalide'), position);
  }
  console.log('test-lexique 5 positions : OK');
}

// 6. Statuts et deuxième voix indépendante.
{
  assert.equal(computeReviewStatus({ relecteurFr: 'AB' }), 'brouillon');
  assert.equal(computeReviewStatus({ relecteurDr: 'CD' }), 'relu-langue');
  assert.equal(computeReviewStatus({ relecteurFr: 'AB', relecteurDr: 'CD', dateRevision: '2026-11-01' }), 'relu-langue');
  assert.equal(computeReviewStatus({ relecteurFr: 'AB', relecteurDr: 'CD', dateRevision: '2026-11-01', secondVoice: 'EF' }), 'relu-clinique');
  assert.ok(hasReason(validate([fixtureWord({ relecteur_fr: 'AB', relecteur_dr: 'CD', note: '2e_voix=CD' })]), 'seconde_voix_identique'));
  assert.ok(hasReason(validate([fixtureWord({ relecteur_fr: 'AB', note: '2e_voix=AB' })]), 'seconde_voix_identique'));
  assert.ok(hasReason(validate([fixtureWord({ note: '2e_voix=abcdef' })]), 'note_invalide'));
  assert.ok(hasReason(validate([fixtureWord({ relecteur_dr: 'cd' })]), 'relecteur_invalide'));
  const complete = validate([fixtureWord({ relecteur_fr: 'AB', relecteur_dr: 'CD', date_relecture: '2026-11-01', note: ' 2e_voix = EF ' })]);
  assert.deepEqual(complete.errors, []);
  assert.equal(complete.words[0].secondVoice, 'EF');
  assert.equal(complete.words[0].status, 'relu-clinique');
  console.log('test-lexique 6 statuts : OK');
}

// 7. Confidentialité : champs textuels, catégories, coordonnées, erreurs sans valeur.
{
  const forbidden = ['NOMSYNTHETIQUE'];
  for (const field of ['fr', 'dr_lat', 'dr_ar', 'ar']) {
    const result = validate([fixtureWord({ [field]: 'fixture NOMSYNTHETIQUE' })], { forbiddenNames: forbidden });
    assert.ok(hasReason(result, 'nom_interdit'), field);
    assert.ok(!JSON.stringify(result.errors).includes('NOMSYNTHETIQUE'));
  }
  for (const value of ['https://fixture.invalid', 'fixture@fixture.invalid', '+212 600 000 000']) {
    const result = validate([fixtureWord({ fr: value })], { forbiddenNames: forbidden });
    assert.ok(hasReason(result, 'coordonnees_interdites'), value);
    assert.ok(!JSON.stringify(result.errors).includes(value));
  }
  const categoryResult = validateCategoriesCsv(`${CATEGORY_HEADER}\nfixture;NOMSYNTHETIQUE;fixture;فيxtures;🙂;#123ABC\n`, {
    baseCategories: CATEGORIES, forbiddenNames: forbidden, today: TODAY,
  });
  assert.ok(hasReason(categoryResult, 'nom_interdit'));
  assert.ok(!JSON.stringify(categoryResult.errors).includes('NOMSYNTHETIQUE'));
  assert.equal(normalizeForbiddenText('  Fîxture-ÉXEMPLE! '), 'fixture exemple');
  assert.equal(containsForbiddenName('bonjour NOMSYNTHETIQUE', forbidden), true);
  assert.equal(containsForbiddenName('fixture', forbidden), false);
  console.log('test-lexique 7 confidentialite : OK');
}

const temp = await mkdtemp(join(tmpdir(), 'kalimati-lexique-'));
try {
  // 8. Liste synthétique temporaire hors dépôt, utilisée par la CLI.
  {
    const source = join(temp, 'source.csv');
    const categories = join(temp, 'categories.csv');
    const forbidden = join(temp, 'liste.txt');
    const output = join(temp, 'lexique-data.js');
    const missing = join(temp, 'voix-manquantes.csv');
    await writeFile(source, lexiqueCsv([fixtureWord()]), 'utf8');
    await writeFile(categories, `${CATEGORY_HEADER}\n`, 'utf8');
    await writeFile(forbidden, '# fixture\nNOMTEMPORAIRE\n', 'utf8');
    const run = spawnSync(process.execPath, [cli, '--source', source, '--categories', categories, '--forbidden', forbidden, '--output', output, '--missing-output', missing], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(!run.stdout.includes(forbidden));
    assert.ok(!run.stderr.includes(forbidden));
    assert.match(await readFile(output, 'utf8'), /export const LEXIQUE/);
    console.log('test-lexique 8 liste temporaire : OK');
  }

  // 9. Validation sans écriture et restauration après panne du second remplacement.
  {
    const source = join(temp, 'invalide.csv');
    const categories = join(temp, 'categories.csv');
    const forbidden = join(temp, 'liste.txt');
    const output = join(temp, 'sentinelle.js');
    const missing = join(temp, 'sentinelle-voix.csv');
    await writeFile(source, lexiqueCsv([fixtureWord({ wordId: 'invalide' })]), 'utf8');
    await writeFile(categories, `${CATEGORY_HEADER}\n`, 'utf8');
    await writeFile(forbidden, 'NOMTEMPORAIRE\n', 'utf8');
    await writeFile(output, 'SENTINELLE-A', 'utf8');
    await writeFile(missing, 'SENTINELLE-B', 'utf8');
    const run = spawnSync(process.execPath, [cli, '--source', source, '--categories', categories, '--forbidden', forbidden, '--output', output, '--missing-output', missing], { encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.equal(await readFile(output, 'utf8'), 'SENTINELLE-A');
    assert.equal(await readFile(missing, 'utf8'), 'SENTINELLE-B');

    const files = new Map([['sortie.js', 'ANCIEN-A'], ['voix.csv', 'ANCIEN-B']]);
    const io = {
      readIfExists: async (path) => files.get(path) ?? null,
      write: async (path, content) => { files.set(path, content); },
      rename: async (from, to) => {
        if (to === 'voix.csv') throw new Error('panne second remplacement');
        files.set(to, files.get(from));
        files.delete(from);
      },
      removeIfExists: async (path) => { files.delete(path); },
    };
    await assert.rejects(writeOutputsAtomically({ outputPath: 'sortie.js', missingOutputPath: 'voix.csv', moduleText: 'NOUVEAU-A', missingCsv: 'NOUVEAU-B', io }), /panne second remplacement/);
    assert.equal(files.get('sortie.js'), 'ANCIEN-A');
    assert.equal(files.get('voix.csv'), 'ANCIEN-B');
    assert.ok(![...files.keys()].some((path) => path.includes('.tmp-')));
    console.log('test-lexique 9 atomicite : OK');
  }

  // 10. Génération déterministe, note exclue, révision stable LF/CRLF.
  {
    const row = fixtureWord({ relecteur_fr: 'AB', relecteur_dr: 'CD', date_relecture: '2026-11-01', note: '2e_voix=EF' });
    const lf = await importLexique({ sourceText: lexiqueCsv([row]), categoriesText: `${CATEGORY_HEADER}\n`, forbiddenNames: [], baseCategories: CATEGORIES, defaultCards: base, today: TODAY, voiceIndex: {} });
    const crlf = await importLexique({ sourceText: lexiqueCsv([row]).replaceAll('\n', '\r\n'), categoriesText: `${CATEGORY_HEADER}\r\n`, forbiddenNames: [], baseCategories: CATEGORIES, defaultCards: base, today: TODAY, voiceIndex: {} });
    assert.deepEqual(lf.errors, []);
    assert.deepEqual(crlf.errors, []);
    assert.equal(lf.data.revision, crlf.data.revision);
    assert.equal(renderLexiqueModule(lf.data), renderLexiqueModule(crlf.data));
    assert.ok(!('note' in lf.data.words[0]));
    assert.ok(!renderLexiqueModule(lf.data).includes('2e_voix='));
    assert.equal(lf.data.words[0].secondVoice, 'EF');
    assert.equal(await canonicalRevision(lf.data.categories, lf.data.words), lf.data.revision);
    const data = await buildLexiqueData({ categories: lf.data.categories, words: lf.data.words });
    assert.equal(data.revision, lf.data.revision);
    assert.equal(data.revision, createHash('sha256').update(JSON.stringify({ categories: data.categories, words: data.words })).digest('hex'));
    assert.equal(renderMissingVoices([], {}), 'wordId;langue\n');
    console.log('test-lexique 10 generation : OK');
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

function lexicalWord(overrides = {}) {
  const result = validate([fixtureWord(overrides)]);
  assert.deepEqual(result.errors, []);
  return result.words[0];
}

function positionsAt(row, col) {
  return Object.fromEntries(['2', '3', '4', '5'].map((cols) => [cols, { row, col }]));
}

function historicalCard(word, overrides = {}) {
  const card = structuredClone(base.find((entry) => entry.id === word.legacyId));
  assert.ok(card);
  return { ...card, wordId: card.id, ...overrides };
}

function memoryDb(settings = {}, cards = [], failWrites = false) {
  const values = new Map(Object.entries(settings));
  const writes = [];
  return {
    values,
    writes,
    async getSetting(key) { return values.get(key); },
    async setSetting(key, value) {
      if (failWrites) throw new Error('persistance indisponible');
      values.set(key, value);
      writes.push([key, value]);
    },
    async getAllCards() { return cards; },
  };
}

function memoryLocal(values = {}) {
  const items = new Map(Object.entries(values));
  return {
    items,
    getItem(key) { return items.get(key) ?? null; },
    setItem(key, value) { items.set(key, String(value)); },
  };
}

// 11. Carte historique exacte : rattachement, champs protégés et empreinte stable.
{
  const word = lexicalWord({
    wordId: 'w-base-oui', fr: 'Oui relu', dr_lat: 'Ah relu', dr_ar: 'اه مراجعة',
    relecteur_dr: 'CD',
  });
  const card = historicalCard(word, {
    photo: 'sentinel-photo', video: 'sentinel-video', audios: { fr: 'sentinel-voice' },
    audioFr: 'sentinel-fr', audioDr: 'sentinel-dr', hidden: true,
  });
  const before = structuredClone(card);
  const fingerprintBefore = await layoutFingerprint([card]);
  const plan = planLexiqueApplication({ words: [word], cards: [card], cols: 4, revision: 'revision-11', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.additions.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.changed.length, 1);
  const changed = plan.changed[0];
  assert.equal(changed.id, 'c-base-oui');
  assert.equal(changed.wordId, 'c-base-oui');
  assert.equal(changed.lexicon.wordId, 'w-base-oui');
  assert.equal(changed.lexicon.legacy, true);
  assert.equal(changed.lexicon.legacyFr, before.fr);
  assert.equal(changed.lexicon.status, 'relu-langue');
  assert.equal(changed.fr, word.fr);
  assert.equal(changed.dr, word.drLat);
  assert.equal(changed.ar, word.drAr);
  for (const field of ['id', 'wordId', 'photo', 'video', 'audios', 'audioFr', 'audioDr', 'hidden', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'sub', 'sayFr', 'sayAr', 'cat', 'emoji', 'gram']) {
    assert.deepEqual(changed[field], before[field], field);
  }
  assert.deepEqual(card, before);
  assert.equal(await layoutFingerprint([changed]), fingerprintBefore);
  console.log('test-lexique 11 historique : OK');
}

// 12. Correspondance stricte : famille et alias large intacts, création séparée.
{
  const word = lexicalWord();
  const family = { id: 'u-family', cat: 'base', fr: 'fixture', dr: 'fixture', ar: '', positions: positionsAt(1, 1) };
  const lookalike = { id: 'c-fixture', cat: 'base', fr: 'fixture', dr: 'fixture', ar: '', emoji: '🙂', gram: 'social', sub: '', sayFr: '', sayAr: '', positions: positionsAt(1, 1) };
  assert.equal(matchesHistoricalCard(family, { ...word, legacyId: 'u-family' }, base), false);
  assert.equal(matchesHistoricalCard(lookalike, word, base), false);
  const known = historicalCard(lexicalWord({ wordId: 'w-base-oui' }));
  assert.equal(matchesHistoricalCard(known, lexicalWord({ wordId: 'w-base-oui' }), base), true);
  assert.equal(matchesHistoricalCard({ ...known, fr: 'texte local' }, lexicalWord({ wordId: 'w-base-oui' }), base), false);
  const cards = [family, lookalike];
  const before = structuredClone(cards);
  const plan = planLexiqueApplication({ words: [word], cards, cols: 2, revision: 'revision-12', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.equal(plan.changed.length, 1);
  assert.equal(plan.additions[0].id, 'w-fixture');
  assert.deepEqual(plan.additions[0].positions['2'], { row: 1, col: 2 });
  assert.deepEqual(cards, before);
  console.log('test-lexique 12 correspondance stricte : OK');
}

// 13. Personnalisation textuelle conservée ; photo, voix, hidden et position seuls ne personnalisent pas.
{
  const word = lexicalWord();
  const initial = planLexiqueApplication({ words: [word], cards: [], cols: 2, revision: 'revision-13a', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  const owned = { ...initial.additions[0], fr: 'texte parent', dr: 'texte parent latin', ar: 'نص محلي', lexicon: { ...initial.additions[0].lexicon, customized: true } };
  const revisedWord = { ...word, fr: 'texte révisé', drLat: 'texte révisé latin', drAr: 'نص مراجع' };
  const next = planLexiqueApplication({ words: [revisedWord], cards: [owned], cols: 2, revision: 'revision-13b', now: '2026-11-28T00:00:00.000Z', defaultCards: base });
  assert.equal(next.changed[0].fr, 'texte parent');
  assert.equal(next.changed[0].dr, 'texte parent latin');
  assert.equal(next.changed[0].ar, 'نص محلي');
  assert.equal(next.changed[0].lexicon.customized, true);
  assert.equal(next.changed[0].lexicon.revision, 'revision-13b');

  const historicalWord = lexicalWord({ wordId: 'w-base-oui' });
  const mediaOnly = historicalCard(historicalWord, {
    photo: 'photo locale', audios: { fr: 'voix locale' }, hidden: true,
    positions: positionsAt(9, 2), gridRow: 9, gridCol: 2,
  });
  assert.equal(isLexicallyCustomized(mediaOnly, base.find((entry) => entry.id === 'c-base-oui')), false);
  const attached = planLexiqueApplication({ words: [{ ...historicalWord, fr: 'source révisée' }], cards: [mediaOnly], cols: 2, revision: 'revision-13c', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.equal(attached.changed[0].fr, 'source révisée');
  assert.equal(attached.changed[0].lexicon.customized, false);
  assert.equal(attached.changed[0].hidden, true);
  assert.deepEqual(attached.changed[0].positions, mediaOnly.positions);
  assert.equal(isLexicallyCustomized({ ...historicalCard(historicalWord), sub: 'précision parent' }, base.find((entry) => entry.id === 'c-base-oui')), true);
  console.log('test-lexique 13 personnalisation : OK');
}

// 14. Collision, changement de catégorie et grille sans place disponible.
{
  const word = lexicalWord();
  const occupant = { id: 'u-occupant', cat: 'base', positions: positionsAt(1, 1) };
  const collision = planLexiqueApplication({ words: [word], cards: [occupant], cols: 3, revision: 'revision-14a', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.deepEqual(collision.conflicts, []);
  assert.deepEqual(collision.additions[0].positions['3'], { row: 1, col: 2 });
  assert.equal(collision.report.moved, 1);
  assert.deepEqual(occupant.positions, positionsAt(1, 1));

  const created = planLexiqueApplication({ words: [word], cards: [], cols: 2, revision: 'revision-14b', now: '2026-11-27T00:00:00.000Z', defaultCards: base }).additions[0];
  const categoryConflict = planLexiqueApplication({ words: [{ ...word, categorie: 'manger' }], cards: [created], cols: 2, revision: 'revision-14c', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.equal(categoryConflict.changed.length, 0);
  assert.equal(categoryConflict.conflicts[0].reason, 'categorie_differente');
  assert.deepEqual(created.positions, positionsAt(1, 1));

  const fillers = Array.from({ length: 5 }, (_, index) => ({
    id: `u-fill-${index}`,
    cat: 'base',
    positions: Object.fromEntries([2, 3, 4, 5].map((cols) => [String(cols), { row: 1, col: (index % cols) + 1 }])),
  }));
  const full = planLexiqueApplication({ words: [word], cards: fillers, cols: 5, maxRows: 1, revision: 'revision-14d', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.equal(full.additions.length, 0);
  assert.equal(full.changed.length, 0);
  assert.equal(full.conflicts[0].reason, 'espace_epuise');
  assert.equal(fillers.length, 5);
  console.log('test-lexique 14 collisions : OK');
}

// 15. Réapplication idempotente et ligne retirée non destructive.
{
  const word = lexicalWord();
  const first = planLexiqueApplication({ words: [word], cards: [], cols: 2, revision: 'revision-15', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  const second = planLexiqueApplication({ words: [word], cards: first.additions, cols: 2, revision: 'revision-15', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.deepEqual(second.changed, []);
  assert.deepEqual(second.additions, []);
  assert.deepEqual(second.updates, []);
  const removed = planLexiqueApplication({ words: [], cards: first.additions, cols: 2, revision: 'revision-15', now: '2026-11-27T00:00:00.000Z', defaultCards: base });
  assert.deepEqual(removed.changed, []);
  assert.equal(first.additions.length, 1);
  assert.equal(first.additions[0].lexicon.status, 'brouillon');
  console.log('test-lexique 15 reapplication : OK');
}

// 16. Initialisation : téléphone neuf, installation, choix explicite, marqueurs et repli.
{
  const freshDb = memoryDb();
  const freshLocal = memoryLocal();
  const fresh = await initLexiqueSettings({ db: freshDb, localStorage: freshLocal, rawChildren: null });
  assert.equal(fresh.onlyReviewed, true);
  assert.equal(fresh.emojiSkinTone, 'default');
  assert.equal(freshDb.values.get('lexiqueV1Initialized'), true);
  assert.equal(freshLocal.items.get('kalimati-lexique-v1-seen'), '1');
  const again = await initLexiqueSettings({ db: freshDb, localStorage: freshLocal, rawChildren: null });
  assert.equal(again.onlyReviewed, true);
  assert.equal(again.emojiSkinTone, 'default');

  const installedCases = [
    [memoryDb({ lexiqueV1Initialized: true }), memoryLocal(), null],
    [memoryDb({}, [{ id: 'u-fixture' }]), memoryLocal(), null],
    [memoryDb({ seeded: true }), memoryLocal(), null],
    [memoryDb({ lang: 'fr' }), memoryLocal(), null],
    [memoryDb(), memoryLocal(), '[{"id":"main"}]'],
    [memoryDb(), memoryLocal({ 'kalimati-lexique-v1-seen': '1' }), null],
  ];
  for (const [db, localStorage, rawChildren] of installedCases) {
    const settings = await initLexiqueSettings({ db, localStorage, rawChildren });
    assert.equal(settings.onlyReviewed, false);
  }
  for (const key of ['lang', 'cols', 'darijaScript', 'profile', 'layoutFingerprint', 'levels']) {
    const settings = await initLexiqueSettings({ db: memoryDb({ [key]: key === 'cols' ? 2 : 'present' }), localStorage: memoryLocal(), rawChildren: null });
    assert.equal(settings.onlyReviewed, false, key);
  }
  const explicit = await initLexiqueSettings({ db: memoryDb({ onlyReviewed: true, lexiqueV1Initialized: true, emojiSkinTone: '3' }), localStorage: memoryLocal(), rawChildren: '[{"id":"main"}]' });
  assert.deepEqual(explicit, { onlyReviewed: true, emojiSkinTone: '3' });
  const failed = await initLexiqueSettings({ db: memoryDb({}, [], true), localStorage: memoryLocal(), rawChildren: null });
  assert.equal(failed.onlyReviewed, false);
  assert.equal(failed.emojiSkinTone, 'default');
  console.log('test-lexique 16 initialisation : OK');
}

// 17. Filtre enfant sans mutation, statuts recalculés et hidden prioritaire.
{
  const proofs = { relecteurFr: 'AB', relecteurDr: 'CD', dateRevision: '2026-11-01', secondVoice: 'EF' };
  const cards = [
    { id: 'w-draft', hidden: false, lexicon: { owned: true, customized: false, legacy: false, wordId: 'w-draft', status: 'relu-clinique' } },
    { id: 'w-language', hidden: false, lexicon: { owned: true, customized: false, legacy: false, wordId: 'w-language', relecteurDr: 'CD', status: 'brouillon' } },
    { id: 'w-clinical', hidden: false, lexicon: { owned: true, customized: false, legacy: false, wordId: 'w-clinical', ...proofs, status: 'brouillon' } },
    { id: 'w-custom', hidden: false, lexicon: { owned: true, customized: true, legacy: false, wordId: 'w-custom' } },
    { id: 'w-legacy', hidden: false, lexicon: { owned: true, customized: false, legacy: true, wordId: 'w-legacy' } },
    { id: 'c-base-oui', hidden: false, lexicon: { owned: false, wordId: 'w-base-oui' } },
    { id: 'u-family', hidden: false },
    { id: 'w-hidden', hidden: true, lexicon: { owned: true, customized: false, legacy: false, wordId: 'w-hidden', ...proofs } },
  ];
  const before = structuredClone(cards);
  assert.deepEqual(cards.map((card) => cardPassesReviewFilter(card, { onlyReviewed: true })), [false, true, true, true, true, true, true, false]);
  assert.equal(cardPassesReviewFilter(cards[0], { parent: true, onlyReviewed: true }), true);
  assert.equal(cardPassesReviewFilter(cards[7], { parent: true, onlyReviewed: true }), false);
  assert.equal(cardPassesReviewFilter(cards[0], { onlyReviewed: false }), true);
  assert.deepEqual(cards, before);
  console.log('test-lexique 17 filtre : OK');
}

// 18. Statistiques exactes, y compris les catégories et paliers à zéro.
{
  const words = [
    { wordId: 'w-a', categorie: 'base', palier: 1, relecteurFr: '', relecteurDr: '' },
    { wordId: 'w-b', categorie: 'base', palier: 2, relecteurFr: '', relecteurDr: 'CD' },
    { wordId: 'w-c', categorie: 'manger', palier: 4, relecteurFr: 'AB', relecteurDr: 'CD', dateRevision: '2026-11-01', secondVoice: 'EF' },
    { wordId: 'w-d', categorie: 'custom', palier: 4, relecteurFr: 'AB', relecteurDr: 'CD', dateRevision: '2026-11-01', secondVoice: 'EF' },
  ];
  const categories = [{ id: 'base' }, { id: 'manger' }, { id: 'custom' }, { id: 'empty' }];
  const cards = [
    { lexicon: { owned: true, wordId: 'w-a' } },
    { lexicon: { owned: true, wordId: 'w-c' } },
    { lexicon: { owned: false } },
  ];
  assert.deepEqual(computeLexiqueStats(words, cards, categories), {
    total: 4,
    applied: 2,
    byStatus: { brouillon: 1, 'relu-langue': 1, 'relu-clinique': 2 },
    byPalier: { 1: 1, 2: 1, 3: 0, 4: 2 },
    byCategory: { base: 2, manger: 1, custom: 1, empty: 0 },
  });
  assert.deepEqual(computeLexiqueStats([], [], []), {
    total: 0,
    applied: 0,
    byStatus: { brouillon: 0, 'relu-langue': 0, 'relu-clinique': 0 },
    byPalier: { 1: 0, 2: 0, 3: 0, 4: 0 },
    byCategory: {},
  });
  console.log('test-lexique 18 statistiques : OK');
}

// 19. Teintes : six valeurs, personnes compatibles, ZWJ et carte source intacte.
{
  const {
    SKIN_TONES,
    SKIN_TONE_LABELS,
    setEmojiSkinTone,
    getEmojiSkinTone,
    emojiForItem,
  } = await import('../modules/emoji-skin-tone.js');
  assert.deepEqual(SKIN_TONES, ['default', '1', '2', '3', '4', '5']);
  assert.deepEqual(SKIN_TONE_LABELS, {
    default: 'Jaune par défaut',
    1: 'Claire',
    2: 'Moyennement claire',
    3: 'Moyenne',
    4: 'Moyennement foncée',
    5: 'Foncée',
  });
  const expected = {
    default: '👩‍⚕️',
    1: '👩🏻‍⚕️',
    2: '👩🏼‍⚕️',
    3: '👩🏽‍⚕️',
    4: '👩🏾‍⚕️',
    5: '👩🏿‍⚕️',
  };
  const modifiers = { default: '', 1: '🏻', 2: '🏼', 3: '🏽', 4: '🏾', 5: '🏿' };
  const multi = '👩🏽‍🤝‍👨🏻';
  for (const tone of SKIN_TONES) {
    setEmojiSkinTone(tone);
    assert.equal(getEmojiSkinTone(), tone);
    assert.equal(emojiForItem({ emoji: '👩🏽‍⚕️', gram: 'person' }), expected[tone]);
    assert.equal(emojiForItem({ emoji: multi, lexicon: { role: 'person' } }), `👩${modifiers[tone]}‍🤝‍👨${modifiers[tone]}`);
    assert.equal(emojiForItem({ emoji: '👩🏽‍⚕️', gram: 'noun' }), '👩🏽‍⚕️');
    assert.equal(emojiForItem({ emoji: '🙂', gram: 'person' }), '🙂');
  }
  setEmojiSkinTone('3');
  const card = Object.freeze({
    emoji: '👩🏽‍⚕️',
    gram: 'person',
    photo: 'photo-parent',
    audios: Object.freeze({ fr: 'voix-parent' }),
    hidden: true,
    positions: Object.freeze({ 4: Object.freeze({ row: 2, col: 3 }) }),
  });
  const before = structuredClone(card);
  assert.equal(emojiForItem(card), '👩🏽‍⚕️');
  assert.deepEqual(card, before);
  setEmojiSkinTone('invalide');
  assert.equal(getEmojiSkinTone(), '3');
  console.log('test-lexique 19 teintes : OK');
}

// 20. Voix : inventaire exact, alias lexicaux et ordre parent/MP3/local sans réseau.
{
  const words = [
    { wordId: 'w-voix-a', legacyId: 'c-base-oui', fr: 'Oui', drAr: 'اه', arStandard: 'نعم' },
    { wordId: 'w-voix-b', legacyId: 'c-manger-pain', fr: 'Pain relu', drAr: 'ناكل', arStandard: '' },
  ];
  const voiceIndex = {
    dr: { 'c-base-oui': 'اه', 'c-manger-pain': 'ناكل' },
    fr: { 'c-base-oui': 'Oui', 'c-manger-pain': 'Pain' },
  };
  const voiceFiles = new Set(['dr/c-base-oui.mp3', 'fr/c-base-oui.mp3']);
  assert.equal(renderMissingVoices(words, voiceIndex, voiceFiles), 'wordId;langue\nw-voix-b;dr\nw-voix-b;fr\n');

  const index = JSON.parse(await read('voix/index.json'));
  const audioStarts = [];
  const spoken = [];
  let fetchCalls = 0;
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => [{ name: 'voix locale fixture', lang: 'fr-FR', localService: true }],
    addEventListener: () => {},
    resume: () => {},
    cancel: () => {},
    speak: (utterance) => {
      spoken.push(utterance);
      queueMicrotask(() => utterance.onend?.());
    },
  };
  class FakeAudio {
    constructor(src) {
      this.src = src;
      audioStarts.push(src);
    }
    play() {
      queueMicrotask(() => {
        this.onplaying?.();
        this.onended?.();
      });
      return Promise.resolve();
    }
    pause() {}
  }
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  class FakeElement {}
  class FakeDocumentFragment {}
  class FakeDocument {}
  const previous = {
    fetch: globalThis.fetch,
    Audio: globalThis.Audio,
    SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance,
    window: globalThis.window,
    navigator: globalThis.navigator,
    Element: globalThis.Element,
    DocumentFragment: globalThis.DocumentFragment,
    Document: globalThis.Document,
  };
  try {
    Object.defineProperty(globalThis, 'Element', { configurable: true, value: FakeElement });
    Object.defineProperty(globalThis, 'DocumentFragment', { configurable: true, value: FakeDocumentFragment });
    Object.defineProperty(globalThis, 'Document', { configurable: true, value: FakeDocument });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { speechSynthesis: synth, addEventListener: () => {} } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'fixture', onLine: true } });
    globalThis.Audio = FakeAudio;
    globalThis.SpeechSynthesisUtterance = FakeUtterance;
    globalThis.fetch = async (url) => {
      assert.equal(url, './voix/index.json');
      fetchCalls += 1;
      return { ok: true, json: async () => index };
    };
    const { loadDefaultVoices, defaultVoiceUrl, sayCard } = await import('../speech.js');
    await loadDefaultVoices();
    assert.equal(defaultVoiceUrl({ id: 'u-fixture', lexicon: { wordId: 'c-base-oui' }, wordId: 'c-base-non', sayFr: 'Oui' }, 'fr'), './voix/fr/c-base-oui.mp3');
    assert.equal(defaultVoiceUrl({ id: 'u-fixture', wordId: 'c-base-oui', sayFr: 'Oui' }, 'fr'), './voix/fr/c-base-oui.mp3');
    assert.equal(defaultVoiceUrl({ id: 'c-base-oui', fr: 'Oui' }, 'fr'), './voix/fr/c-base-oui.mp3');
    assert.equal(defaultVoiceUrl({ id: 'c-base-oui', sayFr: 'Texte modifié' }, 'fr'), null);
    assert.equal(defaultVoiceUrl({ id: 'u-fixture', lexicon: { wordId: 'c-base-oui' }, sayAr: index.dr['c-base-oui'] }, 'dr'), './voix/dr/c-base-oui.mp3');

    await sayCard({ id: 'u-parent', lexicon: { wordId: 'c-base-oui' }, sayFr: 'Oui', audios: { fr: new Blob(['voix parent']) } }, 'fr');
    assert.equal(audioStarts.length, 1);
    assert.match(audioStarts[0], /^blob:/);
    assert.equal(spoken.length, 0);

    audioStarts.length = 0;
    await sayCard({ id: 'u-index', lexicon: { wordId: 'c-base-oui' }, sayFr: 'Oui' }, 'fr');
    assert.deepEqual(audioStarts, ['./voix/fr/c-base-oui.mp3']);
    assert.equal(spoken.length, 0);

    audioStarts.length = 0;
    await sayCard({ id: 'u-local', fr: 'Texte local' }, 'fr');
    assert.deepEqual(audioStarts, []);
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].text, 'Texte local');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    globalThis.Audio = previous.Audio;
    globalThis.SpeechSynthesisUtterance = previous.SpeechSynthesisUtterance;
    if (previous.window === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previous.window });
    if (previous.navigator === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previous.navigator });
    for (const name of ['Element', 'DocumentFragment', 'Document']) {
      if (previous[name] === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, { configurable: true, value: previous[name] });
    }
  }
  console.log('test-lexique 20 voix : OK');
}

// 21. Sauvegarde : liste blanche lexicale, emoji ZWJ, réglages et champs locaux protégés.
{
  const { readBackup, mergeBackupCards, mergeBackupSetting } = await import('../backup.js');
  const { sanitizeLexiconMetadata } = await import('../modules/lexique-core.js');
  const { dataUrlToBlob } = await import('../media.js');
  const decodedPhoto = await dataUrlToBlob('data:image/png;base64,cGhvdG8=');
  assert.equal(decodedPhoto.type, 'image/png', 'le décodage local ne conserve pas le marqueur base64 dans le type MIME');
  assert.equal(await decodedPhoto.text(), 'photo', 'les octets base64 sont restaurés sans fetch');
  const decodedText = await dataUrlToBlob('data:text/plain;charset=utf-8,Texte%20neutre');
  assert.equal(decodedText.type, 'text/plain;charset=utf-8', 'les paramètres MIME utiles sont conservés');
  assert.equal(await decodedText.text(), 'Texte neutre', 'les données texte percent-encodées sont restaurées');
  const emoji = '👩🏽‍🤝‍👨🏻';
  assert.ok(emoji.length > 8 && emoji.length <= 32, 'la fixture dépasse l’ancienne limite de 8 unités');
  const metadata = {
    owned: true, legacy: false, customized: false, wordId: 'w-restauration', revision: 'a'.repeat(64),
    niveau: 'noyau', palier: 2, fonction: 'question', sourceCategory: 'base', role: 'social',
    arStandard: 'نص مصدر', legacyFr: '', relecteurFr: 'RF', relecteurDr: 'DD',
    dateRevision: '2026-11-20', secondVoice: 'ZZ', status: 'brouillon',
  };
  const rawCard = {
    id: 'w-restauration', wordId: 'w-restauration', cat: 'base', fr: 'Texte source', dr: 'Source', ar: 'مصدر',
    emoji, gram: 'social', sub: '', sayFr: '', sayAr: '', hidden: false, order: 1,
    positions: { 4: { row: 1, col: 1 } }, gridRow: 1, gridCol: 1,
    lexicon: {
      ...metadata,
      note: 'note privée', url: 'https://example.invalid/photo', email: 'fixture@example.invalid',
      phone: '+33 1 23 45 67 89', unknown: 'clé inconnue',
    },
  };
  const backup = await readBackup(new File([JSON.stringify({
    format: 'kalimati-backup-v4', cards: [rawCard], settings: { onlyReviewed: true, emojiSkinTone: '5' },
  })], 'fixture.json', { type: 'application/json' }));
  assert.equal(backup.cards[0].emoji, emoji, 'la séquence ZWJ n’est pas tronquée');
  assert.deepEqual(backup.cards[0].lexicon, { ...metadata, status: 'relu-clinique' }, 'seuls les champs lexicaux définis survivent');
  for (const field of ['note', 'url', 'email', 'phone', 'unknown']) {
    assert.equal(Object.hasOwn(backup.cards[0].lexicon, field), false, field);
  }
  const unsafeMetadata = sanitizeLexiconMetadata({
    ...metadata, legacyFr: 'https://example.invalid', arStandard: 'fixture@example.invalid', relecteurFr: 'RF 0123456789',
  });
  assert.equal(unsafeMetadata.legacyFr, '', 'un chemin ou une URL dans le texte source est ignoré');
  assert.equal(unsafeMetadata.arStandard, '', 'un e-mail dans le texte source est ignoré');
  assert.equal(unsafeMetadata.relecteurFr, '', 'un code de relecture avec coordonnées est ignoré');
  assert.equal(unsafeMetadata.status, 'relu-langue', 'le statut est recalculé depuis les preuves assainies');

  const local = {
    id: 'w-restauration', wordId: 'w-restauration', cat: 'base', fr: 'Texte parent local', dr: 'Darija local', ar: 'عربي محلي',
    emoji: '👩🏽‍⚕️', gram: 'person', sub: 'sous-titre local', sayFr: 'voix indexée locale', sayAr: 'صوت محلي',
    hidden: true, order: 4, positions: { 2: { row: 3, col: 1 } }, gridRow: 3, gridCol: 1, visualKey: 'local:cle',
    photo: new Blob(['photo locale'], { type: 'image/png' }), video: new Blob(['vidéo locale'], { type: 'video/webm' }),
    audios: { fr: new Blob(['voix locale'], { type: 'audio/webm' }) },
    audioFr: new Blob(['ancienne voix fr'], { type: 'audio/webm' }), audioDr: new Blob(['ancienne voix dr'], { type: 'audio/webm' }),
    updatedAt: 500,
    lexicon: {
      ...metadata, revision: 'b'.repeat(64), fonction: 'commentaire', palier: 1, customized: true,
      relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '', status: 'brouillon',
    },
  };
  const incoming = {
    ...backup.cards[0], fr: 'Texte distant', dr: 'Darija distant', ar: 'عربي بعيد', emoji: '🙂', gram: 'noun',
    sub: 'sous-titre distant', sayFr: 'voix indexée distante', sayAr: 'صوت بعيد', hidden: false, order: 99,
    positions: { 2: { row: 9, col: 2 }, 3: { row: 8, col: 1 }, 4: { row: 7, col: 2 }, 5: { row: 6, col: 1 } },
    gridRow: 9, gridCol: 2, visualKey: 'remote:cle', updatedAt: 100,
    photo: new Blob(['photo distante'], { type: 'image/png' }), video: new Blob(['vidéo distante'], { type: 'video/webm' }),
    audios: { fr: new Blob(['voix distante'], { type: 'audio/webm' }) },
    audioFr: new Blob(['ancienne voix distante'], { type: 'audio/webm' }), audioDr: new Blob(['ancienne voix dr distante'], { type: 'audio/webm' }),
    lexicon: { ...metadata, revision: 'c'.repeat(64), fonction: 'question', palier: 4, customized: false },
  };
  const sparseLocal = {
    id: 'w-restauration-absent', cat: 'base', fr: 'Texte local absent', dr: '', ar: '', emoji: '🙂', gram: 'noun',
    lexicon: { ...metadata, wordId: 'w-restauration-absent', customized: true, relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '' },
  };
  const sparseIncoming = {
    ...incoming, id: sparseLocal.id, wordId: sparseLocal.id,
    lexicon: { ...incoming.lexicon, wordId: sparseLocal.id },
  };
  const newIncoming = {
    ...incoming, id: 'w-restauration-neuf', wordId: 'w-restauration-neuf',
    lexicon: { ...incoming.lexicon, wordId: 'w-restauration-neuf' },
  };
  const family = { id: 'u-famille-fixture', cat: 'base', fr: 'Carte familiale', positions: { 4: { row: 20, col: 4 } } };
  const restored = mergeBackupCards([local, sparseLocal, family], [incoming, sparseIncoming, newIncoming]);
  const merged = restored.find((card) => card.id === local.id);
  for (const field of [
    'id', 'wordId', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'emoji', 'gram', 'cat', 'sub',
    'sayFr', 'sayAr', 'hidden', 'photo', 'video', 'audios', 'audioFr', 'audioDr',
  ]) {
    assert.deepEqual(merged[field], local[field], `${field} local conservé exactement`);
  }
  assert.equal(merged.fr, local.fr, 'le texte personnalisé local gagne');
  assert.equal(merged.dr, local.dr);
  assert.equal(merged.ar, local.ar);
  assert.equal(merged.lexicon.revision, incoming.lexicon.revision, 'le snapshot relu le plus élevé est retenu');
  assert.equal(merged.lexicon.fonction, 'question');
  assert.equal(merged.lexicon.arStandard, metadata.arStandard, 'le texte source accompagne les preuves du même snapshot');
  assert.equal(merged.lexicon.relecteurFr, 'RF');
  assert.equal(merged.lexicon.status, 'relu-clinique');
  assert.equal(merged.lexicon.customized, true, 'customized est la réunion logique');
  assert.equal(merged.updatedAt, 500, 'la date maximale est conservée');

  const sparse = restored.find((card) => card.id === sparseLocal.id);
  for (const field of ['wordId', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'photo', 'video', 'audios', 'audioFr', 'audioDr']) {
    assert.equal(Object.hasOwn(sparse, field), false, `${field} absent localement reste absent`);
  }
  assert.equal(Object.hasOwn(sparse, 'hidden'), Object.hasOwn(sparseLocal, 'hidden'), 'la présence de hidden reste locale');
  assert.deepEqual(sparse.hidden, sparseLocal.hidden, 'hidden absent localement reste absent');
  assert.deepEqual(restored.find((card) => card.id === newIncoming.id), newIncoming, 'seule une carte entièrement nouvelle reçoit layout et médias distants');
  assert.deepEqual(restored.find((card) => card.id === family.id), family, 'aucune carte familiale n’est supprimée ou modifiée');

  assert.equal(mergeBackupSetting('onlyReviewed', false, true), false, 'false local explicitement défini gagne');
  assert.equal(mergeBackupSetting('emojiSkinTone', '3', '5'), '3', 'la teinte locale définie gagne');
  assert.equal(mergeBackupSetting('onlyReviewed', undefined, true), true, 'une valeur locale absente est remplie');
  assert.equal(mergeBackupSetting('emojiSkinTone', null, '5'), '5', 'une valeur locale nulle est absente');
  assert.equal(mergeBackupSetting('cols', 2, 5), 5, 'la fusion des autres réglages reste inchangée');
  console.log('test-lexique 21 sauvegarde : OK');
}

console.log('test-lexique groupes 1-21 : OK');
