// v10.39 : boutique d'habits, vidéos modèles, masque à la voix (logique sans écran).
import assert from 'node:assert/strict';
import { WARDROBE, cleanWardrobe, coinsLeft, buyItem, toggleWear } from '../modules/wardrobe-data.js';
import { cleanVideos, videoProblem, videoBlobKey, newVideoId, VIDEO_SETTING_KEY } from '../modules/model-videos.js';
import { smoothMouth, maskPose, countBursts, MASKS } from '../modules/voice-mask-data.js';
import { readFileSync } from 'node:fs';
import { appSource } from './app-source.mjs';

const ok = (m) => console.log(`✓ ${m}`);

// Boutique
assert.equal(coinsLeft(10, null), 10);
let r = buyItem(null, 'noeud', 10);
assert.ok(r.ok); assert.equal(coinsLeft(10, r.wardrobe), 7); assert.equal(r.wardrobe.worn.tete, 'noeud');
ok('acheter un nœud coûte 3 étoiles et Nour le porte');
assert.equal(buyItem(r.wardrobe, 'couronne', 10).reason, 'pieces');
assert.equal(buyItem(r.wardrobe, 'noeud', 10).reason, 'deja');
ok('pas assez de pièces, ou déjà acheté : rien ne change');
r = buyItem(r.wardrobe, 'casquette', 10);
assert.equal(r.wardrobe.worn.tete, 'casquette'); assert.deepEqual(r.wardrobe.owned, ['noeud', 'casquette']);
assert.equal(toggleWear(r.wardrobe, 'casquette').worn.tete, undefined);
assert.equal(toggleWear(r.wardrobe, 'noeud').worn.tete, 'noeud');
ok('un habit remplace celui de la même place ; retoucher l’enlève');
assert.deepEqual(cleanWardrobe({ owned: ['pirate', 'noeud', 'noeud'], worn: { tete: 'lunettes', yeux: 'noeud' } }), { owned: ['noeud'], worn: {}, spent: 3 });
assert.equal(coinsLeft(2, { owned: ['couronne'] }), 0);
ok('données abîmées nettoyées, jamais de pièces négatives');
assert.ok(WARDROBE.length >= 10 && WARDROBE.every((i) => i.price > 0));

// Vidéos modèles
const id = newVideoId();
assert.match(id, /^v[a-z0-9]+$/);
assert.equal(videoBlobKey(id), `modelVideo:${id}`);
assert.deepEqual(cleanVideos([{ id, title: '  Se laver   les mains ', word: 'Laver', who: 'soeur' }, { id, title: 'doublon' }, { id: 'x', title: 'mauvais id' }, null]),
  [{ id, title: 'Se laver les mains', word: 'Laver', who: 'soeur' }]);
assert.equal(cleanVideos([{ id: 'vabc', title: 'Bonjour', who: 'inconnu' }])[0].who, 'autre');
ok('liste des vidéos nettoyée');
assert.equal(videoProblem(null), 'Choisissez ou filmez une vidéo.');
assert.match(videoProblem({ type: 'image/png', size: 10 }), /pas une vidéo/);
assert.match(videoProblem({ type: 'video/mp4', size: 500 * 1024 * 1024 }), /trop longue/);
assert.equal(videoProblem({ type: 'video/quicktime', size: 5e6 }), '');
ok('vidéo vérifiée avant enregistrement');
// La vidéo ne part ni dans la sauvegarde ni dans la synchro.
const app = appSource(); // v10.42 : app.js + ses modules découpés
const exported = app.match(/const EXPORTED_SETTINGS = \[([\s\S]*?)\];/)[1];
assert.ok(!exported.includes(VIDEO_SETTING_KEY) && !exported.includes('modelVideo'));
const sync = readFileSync(new URL('../modules/cloud-sync.js', import.meta.url), 'utf8');
assert.ok(!sync.includes('modelVideo'));
ok('vidéos absentes de la sauvegarde et de la synchro');

// Masque
let m = 0;
for (let i = 0; i < 30; i += 1) m = smoothMouth(m, 0.6);
assert.ok(m > 0.9, `bouche ouverte ${m}`);
const open = m;
m = smoothMouth(m, 0); assert.ok(m < open && m > 0.8, 'se ferme lentement');
for (let i = 0; i < 80; i += 1) m = smoothMouth(m, 0);
assert.equal(m, 0);
assert.equal(smoothMouth(0, 0.03), 0);
ok('la bouche s’ouvre avec la voix et se referme doucement');
assert.deepEqual(maskPose(0), { scale: 1, mouthHeight: 6, tilt: 0 });
assert.equal(maskPose(1).scale, 1.25);
assert.equal(countBursts([0, 0.3, 0.4, 0.05, 0, 0.5, 0.2, 0.3, 0.01]), 2);
ok('les paroles sont comptées une à une');
assert.ok(MASKS.length >= 4);
// Le masque n'enregistre rien.
const mask = readFileSync(new URL('../modules/voice-mask.js', import.meta.url), 'utf8');
assert.ok(!/MediaRecorder|record\s*:\s*true|fetch\(|toDataURL|toBlob/.test(mask));
ok('le masque n’enregistre ni n’envoie rien');
console.log('test-pepites-finales : OK');
