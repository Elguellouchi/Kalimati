// v10.43 : après une bonne réponse, l'essai suivant arrive tout seul (aucun bouton à toucher).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ok = (m) => console.log(`✓ ${m}`);
const games = fs.readdirSync(path.join(ROOT, 'modules')).filter((f) => /^(ex-.*|clinique)\.js$/.test(f));

// 1. Plus aucun bouton « suivant » dans les réponses justes.
for (const f of games) {
  const src = read(`modules/${f}`);
  assert.doesNotMatch(src, /btn\('➜ (Question suivante|Tri suivant|Suivant)'/, `${f} : bouton manuel restant`);
  assert.doesNotMatch(src, /const nextB(tn|utton) = \(next[^)]*\) => btn\(/, `${f} : bouton « Essai suivant » restant`);
  assert.doesNotMatch(src, /btn\('🔀 Recommencer', next/, `${f} : tri à relancer à la main`);
  // « Essai suivant » ne reste qu'après une erreur (l'adulte aide l'enfant d'abord).
  for (const line of src.split('\n').filter((l) => l.includes("'➜ Essai suivant'"))) {
    assert.match(line, /retryBtn|ok \? autoNext\(next\) : btn/, `${f} : ${line.trim()}`);
  }
}
const clinic = read('modules/clinique.js');
assert.doesNotMatch(clinic, /replaceChildren\(btn\(T\('next'\)/, 'atelier clinique : bouton suivant après bonne réponse');
assert.match(clinic, /autoNext\(\(\) => go\(1\)/);
assert.match(clinic, /autoNext\(\(\) => go\(3\)/);
ok(`${games.length} fichiers de jeux : plus de bouton « suivant » après une bonne réponse`);

// 2. Le passage automatique : un temps de félicitation, puis l'essai suivant, sauf si l'écran a changé.
// widgets.js a besoin d'un navigateur : on teste le code de autoNext tel quel, avec un faux élément.
const widgets = read('modules/widgets.js');
const code = widgets.slice(widgets.indexOf('export const AUTO_NEXT_MS'), widgets.indexOf('\n}\n', widgets.indexOf('export function autoNext')) + 3).replace(/export /g, '');
const h = (tag, attrs, ...kids) => ({ isConnected: true, attrs, kids: kids.flat(), style: { setProperty() {} }, get firstChild() { return this.kids[0]; } });
const { autoNext, AUTO_NEXT_MS } = new Function('h', 'setTimeout', `${code}; return { autoNext, AUTO_NEXT_MS };`)(h, setTimeout);
assert.ok(AUTO_NEXT_MS >= 1500 && AUTO_NEXT_MS <= 3000, 'pause courte');
let calls = 0;
const el = autoNext(() => { calls += 1; }, { delay: 20 });
const gone = autoNext(() => { calls += 100; }, { delay: 20 });
gone.isConnected = false; // l'enfant a quitté le jeu
assert.equal(calls, 0, 'rien avant la pause');
await new Promise((r) => setTimeout(r, 60));
assert.equal(calls, 1);
assert.ok(el.isConnected);
// v10.44 : bravo festif (confettis, grand applaudissement, barre jusqu'à la suite).
assert.equal(el.attrs.class, 'auto-next');
assert.equal(el.kids[0].kids.length, 18, 'confettis');
const css = read('style.css');
const festive = css.slice(css.indexOf('v10.44 : bravo festif'));
assert.ok(!/#(F00|FF0000|E53935|D32F2F|F44336)\b/i.test(festive), 'pas de rouge vif');
assert.ok(!/infinite|alternate/.test(festive.slice(0, festive.indexOf('@media (prefers-color-scheme'))), 'pas d’animation qui se répète (clignotement)');
assert.match(festive, /prefers-reduced-motion: reduce\)[\s\S]*?\.auto-next-confetti \{ display: none; \}/);
assert.match(festive, /body\.calm-mode \.auto-next-confetti \{ display: none; \}/);
assert.match(festive, /data-theme="contraste"\] \.auto-next-confetti \{ display: none; \}/);
ok('pause de félicitation puis essai suivant tout seul ; rien si l’enfant a quitté le jeu');

// 3. Restent volontairement manuels : les étapes de la vraie vie et les notes de l'adulte.
assert.match(read('modules/ex-hygiene.js'), /C’est fait|C'est fait/);
ok('les gestes de la vraie vie (« C’est fait ! ») et les notes de l’adulte restent à toucher');
console.log('test-auto-next : OK');
