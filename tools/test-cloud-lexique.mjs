import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ROOT = new URL('../', import.meta.url);
const cloudSource = readFileSync(new URL('modules/cloud-sync.js', ROOT), 'utf8');
for (const name of ['Element', 'DocumentFragment', 'Document']) if (!globalThis[name]) globalThis[name] = class {};
const { mergeCardLayout } = await import('../modules/grid-layout.js');
const { isNewer } = await import('../modules/util.js');
const { mergeLexicalCard, sanitizeLexiconMetadata } = await import('../modules/lexique-core.js');
const { dataUrlToBlob } = await import('../media.js');

const metadata = (wordId, overrides = {}) => ({
  owned: true,
  legacy: false,
  customized: true,
  wordId,
  revision: 'a'.repeat(64),
  niveau: 'noyau',
  palier: 1,
  fonction: 'nom',
  sourceCategory: 'base',
  role: 'noun',
  arStandard: 'نص محايد',
  legacyFr: 'Texte source local',
  relecteurFr: '',
  relecteurDr: '',
  dateRevision: '',
  secondVoice: '',
  ...overrides,
});

const clinicalMetadata = (wordId, overrides = {}) => metadata(wordId, {
  customized: false,
  revision: 'b'.repeat(64),
  niveau: 'frange',
  palier: 4,
  fonction: 'question',
  role: 'person',
  arStandard: 'نص بعيد محايد',
  legacyFr: 'Texte source distant',
  relecteurFr: 'RF',
  relecteurDr: 'RD',
  dateRevision: '2026-01-02',
  secondVoice: 'RV',
  ...overrides,
});

const localPhoto = new Blob(['photo locale'], { type: 'image/png' });
const localVideo = new Blob(['video locale'], { type: 'video/webm' });
const localAudio = new Blob(['voix locale'], { type: 'audio/webm' });
const localAudioDr = new Blob(['voix dr locale'], { type: 'audio/webm' });
const local = {
  id: 'w-cloud-local', wordId: 'w-cloud-local', updatedAt: 500,
  fr: 'Texte personnalisé local', dr: 'Texte local', ar: 'نص محلي',
  positions: { 2: { row: 2, col: 1 } }, gridRow: 2, gridCol: 1, order: 7,
  visualKey: 'visuel-local', emoji: '🙂', gram: 'noun', cat: 'base', sub: 'essentiel',
  sayFr: 'voix fr locale', sayAr: 'voix ar locale', hidden: true,
  photo: localPhoto, video: localVideo, audios: { fr: localAudio }, audioFr: localAudio, audioDr: localAudioDr,
  lexicon: metadata('w-cloud-local'),
};
const sparseLocal = {
  id: 'w-cloud-absent', updatedAt: 500, cat: 'base',
  fr: 'Texte absent local', dr: '', ar: '', emoji: '🙂', gram: 'noun',
  lexicon: metadata('w-cloud-absent'),
};
const unknownLocal = { id: 'c-inconnu-cloud', updatedAt: 100, cat: 'base', fr: 'Carte historique inconnue', positions: { 4: { row: 9, col: 2 } } };
const remotePhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const remoteAudio = 'data:audio/webm;base64,dm9peCBkaXN0YW50ZQ==';
const remoteCard = (card, wordId, overrides = {}) => ({
  ...card,
  id: wordId,
  wordId,
  updatedAt: 400,
  cat: 'base',
  positions: { 2: { row: 8, col: 2 }, 3: { row: 7, col: 3 }, 4: { row: 6, col: 4 }, 5: { row: 5, col: 5 } },
  gridRow: 8, gridCol: 2, order: 99,
  visualKey: 'visuel-distant', emoji: '🧑🏽‍🦰', gram: 'verb', sub: 'distant',
  sayFr: 'voix fr distante', sayAr: 'voix ar distante', hidden: false,
  photo: remotePhoto, video: null, audios: { fr: remoteAudio }, audioFr: null, audioDr: null,
  lexicon: clinicalMetadata(wordId),
  ...overrides,
});
const remoteExisting = remoteCard({}, 'w-cloud-local', { fr: 'Texte distant', dr: 'Texte dr distant', ar: 'نص بعيد' });
const remoteSparse = remoteCard({}, 'w-cloud-absent', { fr: 'Texte distant absent', dr: '', ar: '' });
const remoteUnknown = remoteCard({}, 'c-inconnu-cloud', {
  wordId: 'w-inconnu-cloud', updatedAt: 400,
  lexicon: clinicalMetadata('w-inconnu-cloud', { legacy: true }),
});
const remoteNew = remoteCard({}, 'w-cloud-neuf', {
  updatedAt: 300,
  fr: 'Carte neuve',
  lexicon: { ...clinicalMetadata('w-cloud-neuf'), note: 'note exclue' },
});

