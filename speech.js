// Fait parler une carte : voix enregistrée par le parent d'abord, puis voix du téléphone.
// Voix lente (0,85), darija lue avec une voix arabe si la graphie arabe existe, phrases mélangeant FR et darija.

import { langInfo, isExtraLang, isAmazighLang, cardWord, hasWord } from './modules/languages.js';
import { inflectStrip } from './modules/morphology.js';
import { amazighVoiceFor, parentAmazighVoice, packAmazighVoice } from './modules/voice-packs.js';

const RATE = 0.85;
// Sur Android (Chrome), une phrase lancée juste après cancel() est perdue : on attend un court instant.
// Jamais sur iPhone / iPad : Safari n'accepte la voix que si elle part directement du toucher.
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const AFTER_CANCEL_MS = IS_ANDROID ? 150 : 0;
let currentAudio = null;
let queueToken = 0;
let lastCancel = 0;
// Android peut effacer une phrase en cours si plus rien ne la référence : on la garde ici.
let currentUtterance = null;

export function stopSpeaking() {
  queueToken += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (synth && (synth.speaking || synth.pending)) {
    synth.cancel();
    lastCancel = Date.now();
  }
}

// onResult(ok, raison) : v10.7.2, pour dire sur l'Accueil pourquoi une carte amazighe est restée muette.
export function playBlob(blob, { rate = 1, onResult = null } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;
    let settled = false;
    const done = (ok = true, why = '') => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      // Un son coupé par un autre toucher (AbortError) n'est pas un échec.
      if (onResult && !ok && why !== 'AbortError') onResult(false, why);
      resolve(ok);
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false, `illisible ${audio.error ? audio.error.code : ''}`.trim());
    let started;
    try { started = audio.play(); } catch (err) { done(false, err && err.name ? err.name : 'play'); return; }
    if (started && typeof started.then === 'function') {
      started.then(() => { if (onResult) onResult(true, ''); }, (err) => done(false, err && err.name ? err.name : 'play'));
    } else if (onResult) onResult(true, '');
  });
}

// v10.7.2 : dernier toucher d'une carte en amazigh (montré en petit sur l'Accueil).
// ok : true (son parti), false (pas parti) ; why : 'sans voix', ou la raison donnée par le téléphone.
export const lastAmazighPlay = { at: 0, ok: null, why: '', lang: null };
function noteAmazighPlay(lang, ok, why) {
  lastAmazighPlay.at = Date.now();
  lastAmazighPlay.ok = ok;
  lastAmazighPlay.why = why || '';
  lastAmazighPlay.lang = lang;
}

// Sur Android, la liste des voix arrive en retard : on la garde à jour.
let voiceList = [];
function voices() {
  if (!('speechSynthesis' in window)) return [];
  if (!voiceList.length) voiceList = window.speechSynthesis.getVoices();
  return voiceList;
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', () => { voiceList = window.speechSynthesis.getVoices(); });
}

// Voix du téléphone en priorité (marche sans internet), sinon n'importe quelle voix de la langue.
function pickVoice(lang) {
  const all = voices();
  // v7.2 : 11 langues. 'ar' = toute voix arabe (darija et arabe), les autres par leur code (en, es, zh…).
  const key = lang || 'fr';
  const matches = (v) => v.lang.replace('_', '-').toLowerCase().startsWith(key);
  const exact = key === 'ar' ? 'ar-MA' : langInfo(key).tts;
  const candidates = all.filter(matches);
  if (preferredVoices[key]) {
    const chosen = candidates.find((v) => v.name === preferredVoices[key]);
    if (chosen) return chosen;
  }
  const isNatural = (v) => /premium|enhanced|natural|siri|audrey|thomas|amélie|amelie|majed|maged|laila|tarik/i.test(v.name);
  return candidates.find((v) => v.lang.replace('_', '-') === exact && isNatural(v))
    || candidates.find((v) => isNatural(v))
    || candidates.find((v) => v.lang.replace('_', '-') === exact && v.localService)
    || candidates.find((v) => v.localService)
    || candidates.find((v) => v.lang.replace('_', '-') === exact)
    || candidates[0] || null;
}

