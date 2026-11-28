// Bande de phrase : cartes touchées, accords, temps, suggestions, lecture
// Code déplacé tel quel depuis app.js (v10.42, Lot 4.1) : aucun comportement ne change.
// Les fonctions encore dans app.js sont lues au moment de l’appel (app.<nom>).
import { sayCards, sayNaturalSentence, setCardCatalog, stopSpeaking, unlockAudio } from '../speech.js';
import { clearConfirmNeeded, echoPracticeEnabled, suggestionsFor } from './aac-plus.js';
import { isFallbackMode } from './db-fallback.js';
import { logOrtho } from './ex-ortho.js';
import { unlockFriendSticker } from './friends.js';
import { isAmazighLang, isExtraLang, langInfo, zhClassifierAt } from './languages.js';
import { getTense, inflectStrip, setTense } from './morphology.js';
import { cardPassesReviewFilter } from './lexique-rules.js';
import { showsCoach, showsHints } from './talk-modes.js';
import { twinOf, twinSwap } from './twin-language.js';
import { recordUtterance } from './utterance-log.js';
import { h } from './util.js';

export function createStripController(app) {
  const $ = (...args) => app.$(...args);
  const cardElement = (...args) => app.cardElement(...args);
  const fillLabel = (...args) => app.fillLabel(...args);
  const label = (...args) => app.label(...args);
  const openLangPicker = (...args) => app.openLangPicker(...args);
  const setLang = (...args) => app.setLang(...args);
  const showEchoCue = (...args) => app.showEchoCue(...args);
  const state = app.state;
  const tappableCard = (...args) => app.tappableCard(...args);
  // ---------- Bande de phrase (chaque mot garde sa langue : code-switching) ----------
  // v9.13 : le moteur hors-ligne (modules/morphology.js) conjugue et accorde la phrase. En français, en darija
  // et (v10.7) dans les 4 variétés amazighes (phrase affichée seulement : pas de voix du téléphone en amazigh).
  // v10.22 (Lot 2) : les 10 langues « extra » (en, es…) entrent aussi dans la barre — phrase assemblée
  // dans la langue de l'enfant, sans repli français.
  const morphLangOk = (strip) => strip.length > 0 && strip.every((item) => item.lang === 'fr' || item.lang === 'dr' || isAmazighLang(item.lang) || isExtraLang(item.lang));
  const stripAmazighLang = () => state.strip.find((item) => isAmazighLang(item.lang))?.lang || (isAmazighLang(state.lang) ? state.lang : null);
  const passesChildFilter = (card) => state.parent || cardPassesReviewFilter(card, { onlyReviewed: state.onlyReviewed });
  function pruneStripForReview() {
    const playing = state.playing;
    const kept = [];
    let nextPlaying = -1;
    state.strip.forEach((item, index) => {
      if (!passesChildFilter(item.card)) return;
      if (index === playing) nextPlaying = kept.length;
      kept.push(item);
    });
    state.strip = kept;
    state.playing = nextPlaying;
  }
  function stripInflection() {
    if (!morphLangOk(state.strip)) return null;
    try { return inflectStrip(state.strip, { lang: stripAmazighLang(), scriptMode: state.amazighScript }); } catch { return null; }
  }

  function renderStrip() {
    pruneStripForReview();
    setCardCatalog(state.cards);
    const inflected = stripInflection();
    const items = state.strip.map((item, i) => {
      const el = cardElement(item.card, { small: true, lang: item.lang });
      if (i === state.playing) el.classList.add('lit');
      // Étiquette conjuguée / accordée sous la carte (« Manger » devient « mange », « Content » devient « contente »).
      // v10.22 (Lot 2) : seulement pour le français, la darija et l'amazigh, dont le moteur connaît les formes
      // conjuguées. Une langue « extra » garde son mot traduit (sinon l'inflexion française écraserait la traduction).
      const inflectable = item.lang === 'fr' || item.lang === 'dr' || isAmazighLang(item.lang);
      const shown = inflectable && inflected && inflected.tokens[i] && inflected.tokens[i].displayLabel;
      const lab = el.querySelector('.label');
      if (shown && lab && shown.trim().toLowerCase() !== label(item.card, item.lang).trim().toLowerCase()) {
        fillLabel(lab, shown, item.lang);
        lab.classList.add('inflected');
        el.title = shown;
      }
      // v10.40 (Lot 2.3) : chinois, « 一 » + « 苹果 » s'écrit « 一个苹果 » (classificateur glissé).
      const clf = zhClassifierAt(state.strip, i);
      if (clf && lab) { fillLabel(lab, `${clf}${label(item.card, item.lang)}`, item.lang); lab.classList.add('inflected'); }
      return el;
    });
    renderMorphSlot();
    const row = $('#strip-cards');
    row.replaceChildren(...items);
    // v9.7 : on montre toujours le dernier mot ajouté (ou le mot dit), même sur petit téléphone.
    const focus = items[state.playing] || items[items.length - 1];
    // v10.40 (Lot 2.1) : en arabe la bande défile vers la gauche : on montre le mot sans calcul de position.
    if (focus && document.documentElement.dir === 'rtl') focus.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    else if (focus) row.scrollLeft = focus.offsetLeft + focus.offsetWidth - row.clientWidth + 6;
    $('#strip').classList.toggle('empty', state.strip.length === 0);
    $('#btn-lang').textContent = langInfo(state.lang).short;
    $('#btn-lang').setAttribute('aria-label', `Langue : ${langInfo(state.lang).name}. Changer de langue`);
    // v10.23 (pépite 1) : un seul bouton pour passer de la langue de la maison à celle de l'école.
    const twinBtn = $('#btn-twin');
    if (twinBtn) {
      const other = twinOf(state.twin, state.lang);
      twinBtn.hidden = !other;
      twinBtn.textContent = other ? langInfo(other).short : '';
      twinBtn.setAttribute('aria-label', other ? `Passer à la langue jumelle : ${langInfo(other).name}. Les cartes ne bougent pas.` : 'Langue jumelle');
    }
    const talk = document.querySelector('.talk');
    if (talk) talk.classList.toggle('has-phrase', state.strip.length > 0);
    renderSuggestions();
    refreshTenseHints();
  }

  // v10.19 : conjugaison visible là où l'enfant parle. Un verbe de la grille montre
  // sa forme au temps choisi (« Manger » → « a mangé »), sans quitter le tableau.
  function tenseHintFor(card) {
    if (card.gram !== 'verb' || getTense() === 'present') return '';
    // v10.22 (Lot 2) : le moteur ne conjugue pas encore les langues « extra » : pas d'indice français
    // sur une carte anglaise/espagnole (on n'affiche jamais une forme française à la place).
    if (isExtraLang(state.lang)) return '';
    const lang = state.lang === 'dr' || isAmazighLang(state.lang) ? state.lang : 'fr';
    try {
      const inflected = inflectStrip([{ card, lang }], { tense: getTense(), lang, scriptMode: state.amazighScript });
      const raw = String(inflected?.tokens?.[0]?.displayLabel || '').trim();
      // Le libellé d'un verbe seul commence par « Je » : on applique l'élision du français
      // (« Je ai mangé » → « J'ai mangé ») comme le fait déjà la phrase complète.
      const shown = lang === 'fr' ? raw.replace(/^Je\s+([aàâeéèêëiîïoôuùûh])/i, "J'$1") : raw;
      const base = label(card, lang).trim();
      return shown && shown.toLowerCase() !== base.toLowerCase() ? shown : '';
    } catch { return ''; }
  }
  function refreshTenseHints() {
    if (state.parent) return;
    for (const el of document.querySelectorAll('.talk .grid .card[data-card-id]')) {
      const card = state.cards.find((c) => c.id === el.dataset.cardId);
      if (!card) continue;
      let hint = el.querySelector('.card-tense');
      const text = card.hidden || !passesChildFilter(card) ? '' : tenseHintFor(card);
      if (!text) { hint?.remove(); continue; }
      if (!hint) { hint = h('span', { class: 'card-tense', 'aria-hidden': 'true' }); el.append(hint); }
      hint.textContent = text;
    }
  }

  const COACH_TENSES = {
    fr: [['past', '⏪ Hier'], ['present', '⏺ Maintenant'], ['future', '⏩ Après']],
    dr: [['past', '⏪ Lbarah'], ['present', '⏺ Daba'], ['future', '⏩ Men b3d']],
    shi: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
    rif: [['past', '⏪ Iḍennaḍ'], ['present', '⏺ Luxa'], ['future', '⏩ Deffir']],
    tzm: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
    zgh: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
  };

  // v10.19 : barre « Quand ? » repensée : trois grands moments et la phrase naturelle
  // qu'on peut écouter d'un toucher. Elle reste figée sous la bande de phrase.
  function coachBar() {
    const inflected = stripInflection();
    if (!inflected) return null;
    const amzLang = stripAmazighLang();
    let lang = 'fr';
    if (state.strip.every((item) => item.lang === 'dr')) lang = 'dr';
    else if (amzLang && (state.strip.every((item) => isAmazighLang(item.lang)) || isAmazighLang(state.lang))) lang = amzLang;
    const amzActive = isAmazighLang(lang);
    const sentences = {
      sentenceFr: inflected.sentenceFr, sentenceDr: inflected.sentenceDr, sentenceAr: inflected.sentenceAr,
      sentenceExtra: inflected.sentenceExtra, extraLang: inflected.extraLang, lang,
      sentenceAmazigh: inflected.sentenceAmazigh, sentenceAmazighLat: inflected.sentenceAmazighLat,
      sentenceAmazighTif: inflected.sentenceAmazighTif,
    };
    // v10.22 (Lot 2) : la phrase s'affiche dans la langue de l'enfant. Le français n'est qu'un écho,
    // jamais la ligne principale quand l'enfant parle une autre langue.
    const main = inflected.extraLang
      ? (inflected.sentenceExtra || inflected.sentenceFr)
      : (amzActive
        ? (inflected.sentenceAmazigh || inflected.sentenceFr)
        : (lang === 'dr' ? [inflected.sentenceDr, inflected.sentenceAr].filter(Boolean).join('  ·  ') : inflected.sentenceFr));
    const sub = inflected.extraLang
      ? (inflected.sentenceFr && inflected.sentenceFr !== inflected.sentenceExtra ? `FR · ${inflected.sentenceFr}` : '')
      : (amzActive || lang === 'dr' ? `FR · ${inflected.sentenceFr}` : '');
    const speakCoach = async () => {
      unlockAudio();
      const natural = sayNaturalSentence(sentences);
      if (!state.parent && !isFallbackMode()) recordUtterance({ cards: state.strip.map((item) => item.card), source: 'enfant', mode: 'phrase', lang, page: 'phrase' });
      const said = await natural;
      if (!said) await sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
    };
    const tenses = COACH_TENSES[lang] || COACH_TENSES.fr;
    return h('div', { class: 'coach' },
      h('div', { class: 'coach-row' },
        h('span', { class: 'coach-icon', 'aria-hidden': 'true', title: 'Quand ?' }, '⏰'),
        h('div', { class: 'coach-tenses', role: 'group', 'aria-label': 'Choisir le moment' },
          tenses.map(([code, text]) => h('button', {
            type: 'button',
            class: `coach-tense${getTense() === code ? ' active' : ''}`,
            'aria-pressed': String(getTense() === code),
            onclick: () => { setTense(code); refreshTenseHints(); renderStrip(); },
          }, text)))),
      h('button', { type: 'button', class: 'coach-sentence', title: 'Écouter la phrase', onclick: speakCoach },
        h('strong', {}, `🔊 ${main}`),
        sub && sub !== `FR · ${main}` ? h('small', {}, sub) : null));
  }

  // v9.13 : barre « ⏪ Hier / ⏺ Maintenant / ⏩ Après » + aperçu de la phrase complète,
  // sous la bande. v10.19 : elle devient le coach de conjugaison de la page Parler.
  function renderMorphSlot() {
    const slot = document.getElementById('morph-slot');
    if (!slot) return;
    const show = morphLangOk(state.strip) && ['talk', 'home'].includes(state.space) && !state.modeling && showsCoach(state.talkMode);
    const bar = show ? coachBar() : null;
    slot.replaceChildren(...(bar ? [bar] : []));
    slot.hidden = !bar;
  }

  // Mots proposés après le dernier mot de la phrase (appris sur les phrases de l'enfant).
  function renderSuggestions() {
    const row = document.getElementById('suggest-row');
    if (!row) return;
    const next = state.modeling || !showsHints(state.talkMode) ? [] : suggestionsFor(state.strip, state.cards.filter(passesChildFilter));
    row.replaceChildren(...(next.length ? [h('span', { class: 'suggest-label' }, '💡'), ...next.map((card) => tappableCard(card, { small: true }))] : []));
    row.hidden = !next.length;
    // v10.37 (mode Aide / Coach) : les cartes probables brillent dans la grille, sans prendre de place.
    document.querySelectorAll('.talk > .grid .card.hint-glow').forEach((el) => el.classList.remove('hint-glow', 'hint-first'));
    if (state.strip.length) {
      next.forEach((card, i) => document.querySelectorAll(`.talk > .grid .card[data-card-id="${CSS.escape(card.id)}"]`).forEach((el) => {
        el.classList.add('hint-glow');
        if (i === 0 && showsCoach(state.talkMode)) el.classList.add('hint-first');
      }));
    }
  }

  // Ligne « Je montre » : les mots montrés par l'adulte, à réécouter.
  function renderModel() {
    const line = document.getElementById('model-line');
    if (!line) return;
    if (!state.parent) state.model = state.model.filter((item) => passesChildFilter(item.card));
    line.replaceChildren(h('span', { class: 'suggest-label' }, '🧑‍🏫 Je montre :'),
      ...state.model.map((item) => cardElement(item.card, { small: true, lang: item.lang })),
      state.model.length ? h('button', { type: 'button', class: 'strip-btn play', 'aria-label': 'Redire', onclick: () => {
        const speaking = sayCards(state.model);
        if (!state.parent && !isFallbackMode()) recordUtterance({ cards: state.model.map((item) => item.card), source: 'modele', mode: 'phrase', lang: state.lang, page: 'phrase' });
        return speaking;
      } }, '▶') : null);
  }

  // Mesure discrète pour le dossier orthophonique : longueur de chaque phrase dite dans Parler (une même phrase redite tout de suite ne compte qu'une fois).
  const SAME_UTTERANCE_MS = 10000;
  let lastUtterance = { text: '', at: 0 };
  function noteUtterance() {
    if (!state.strip.length) return;
    const text = state.strip.map((item) => label(item.card, item.lang)).join(' ');
    const now = Date.now();
    if (text === lastUtterance.text && now - lastUtterance.at < SAME_UTTERANCE_MS) return;
    lastUtterance = { text, at: now };
    logOrtho({ protocol: 'aac_mlu', mlu: state.strip.length, target: text, spontaneous: !state.modeling }).catch(() => {});
  }

  function setupStrip() {
    $('#btn-play').onclick = async () => {
      // v9.12 : une phrase d'au moins 2 mots dite par l'enfant réveille Nour dans l'Album (sans bruit ni écran en plus).
      if (state.strip.length >= 2 && !state.parent) unlockFriendSticker('nour').catch(() => {});
      noteUtterance();
      const speaking = sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
      if (!state.parent && !isFallbackMode()) recordUtterance({ cards: state.strip.map((item) => item.card), source: state.modeling ? 'modele' : 'enfant', mode: 'phrase', lang: state.lang, page: 'phrase' });
      await speaking;
      // v10.15 (pépite 11) : mode écho — « À toi ! » 2,5 s après la phrase, l'enfant imite.
      if (echoPracticeEnabled() && state.strip.length && !state.modeling) showEchoCue();
    };
    $('#btn-back').onclick = () => { state.strip = state.strip.slice(0, -1); renderStrip(); };
    // v10.1.3 : « Tout effacer » marche d'un simple toucher (l'appui long de la v9.9 ne marchait pas bien sur iPhone).
    // Pour une erreur, le bouton devient « ↩ » pendant 4 s : le toucher remet la phrase.
    const clearBtn = $('#btn-clear');
    let undoStrip = null;
    let undoTimer = null;
    const endUndo = () => {
      clearTimeout(undoTimer); undoTimer = null; undoStrip = null;
      clearBtn.textContent = '✕'; clearBtn.classList.remove('undo');
      clearBtn.setAttribute('aria-label', 'Tout effacer');
    };
    clearBtn.setAttribute('aria-label', 'Tout effacer'); clearBtn.removeAttribute('title');
    // v10.5 (F11) : option du parent « 2 touchers sur ✕ » (éteinte par défaut). 1er toucher = « ✕ ? » pendant 3 s.
    let confirmTimer = null;
    const endConfirm = () => { clearTimeout(confirmTimer); confirmTimer = null; };
    clearBtn.onclick = () => {
      if (undoStrip) { state.strip = undoStrip; endUndo(); renderStrip(); return; }
      if (!state.strip.length) return;
      if (clearConfirmNeeded() && !confirmTimer) {
        clearBtn.textContent = '✕ ?';
        clearBtn.setAttribute('aria-label', 'Toucher encore pour tout effacer');
        confirmTimer = setTimeout(() => { confirmTimer = null; clearBtn.textContent = '✕'; clearBtn.setAttribute('aria-label', 'Tout effacer'); }, 3000);
        return;
      }
      endConfirm();
      stopSpeaking();
      undoStrip = state.strip; state.strip = []; state.playing = -1; renderStrip();
      clearBtn.textContent = '↩'; clearBtn.classList.add('undo');
      clearBtn.setAttribute('aria-label', 'Remettre la phrase');
      undoTimer = setTimeout(endUndo, 4000);
    };
    $('#btn-lang').onclick = openLangPicker;
    // v10.23 (pépite 1) : basculer ne touche ni les positions ni la phrase — chaque mot déjà posé garde sa langue,
    // donc l'enfant peut mélanger les deux langues dans une même phrase (code-switching).
    const twinBtn = $('#btn-twin');
    if (twinBtn) twinBtn.onclick = () => { const next = twinSwap(state.twin, state.lang); if (next && next !== state.lang) setLang(next); };
  }

  return { renderStrip, tenseHintFor, refreshTenseHints, renderMorphSlot, renderSuggestions, renderModel, setupStrip };
}