let cards = [local, sparseLocal, unknownLocal];
const settings = new Map([
  ['onlyReviewed', false],
  ['emojiSkinTone', '2'],
]);
const empty = () => [];
const db = {
  getAllCards: async () => cards,
  getAllTrials: empty,
  getAllAbcLogs: empty,
  getAllOrthoLogs: empty,
  getAllScheduleLogs: empty,
  getAllVisualOverrides: empty,
  getScheduleConfig: async () => null,
  getSetting: async (key) => settings.get(key),
  setSetting: async (key, value) => { settings.set(key, value); },
  putCards: async (next) => { cards = next.map((card) => ({ ...card })); },
  putTrials: empty,
  putAbcLogs: empty,
  putOrthoLogs: empty,
  addScheduleLog: empty,
  putScheduleConfig: empty,
  putVisualOverrides: empty,
};
const context = {
  db,
  KalimatiStorage: { isTrial: () => false },
  isTeamMode: () => true,
  requireTeamMode: () => {},
  logDiagnostic: () => {},
  profile: {},
  clinic: {},
  navigator: { onLine: true },
  location: { pathname: '/', search: '', hash: '', origin: 'http://127.0.0.1' },
  crypto: globalThis.crypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Blob,
  URL,
  btoa,
  atob,
  setTimeout,
  clearTimeout,
  mergeCardLayout,
  mergeLexicalCard,
  sanitizeLexiconMetadata,
  isNewer,
  dataUrlToBlob,
  blobToDataUrl: async (blob) => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`,
};
context.window = context;
vm.createContext(context);
vm.runInContext(cloudSource.replace(/^import .*;$/gm, '').replace(/^export /gm, ''), context);

const remote = {
  schema: 'kalimati-sync-v1',
  exportedAt: 600,
  authorRole: 'Équipe',
  cards: [remoteExisting, remoteSparse, remoteUnknown, remoteNew],
  settings: { onlyReviewed: true, emojiSkinTone: '5' },
};
const report = await context.mergeRemoteSyncPayload(remote);
const merged = cards.find((card) => card.id === local.id);
assert.equal(merged.lexicon.status, 'relu-clinique', 'une modification locale plus récente ne bloque pas le snapshot lexical mieux relu');
assert.equal(merged.lexicon.revision, 'b'.repeat(64));
assert.equal(merged.lexicon.fonction, 'question');
assert.equal(merged.lexicon.niveau, 'frange');
assert.equal(merged.lexicon.palier, 4);
assert.equal(merged.lexicon.role, 'person');
assert.equal(merged.lexicon.arStandard, 'نص بعيد محايد');
assert.equal(merged.lexicon.legacyFr, 'Texte source distant');
assert.equal(merged.lexicon.relecteurFr, 'RF');
assert.equal(merged.lexicon.relecteurDr, 'RD');
assert.equal(merged.lexicon.dateRevision, '2026-01-02');
assert.equal(merged.lexicon.secondVoice, 'RV');
assert.equal(merged.lexicon.customized, true, 'customized est la réunion logique');
assert.equal(merged.fr, local.fr, 'le texte personnalisé local gagne toujours');
assert.equal(merged.dr, local.dr);
assert.equal(merged.ar, local.ar);
assert.equal(merged.updatedAt, 500, 'updatedAt conserve le maximum');
for (const field of ['id', 'wordId', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'emoji', 'gram', 'cat', 'sub', 'sayFr', 'sayAr', 'hidden', 'photo', 'video', 'audios', 'audioFr', 'audioDr']) {
  assert.deepEqual(merged[field], local[field], `${field} local protégé exactement`);
}
assert.equal(Object.hasOwn(merged.lexicon, 'note'), false);

const sparse = cards.find((card) => card.id === sparseLocal.id);
for (const field of ['wordId', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'hidden', 'photo', 'video', 'audios', 'audioFr', 'audioDr']) {
  assert.equal(Object.hasOwn(sparse, field), false, `${field} absent localement reste absent après cloud`);
}
assert.equal(sparse.lexicon.status, 'relu-clinique');
assert.equal(sparse.updatedAt, 500);

const unknown = cards.find((card) => card.id === unknownLocal.id);
assert.equal(Object.hasOwn(unknown, 'lexicon'), false, 'une carte historique inconnue ne reçoit pas de lexique sans baseline');
assert.deepEqual(unknown.positions, unknownLocal.positions);

const added = cards.find((card) => card.id === remoteNew.id);
assert.deepEqual(JSON.parse(JSON.stringify(added.positions)), remoteNew.positions, 'une carte entièrement nouvelle utilise son layout distant');
assert.ok(added.photo instanceof Blob, 'une carte entièrement nouvelle restaure sa photo distante');
assert.ok(added.audios.fr instanceof Blob, 'une carte entièrement nouvelle restaure sa voix distante');
assert.equal(Object.hasOwn(added.lexicon, 'note'), false);
assert.equal(report.cardsChanged, 3, 'le compteur détecte métadonnées, statut, fonction et carte nouvelle');
assert.equal(settings.get('onlyReviewed'), false, 'false local explicitement défini gagne');
assert.equal(settings.get('emojiSkinTone'), '2', 'la teinte locale définie gagne');

settings.delete('onlyReviewed');
settings.delete('emojiSkinTone');
const secondReport = await context.mergeRemoteSyncPayload(remote);
assert.equal(settings.get('onlyReviewed'), true, 'un réglage local absent reçoit la valeur distante');
assert.equal(settings.get('emojiSkinTone'), '5', 'une teinte locale absente reçoit la valeur distante');
assert.equal(secondReport.cardsChanged, 0, 'un second paquet identique ne signale plus de carte modifiée');

const outgoingCard = cards.find((card) => card.id === local.id);
outgoingCard.lexicon.note = 'note exclue';
outgoingCard.lexicon.url = 'https://neutral.invalid/';
outgoingCard.lexicon.email = 'neutre@example.invalid';
outgoingCard.lexicon.phone = '0000000000';
outgoingCard.lexicon.path = 'C:\\neutre\\fixture';
outgoingCard.lexicon.unknown = 'inconnu';
outgoingCard.lexicon.arStandard = 'https://neutral.invalid/';
outgoingCard.lexicon.relecteurFr = 'RF<neutre>';
const payload = await context.buildLocalSyncPayload({ includeMedia: false });
assert.equal(payload.settings.onlyReviewed, true, 'le paquet sortant contient onlyReviewed');
assert.equal(payload.settings.emojiSkinTone, '5', 'le paquet sortant contient emojiSkinTone');
const sent = payload.cards.find((card) => card.id === local.id);
assert.deepEqual(Object.keys(sent.lexicon).sort(), [
  'arStandard', 'customized', 'dateRevision', 'fonction', 'legacy', 'legacyFr', 'niveau', 'owned',
  'palier', 'relecteurDr', 'relecteurFr', 'revision', 'role', 'secondVoice', 'sourceCategory', 'status', 'wordId',
].sort(), 'seuls les 17 champs lexicaux autorisés quittent le téléphone');
assert.equal(sent.lexicon.arStandard, '', 'un texte source contenant une URL est assaini');
assert.equal(sent.lexicon.relecteurFr, '', 'un code de relecteur douteux est assaini');
assert.equal(sent.lexicon.status, 'relu-langue', 'le statut sortant est recalculé après assainissement des preuves');

console.log('✅ Cloud : snapshot lexical, champs locaux absents, médias, réglages et liste blanche protégés.');