export const hasArabicVoice = () => Boolean(pickVoice('ar'));

// iPhone et Android ne parlent qu'après un premier toucher : on y dit une phrase muette pour débloquer la voix.
let unlocked = false;
export function unlockAudio() {
  if (unlocked || !('speechSynthesis' in window)) return;
  unlocked = true;
  voices();
  const synth = window.speechSynthesis;
  synth.resume();
  if (!synth.speaking && !synth.pending) {
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    silent.lang = 'fr-FR';
    synth.speak(silent);
  }
}

// Dit un texte avec la voix du téléphone. lang : 'fr' ou 'ar'.
export function speak(text, { lang = 'fr', rate = RATE } = {}) {
  return new Promise((resolve) => {
    if (!text || !('speechSynthesis' in window)) { resolve(); return; }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    utterance.lang = voice ? voice.lang.replace('_', '-') : (lang === 'ar' ? 'ar-MA' : langInfo(lang).tts);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.volume = 1;
    // Certains Android ne déclenchent jamais onend : on libère la file au bout d'un délai raisonnable.
    const safety = setTimeout(resolve, 1500 + text.length * 180);
    const done = () => { clearTimeout(safety); if (currentUtterance === utterance) currentUtterance = null; resolve(); };
    utterance.onend = done;
    utterance.onerror = done;
    currentUtterance = utterance;
    const go = () => { synth.resume(); synth.speak(utterance); };
    const wait = AFTER_CANCEL_MS - (Date.now() - lastCancel);
    if (wait > 0) setTimeout(go, wait); else go();
  });
}

export function recordingFor(card, lang) {
  // v10.7 : la voix amazighe du parent est gardée à part (jamais sur la carte, donc jamais sauvegardée ni synchronisée).
  if (isAmazighLang(lang)) return parentAmazighVoice(lang, card.id);
  return lang === 'dr' ? card.audioDr : card.audioFr;
}

// Voix par défaut livrées avec l'app (voix/fr/<id>.mp3, voix/dr/<id>.mp3) : marchent sans voix installée sur le téléphone.
// v9.10 : darija refaite avec la voix OpenAI « shimmer » (consigne accent marocain), fabriquée à l'avance sur le PC (scripts/voix-openai).
// Le français garde Éloïse (edge-tts) : la voix OpenAI lisait certains mots à l'anglaise (« Pain » = douleur).
// Aucune clé dans l'appli. v9.14 : Donner et Chips passent aussi en Shimmer (plus d'exception Mouna). La voix du parent passe toujours avant.
// v9.14 : voix des 7 Amis (voix/fr|dr/ami-<id>-<1|2>.mp3), jouées par playVoiceFile.
// voix/index.json = { fr: { <id>: <texte dit> }, dr: { <id>: <texte dit> } } ; un mot modifié par le parent n'utilise plus le fichier.
let defaultVoices = { fr: {}, dr: {} };
export async function loadDefaultVoices() {
  try {
    const response = await fetch('./voix/index.json');
    if (response.ok) defaultVoices = { fr: {}, dr: {}, ...(await response.json()) };
  } catch { /* pas de voix par défaut : on garde la voix du téléphone */ }
}

const spokenText = (card, lang) => (lang === 'dr' ? (card.sayAr || card.ar) : (card.sayFr || card.fr));

export function defaultVoiceUrl(card, lang) {
  if (isAmazighLang(lang)) return null; // v10.7 : pas de voix française livrée pour une carte dite en amazigh
  const key = lang === 'dr' ? 'dr' : 'fr';
  const text = spokenText(card, key);
  return text && defaultVoices[key][card.id] === text ? `./voix/${key}/${encodeURIComponent(card.id)}.mp3` : null;
}

// v10.5 : si le son ne part pas (hors ligne), on le relit depuis la copie gardée dans le téléphone.
async function playCachedUrlAsBlob(url) {
  try {
    if (!('caches' in window)) return false;
    const hit = await caches.match(url, { ignoreSearch: true });
    if (!hit || !hit.ok) return false;
    const blob = await hit.blob();
    return blob && blob.size > 0 ? await playBlob(blob) : false;
  } catch { return false; }
}

