// Fait parler une carte : voix enregistrée par le parent d'abord, puis voix du téléphone.
// Voix lente (0,85), darija lue avec une voix arabe si la graphie arabe existe, phrases mélangeant FR et darija.

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

export function playBlob(blob, { rate = 1 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;
    const done = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
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
  const matches = (v) => (lang === 'ar' ? v.lang.startsWith('ar') : v.lang.replace('_', '-').startsWith('fr'));
  const exact = lang === 'ar' ? 'ar-MA' : 'fr-FR';
  const candidates = all.filter(matches);
  return candidates.find((v) => v.lang.replace('_', '-') === exact && v.localService)
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
    utterance.lang = voice ? voice.lang.replace('_', '-') : (lang === 'ar' ? 'ar-MA' : 'fr-FR');
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
  return lang === 'dr' ? card.audioDr : card.audioFr;
}

// Voix par défaut livrées avec l'app (voix/fr/<id>.mp3, voix/dr/<id>.mp3) : marchent sans voix installée sur le téléphone.
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
  const key = lang === 'dr' ? 'dr' : 'fr';
  const text = spokenText(card, key);
  return text && defaultVoices[key][card.id] === text ? `./voix/${key}/${encodeURIComponent(card.id)}.mp3` : null;
}

// Joue un fichier son ; renvoie false s'il n'a pas pu être lu (pour passer à la voix du téléphone).
function playUrl(url) {
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

// Voix du téléphone : voix arabe pour la darija (si graphie arabe), sinon français.
function sayWithPhoneVoice(card, lang) {
  const arabic = card.sayAr || card.ar;
  if (lang === 'dr' && arabic && hasArabicVoice()) return speak(arabic, { lang: 'ar' });
  return speak(card.sayFr || card.fr, { lang: 'fr' });
}

// Ordre : 1) voix enregistrée par le parent ; 2) voix par défaut livrée avec l'app ; 3) voix du téléphone.
// sayFr / sayAr : phrase à dire quand elle diffère du mot affiché (ex. « Ghita, ma sœur »).
export async function sayCard(card, lang) {
  const recording = recordingFor(card, lang);
  if (recording) return playBlob(recording);
  const url = defaultVoiceUrl(card, lang);
  if (url && await playUrl(url)) return undefined;
  return sayWithPhoneVoice(card, lang);
}

// Fait entendre la voix par défaut d'une carte (fenêtre d'édition), même si une voix est enregistrée.
export const sayDefault = (card, lang) => sayCard({ ...card, audioFr: null, audioDr: null }, lang);

// items : [{ card, lang }] — chaque mot garde sa langue (code-switching).
export async function sayCards(items, { onStep } = {}) {
  stopSpeaking();
  const token = queueToken;
  for (let i = 0; i < items.length; i += 1) {
    if (token !== queueToken) return;
    if (onStep) onStep(i);
    await sayCard(items[i].card, items[i].lang);
  }
  if (onStep && token === queueToken) onStep(-1);
}

// Mêmes fonctions sous les noms de l'expression de besoin v3.
export const speakCard = sayCard;
export const speakSequence = (cards, lang, onHighlight) => sayCards(cards.map((card) => ({ card, lang })), { onStep: onHighlight });
