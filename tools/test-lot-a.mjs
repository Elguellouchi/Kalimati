#!/usr/bin/env node
/**
 * Suite de tests automatisés — Kalimati v10.9 (Lot A : Pépites 1, 2, 3 + 27 et 28 en partie)
 * Exécutable sous Node sans navigateur :
 *  1. Délai d'aide avant l'erreur (3 / 5 / 8 s / off), estompage progressif, notation « avec aide » sans étoile 1er coup.
 *  2. Cartes jouables : exclusion stricte des cartes masquées (card.hidden === true).
 *  3. Nombre de choix réduit si pas assez de cartes (et repli propre si toutes masquées : jamais d'écran vide).
 *  4. Mode calme : playBeep et playClap coupés (0 son), voix conservée, classe calm-mode (fond crème, sans confettis).
 *  5. Règle 65 % / 80 % sur les 8 derniers essais du jeu (bornée 2..4, demi-réussite 0,5 si aidé, blocage parent).
 *  6. Démonstration muette de 2,5 s jouée une seule fois au 1er lancement de chaque jeu, rejouable via « ? », respect de prefers-reduced-motion.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---------- Environnement DOM minimal pour tester choiceBoard sous Node sans navigateur ----------
class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.onclick = null;
    this.onchange = null;
    const self = this;
    this.classList = {
      _set() {
        return new Set(String(self.className || '').split(/\s+/).filter(Boolean));
      },
      _sync(s) {
        self.className = Array.from(s).join(' ');
      },
      add(...cls) {
        const s = this._set();
        cls.filter(Boolean).forEach((c) => s.add(c));
        this._sync(s);
      },
      remove(...cls) {
        const s = this._set();
        cls.forEach((c) => s.delete(c));
        this._sync(s);
      },
      toggle(c, force) {
        const s = this._set();
        const shouldHave = force !== undefined ? Boolean(force) : !s.has(c);
        if (shouldHave) s.add(c);
        else s.delete(c);
        this._sync(s);
        return shouldHave;
      },
      contains(c) {
        return this._set().has(c);
      },
    };
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'class') this.className = String(v);
  }
  getAttribute(k) {
    return this.attributes.get(k) ?? null;
  }
  append(...nodes) {
    for (const n of nodes) {
      if (n === null || n === undefined || n === false) continue;
      const child = n instanceof FakeNode ? n : new FakeNode('#text');
      if (!(n instanceof FakeNode)) child.textContent = String(n);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    this.parentElement = null;
  }
  matchesSelector(sel) {
    const parts = sel.trim().split('.');
    const tagPart = parts[0];
    const reqClasses = parts.slice(1).filter(Boolean);
    if (tagPart && tagPart.toUpperCase() !== this.tagName) return false;
    return reqClasses.every((c) => this.classList.contains(c));
  }
  querySelectorAll(selector) {
    const groups = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.tagName !== '#TEXT') {
          if (groups.some((g) => child.matchesSelector(g))) out.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

let reducedMotionFlag = false;
globalThis.Node = FakeNode;
// v10.9 (Claude) : util.js protège Element/DocumentFragment/Document.prototype au chargement.
globalThis.Element = FakeNode;
globalThis.DocumentFragment = class DocumentFragment {};
globalThis.Document = class Document {};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', onLine: false }, configurable: true, writable: true });
globalThis.document = {
  body: new FakeNode('body'),
  documentElement: new FakeNode('html'),
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (txt) => {
    const n = new FakeNode('#text');
    n.textContent = String(txt);
    return n;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  querySelector: () => null,
};
globalThis.window = {
  matchMedia: (q) => ({
    matches: q.includes('prefers-reduced-motion') ? reducedMotionFlag : false,
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
  const media = await load('media.js');
  const widgets = await load('modules/widgets.js');
  const catalog = await load('modules/catalog.js');

  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  };

  // 1. Pépite 1 : Délai d'aide avant l'erreur (3/5/8s/off), estompage progressif, notation « avec aide »
  await check('Pépite 1 : Délai d’aide réglable (3 / 5 / 8 s / pas d’aide) et estompage progressif selon les réussites', () => {
    widgets.setHintDelaySec(5);
    assert.equal(widgets.getHintDelaySec(), 5);
    assert.equal(widgets.computeHintDelayMs({ baseSec: 5, recentScores: [] }), 5000);
    assert.equal(widgets.computeHintDelayMs({ baseSec: 3, recentScores: [] }), 3000);
    assert.equal(widgets.computeHintDelayMs({ baseSec: 8, recentScores: [] }), 8000);
    assert.equal(widgets.computeHintDelayMs({ baseSec: 0, recentScores: [1, 1, 1] }), 0);
    assert.equal(widgets.computeHintDelayMs({ baseSec: 'off', recentScores: [1, 1] }), 0);

    // Estompage : l'aide arrive plus tard quand l'enfant réussit souvent en autonomie
    const delayAfter2 = widgets.computeHintDelayMs({ baseSec: 5, recentScores: [1, 1] });
    const delayAfter6 = widgets.computeHintDelayMs({ baseSec: 5, recentScores: [1, 1, 1, 1, 1, 1] });
    assert.ok(delayAfter2 > 5000, `Attendu > 5000 ms après 2 réussites, reçu ${delayAfter2}`);
    assert.ok(delayAfter6 > delayAfter2, `Attendu délai plus long après 6 réussites (${delayAfter6} > ${delayAfter2})`);
  });

  await check('Pépite 1 : Aide avant l’erreur dans choiceBoard -> réussite notée « avec aide » (firstTry=false, score=0,5)', async () => {
    widgets.resetGameDemos();
    widgets.resetGameStats();
    widgets.markGameDemoSeen('test-hint-game'); // on teste l'aide après la 1re démo
    widgets.setFixedChoiceCount('auto');

    let recordedFirstTry = null;
    let recordedMeta = null;
    const board = widgets.choiceBoard({
      gameId: 'test-hint-game',
      cols: 2,
      choices: [
        { id: 'c1', label: 'Pomme', emoji: '🍎', correct: true },
        { id: 'c2', label: 'Banane', emoji: '🍌', correct: false },
      ],
      onAnswer: (firstTry, _choice, meta) => {
        recordedFirstTry = firstTry;
        recordedMeta = meta;
      },
    });

    // On déclenche l'aide avant l'erreur (sans aucune erreur préalable)
    board.triggerHintNow();
    const btns = board.querySelectorAll('.choice');
    const rightBtn = btns.find((b) => b.classList.contains('choice-hint'));
    assert.ok(rightBtn, 'La bonne carte doit grossir doucement (.choice-hint) quand l’aide se déclenche');
    assert.ok(rightBtn.querySelector('.choice-hand-hint'), 'La petite main 👆 doit apparaître sur la bonne carte');

    // L'enfant touche la bonne carte après l'aide
    rightBtn.onclick();
    assert.equal(recordedFirstTry, false, 'Une réussite avec aide ne doit PAS donner d’étoile premier coup (firstTry=false)');
    assert.equal(recordedMeta.helped, true);
    assert.equal(recordedMeta.erred, false);
    assert.equal(recordedMeta.status, 'avec_aide');
    assert.equal(recordedMeta.score, 0.5, 'Une réussite avec aide doit compter comme demi-réussite (0,5)');
  });

  // 2. Pépite 2 : Cartes jouables sans les cartes masquées
  await check('Pépite 2 : Filtrage strict des cartes masquées (!card.hidden) dans Parler et les jeux', () => {
    const cards = [
      { id: 'c-manger-pomme', fr: 'Pomme', cat: 'manger', hidden: false },
      { id: 'c-manger-cravate', fr: 'Cravate', cat: 'vetements', hidden: true },
      { id: 'c-manger-banane', fr: 'Banane', cat: 'manger', hidden: false },
      { id: 'c-boire-eau', fr: 'Eau', cat: 'boire', hidden: true },
    ];
    const visible = widgets.setPlayableCards(cards);
    assert.equal(visible.length, 2);
    assert.deepEqual(visible.map((c) => c.id), ['c-manger-pomme', 'c-manger-banane']);
    assert.equal(catalog.isConceptHidden({ fr: 'Eau' }), true);
    assert.equal(catalog.isConceptHidden({ fr: 'Pomme' }), false);
  });

  // 3. Pépite 2 : Nombre de choix réduit si pas assez de cartes, jamais d'écran vide
  await check('Pépite 2 : Nombre de choix réduit automatiquement si pas assez de cartes, jamais d’écran vide', () => {
    widgets.setPlayableCards([]);
    widgets.setFixedChoiceCount(4); // même si 4 choix sont demandés

    // Cas A : seulement 2 cartes non masquées sur 4
    const twoPlayable = widgets.preparePlayableChoices([
      { id: 'a', label: 'A', correct: true, hidden: false },
      { id: 'b', label: 'B', correct: false, hidden: false },
      { id: 'c', label: 'C', correct: false, hidden: true },
      { id: 'd', label: 'D', correct: false, hidden: true },
    ], { targetCount: 4 });
    assert.equal(twoPlayable.length, 2, 'Doit réduire à 2 choix quand seules 2 cartes sont non masquées');

    // Cas B : toutes les cartes d'une catégorie sont masquées -> jamais d'écran vide (repli 1 choix)
    const allHidden = widgets.preparePlayableChoices([
      { id: 'a', label: 'A', correct: true, hidden: true },
      { id: 'b', label: 'B', correct: false, hidden: true },
    ], { targetCount: 3 });
    assert.ok(allHidden.length >= 1, 'Ne doit jamais produire un écran vide même si toutes les cartes sont masquées');
    assert.equal(allHidden[0].correct, true);
    widgets.setFixedChoiceCount('auto');
  });

  // 4. Pépite 3 : Mode calme muet (coupe playBeep/playClap, garde la voix, fond crème, sans confettis)
  await check('Pépite 3 : Mode calme coupe playBeep et playClap, applique body.calm-mode et garde la voix', () => {
    widgets.setCalmMode(false);
    media.resetSoundPlayedCount();
    media.playBeep();
    media.playClap();
    assert.equal(media.getSoundPlayedCount(), 4, 'Hors mode calme, playBeep (1) + playClap (3) jouent 4 notes');

    widgets.setCalmMode(true);
    assert.equal(widgets.isCalmMode(), true);
    assert.equal(globalThis.document.body.classList.contains('calm-mode'), true);
    media.resetSoundPlayedCount();
    const beepRes = media.playBeep();
    const clapRes = media.playClap();
    assert.equal(beepRes, false);
    assert.equal(clapRes, false);
    assert.equal(media.getSoundPlayedCount(), 0, 'En mode calme, aucun petit son ne doit être joué');
    widgets.setCalmMode(false);
  });

  // 5. Pépite 27 : Règle 65 % / 80 % sur les 8 derniers essais (2..4 choix, demi-réussite 0,5, verrouillage parent)
  await check('Pépite 27 : Adaptation du nombre de choix (2..4) selon la moyenne 65 % / 80 % des 8 derniers essais et demi-réussite (0,5)', () => {
    widgets.resetGameStats();
    widgets.setFixedChoiceCount('auto');

    // > 80 % sur 8 essais (7 réussites autonomes = 87,5 %) : +1 choix (2 -> 3)
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 2,
        recentScores: [1, 1, 1, 1, 1, 1, 1, 0],
        fixedChoices: 'auto',
      }),
      3,
    );

    // 6 réussites autonomes + 2 réussites « avec aide » (0,5) = 7 / 8 = 87,5 % (> 80 %) : +1 choix (3 -> 4)
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 3,
        recentScores: [1, 1, 1, 1, 1, 1, 'avec_aide', 'avec_aide'],
        fixedChoices: 'auto',
      }),
      4,
    );

    // Plafond à 4 choix maximum même à 100 %
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 4,
        recentScores: [1, 1, 1, 1, 1, 1, 1, 1],
        fixedChoices: 'auto',
      }),
      4,
    );

    // Entre 65 % et 80 % (6 / 8 = 75 %) : nombre de choix stable (reste à 3)
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 3,
        recentScores: [1, 1, 1, 1, 1, 1, 0, 0],
        fixedChoices: 'auto',
      }),
      3,
    );

    // < 65 % (8 réussites « avec aide » = 8 * 0,5 / 8 = 50 % < 65 %) : -1 choix (3 -> 2)
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 3,
        recentScores: Array(8).fill({ helped: true, erred: false }),
        fixedChoices: 'auto',
      }),
      2,
    );

    // Plancher à 2 choix minimum même à 0 %
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 2,
        recentScores: [0, 0, 0, 0, 0, 0, 0, 0],
        fixedChoices: 'auto',
      }),
      2,
    );

    // Verrouillage par le parent (bloque à 2, 3 ou 4)
    widgets.setFixedChoiceCount(3);
    assert.equal(
      widgets.computeAdaptiveChoiceCount({
        currentChoices: 2,
        recentScores: [0, 0, 0, 0, 0, 0, 0, 0],
      }),
      3,
    );
    widgets.setFixedChoiceCount('auto');
  });

  // 6. Pépite 28 : Démo muette de 2,5 s jouée une seule fois par jeu + bouton '?' + prefers-reduced-motion
  await check('Pépite 28 : Démonstration muette de 2,5 s jouée une seule fois au 1er lancement, rejouable via « ? » et fixe avec prefers-reduced-motion', async () => {
    widgets.resetGameDemos();
    widgets.resetGameStats();
    widgets.setReducedMotionForTest(false);

    const makeChoices = () => [
      { id: 'c1', label: 'Chat', emoji: '🐱', correct: true },
      { id: 'c2', label: 'Chien', emoji: '🐶', correct: false },
    ];

    assert.equal(widgets.hasSeenGameDemo('game-demo-1'), false);
    const board1 = widgets.choiceBoard({
      gameId: 'game-demo-1',
      choices: makeChoices(),
      demoDurationMs: 80,
    });
    assert.equal(widgets.hasSeenGameDemo('game-demo-1'), true, 'Le jeu doit être marqué comme ayant vu la démo dès le 1er lancement');

    const demoCard1 = board1.querySelector('.choice-demo');
    assert.ok(demoCard1, 'Au 1er lancement, la bonne carte doit afficher la démonstration muette (.choice-demo)');
    const hand1 = demoCard1.querySelector('.choice-hand-hint.demo-hand');
    assert.ok(hand1, 'La petite main 👆 de démonstration doit être présente au 1er lancement');
    assert.ok(hand1.classList.contains('choice-hand-moving'), 'Sans réduction des animations, la main bouge doucement');

    await sleep(110);
    assert.equal(board1.querySelector('.choice-demo'), null, 'La démonstration muette doit s’effacer après sa durée');

    // 2e lancement du même jeu : la démo ne doit PAS se rejouer toute seule
    const board2 = widgets.choiceBoard({
      gameId: 'game-demo-1',
      choices: makeChoices(),
      demoDurationMs: 80,
    });
    assert.equal(board2.querySelector('.choice-demo'), null, 'La démo ne doit être jouée automatiquement qu’une seule fois par jeu');

    // Le bouton « ? » (mode parent) rejoue la démo à la demande, et respecte prefers-reduced-motion (image fixe)
    widgets.setReducedMotionForTest(true);
    const replayBtn = board2.querySelector('.choice-demo-btn');
    assert.ok(replayBtn, 'Le bouton parent « ? » doit exister pour rejouer la démo');
    assert.ok(replayBtn.getAttribute('aria-label'), 'Le bouton « ? » doit avoir un aria-label explicite');
    replayBtn.onclick();

    const demoCard2 = board2.querySelector('.choice-demo');
    assert.ok(demoCard2, 'Le bouton « ? » doit relancer la démonstration muette');
    const hand2 = demoCard2.querySelector('.choice-hand-hint.demo-hand');
    assert.ok(hand2.classList.contains('choice-hand-static'), 'Avec prefers-reduced-motion, la main doit être une image fixe (.choice-hand-static)');

    widgets.setReducedMotionForTest(null);
    widgets.stopAllChoiceTimers();
  });

  // 7. Vérification statique des interdits absolus (aucun chiffre non vérifié 75 % / CNRS / 87 % / 2,3 fois, zéro rouge)
  await check('Conformité stricte : aucun chiffre interdit (« 75 % », « CNRS », « 87 % », « 2,3 fois ») ni croix rouge dans les fichiers du Lot A', () => {
    const filesToCheck = [
      'media.js',
      'modules/widgets.js',
      'modules/aba.js',
      'modules/spaces.js',
      'modules/dashboard.js',
      'modules/catalog.js',
      'style.css',
    ];
    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const isCss = rel.endsWith(".css");
      const pattern = isCss ? /\bCNRS\b|87\s*%|2[.,]3\s*fois|1\s*sur\s*68/i : /75\s*%|\bCNRS\b|87\s*%|2[.,]3\s*fois|1\s*sur\s*68/i;
      assert.equal(pattern.test(content), false, `Chiffre non vérifié interdit trouvé dans ${rel}`);
    }
  });

  console.log(`\n🎉 Tous les tests du Lot A (v10.9) ont réussi (${passed}/${passed}).`);
}

main().catch((err) => {
  console.error('❌ Échec test-lot-a :', err);
  process.exit(1);
});