// Joue un fichier son ; renvoie false s'il n'a pas pu être lu (pour passer à la voix du téléphone).
async function playUrl(url) {
  const ok = await playUrlDirect(url);
  return ok || playCachedUrlAsBlob(url);
}

function playUrlDirect(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    let started = false;
    const done = (ok) => { if (currentAudio === audio) currentAudio = null; resolve(ok); };
    audio.onplaying = () => { started = true; };
    audio.onended = () => done(true);
    audio.onerror = () => done(started);
    audio.play().catch(() => done(false));
  });
}

// v9.14 : joue un fichier son livré avec l'app (voix des Amis). Renvoie false si le fichier manque.
export function playVoiceFile(url) {
  stopSpeaking();
  return playUrl(url);
}

// Voix du téléphone : voix arabe pour la darija (si graphie arabe), sinon français.
function sayWithPhoneVoice(card, lang) {
  const arabic = card.sayAr || card.ar;
  if (lang === 'dr' && arabic && hasArabicVoice()) return speak(arabic, { lang: 'ar' });
  return speak(card.sayFr || card.fr, { lang: 'fr' });
}

// Ordre : 1) voix enregistrée par le parent ; 2) voix par défaut livrée avec l'app ; 3) voix du téléphone.
// sayFr / sayAr : phrase à dire quand elle diffère du mot affiché (ex. « Ghita, ma sœur »).
export async function sayCard(card, lang) {
  // v10.7 : amazigh. 1) voix du parent ; 2) pack vocal installé ; 3) silence. Jamais la voix du téléphone
  // (elle lirait l'amazigh avec un accent faux, et pas du tout le tifinagh). Rien ne part sur internet.
  if (isAmazighLang(lang)) {
    const voice = amazighVoiceFor(lang, card.id);
    if (!voice) { noteAmazighPlay(lang, false, 'sans voix'); return false; }
    return playBlob(voice, { onResult: (ok, why) => noteAmazighPlay(lang, ok, why) });
  }
  // Langues ajoutées (v7.2) : le mot traduit, dit par la voix du téléphone ; un mot sans traduction est dit en français.
  if (isExtraLang(lang)) return speak(cardWord(card, lang), { lang: hasWord(card, lang) ? lang : 'fr' });
  const recording = recordingFor(card, lang);
  if (recording) return playBlob(recording);
  const url = defaultVoiceUrl(card, lang);
  if (url && await playUrl(url)) return undefined;
  return sayWithPhoneVoice(card, lang);
}

// Fait entendre la voix par défaut d'une carte (fenêtre d'édition), même si une voix est enregistrée.
export const sayDefault = (card, lang) => {
  // v10.7 : en amazigh, la « voix par défaut » est celle du pack vocal installé (sinon rien).
  if (isAmazighLang(lang)) {
    const voice = packAmazighVoice(lang, card.id);
    return voice ? playBlob(voice) : Promise.resolve(false);
  }
  return sayCard({ ...card, audioFr: null, audioDr: null }, lang);
};

// v9.16 : catalogue des cartes (donné par app.js) pour retrouver la carte d'un verbe sous-entendu (« Je veux » + Pain -> Manger).
let cardCatalog = [];
export function setCardCatalog(cards) { cardCatalog = Array.isArray(cards) ? cards : []; }


// items : [{ card, lang }] — chaque mot garde sa langue (code-switching).
export async function sayCards(items, { onStep } = {}) {
  stopSpeaking();
  const token = queueToken;
  const morphOk = items.length > 1 && items.every((x) => x.lang === 'fr' || x.lang === 'dr');
  let inflected = null;
  if (morphOk) { try { inflected = inflectStrip(items); } catch { inflected = null; } }
  // v9.16.3 : sur iPhone en mode silencieux, la voix du téléphone est coupée (les fichiers sons, eux, passent).
  // Donc ▶ joue toujours les sons des cartes, et glisse le verbe sous-entendu (« je veux » + « manger » + « pain »).
  // La phrase entière bien accordée reste sur le bouton ✨ sous la bande (voix du téléphone).
  const anyRecording = items.some((x) => recordingFor(x.card, x.lang) || defaultVoiceUrl(x.card, x.lang));
  const sameLang = items.length > 1 && items.every((x) => x.lang === items[0].lang);
  if (!anyRecording && sameLang && items[0].lang === 'fr') {
    const natural = buildNaturalSentence(items, 'fr');
    if (natural) {
      if (onStep) onStep(0);
      await speak(natural, { lang: 'fr' });
      if (onStep && token === queueToken) onStep(-1);
      return;
    }
  }
  // Mot par mot (sons enregistrés). v9.16 : on glisse la carte du verbe sous-entendu avant le nom (« bghit » + « nakoul » + « l-khobz »).
  const queue = [];
  items.forEach((item, i) => {
    const t = inflected && inflected.tokens[i];
    const verbCard = t && t.impliedVerbCardId ? cardCatalog.find((c) => c.id === t.impliedVerbCardId) : null;
    if (verbCard) queue.push({ card: verbCard, lang: item.lang, step: i });
    queue.push({ card: item.card, lang: item.lang, step: i });
  });
  for (const q of queue) {
    if (token !== queueToken) return;
    if (onStep) onStep(q.step);
    await sayCard(q.card, q.lang);
  }
  if (onStep && token === queueToken) onStep(-1);
}

// Mêmes fonctions sous les noms de l'expression de besoin v3.
export const speakCard = sayCard;
export const speakSequence = (cards, lang, onHighlight) => sayCards(cards.map((card) => ({ card, lang })), { onStep: onHighlight });

// ---------- v7 (Aegon) : Reconnaissance vocale (Web Speech API) + Sélecteur de meilleure voix naturelle ----------
let preferredVoices = { fr: '', ar: '' };
export function setPreferredVoice(lang, name) {
  preferredVoices[lang === 'dr' ? 'ar' : lang] = name || '';
  try { localStorage.setItem('kalimati_voices', JSON.stringify(preferredVoices)); } catch {}
}
try {
  const saved = JSON.parse(localStorage.getItem('kalimati_voices') || '{}');
  if (saved && typeof saved === 'object') preferredVoices = { ...preferredVoices, ...saved };
} catch {}

export function availableVoices(lang = 'fr') {
  const target = lang === 'dr' ? 'ar' : lang;
  return voices().filter((v) => (target === 'ar' ? v.lang.startsWith('ar') : v.lang.replace('_', '-').startsWith('fr')));
}

// Normalise un mot prononcé pour comparer avec la cible (sans accents ni ponctuation).
const normSpeech = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();

// v9.7 : message honnête. La reconnaissance de la voix du navigateur (Chrome) passe par les serveurs de Google :
// ce que dit l'enfant part sur internet le temps d'être compris. Kalimati ne garde que le mot reconnu.
export const SPEECH_CLOUD_NOTE = '🌐 Bon à savoir : la reconnaissance automatique passe par Google (Chrome). La voix part sur internet le temps d’être comprise. Sans internet, l’adulte note lui-même.';

// v9.8 : éteinte par défaut. Le parent l'allume dans « Progrès » (réglage « speechCloudAllowed »).
// Tant qu'elle est éteinte, aucun bouton ne l'utilise et aucun son ne part vers Google.
export const SPEECH_SETTING_KEY = 'speechCloudAllowed';
let cloudSpeechAllowed = false;
export function setCloudSpeechAllowed(value) { cloudSpeechAllowed = value === true; }
export const isCloudSpeechAllowed = () => cloudSpeechAllowed;
export const browserCanRecognizeSpeech = () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export function canRecognizeSpeech() {
  return cloudSpeechAllowed && browserCanRecognizeSpeech();
}

// Écoute et transcrit un mot ou une phrase prononcée par Abir (renvoie { heard, transcript, match, confidence }).
export function recognizeSpeech({ expected = '', lang = 'fr', timeoutMs = 4500 } = {}) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !cloudSpeechAllowed) { resolve({ supported: false, heard: false, transcript: '', match: false }); return; }
    const rec = new SR();
    rec.lang = lang === 'dr' || lang === 'ar' ? 'ar-MA' : 'fr-FR';
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    let best = '';
    let matched = false;
    let done = false;
    const target = normSpeech(expected);
    const finish = (heard) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.stop(); } catch {}
      resolve({ supported: true, heard, transcript: best, match: matched });
    };
    const timer = setTimeout(() => finish(Boolean(best)), timeoutMs);
    rec.onresult = (event) => {
      for (let i = 0; i < event.results.length; i += 1) {
        const res = event.results[i];
        for (let j = 0; j < res.length; j += 1) {
          const alt = res[j].transcript || '';
          if (!best || alt.length > best.length) best = alt.trim();
          const n = normSpeech(alt);
          if (target && (n === target || n.includes(target) || target.includes(n) && n.length >= 2)) {
            matched = true;
            finish(true);
            return;
          }
        }
      }
    };
    rec.onerror = () => finish(Boolean(best));
    rec.onend = () => finish(Boolean(best));
    try { rec.start(); } catch { finish(false); }
  });
}

// v9.13 : phrase conjuguée et accordée (moteur hors-ligne modules/morphology.js : temps, genre, articles).
// Ancienne méthode (v7) gardée en secours si le moteur ne rend rien.
export function buildNaturalSentence(items, lang = 'fr') {
  if (!items || !items.length) return '';
  const darija = lang === 'dr' || items.every((x) => x.lang === 'dr');
  let inflected = null;
  try { inflected = inflectStrip(items); } catch { inflected = null; }
  if (darija) {
    return (inflected && inflected.sentenceAr) || items.map((x) => x.card.sayAr || x.card.ar || x.card.dr || x.card.fr).join(' ');
  }
  if (inflected && inflected.sentenceFr) return inflected.sentenceFr;
  return legacyNaturalSentence(items);
}

// v9.13 : dit la phrase conjuguée entière (bouton « ✨ » sous la bande). Voix du téléphone.
// Darija : seulement si le téléphone a une voix arabe. Sinon on renvoie false et l'appelant rejoue les mots un par un (fichiers sons).
export async function sayNaturalSentence({ sentenceFr = '', sentenceAr = '', lang = 'fr' } = {}) {
  // v10.7 : pas de voix du téléphone en amazigh : l'appelant rejoue les mots un par un (voix du parent ou du pack).
  if (isAmazighLang(lang)) return false;
  if (lang === 'dr') {
    if (!sentenceAr || !hasArabicVoice()) return false;
    stopSpeaking();
    await speak(sentenceAr, { lang: 'ar' });
    return true;
  }
  if (!sentenceFr) return false;
  stopSpeaking();
  await speak(sentenceFr, { lang: 'fr' });
  return true;
}

function legacyNaturalSentence(items) {
  const words = items.map((x) => {
    const c = x.card;
    if (c.id === 'c-personnes-moi') return 'Je';
    return (c.sayFr || c.fr || '').trim();
  });
  return words.join(' ')
    .replace(/\bJe\s+Je veux\b/gi, 'Je veux')
    .replace(/\b(Je veux)\s+(Manger|Boire|Jouer|Courir|Donner|Couper|Sauter|Laver|Dessiner|Ouvrir|Lire|Écrire|Regarder|Écouter|Dormir)\b/gi, (_, a, b) => `${a} ${b.toLowerCase()}`)
    .replace(/\b(Je veux)\s+(Pain|Riz|Fromage|Jus|Lait|Chocolat|Gâteau|Biscuit)\b/gi, (_, a, b) => `${a} du ${b.toLowerCase()}`)
    .replace(/\b(Je veux)\s+(Eau)\b/gi, "Je veux de l'eau")
    .replace(/\b(Je veux)\s+(Pomme|Banane|Poupée|Tablette|Balançoire|Musique)\b/gi, (_, a, b) => `${a} la ${b.toLowerCase()}`)
    .replace(/\b(Je veux)\s+(Ballon)\b/gi, 'Je veux le ballon');
}
