// Fait parler une carte : voix enregistrée par le parent d'abord, puis voix du téléphone.
// Voix lente (0,85), darija lue avec une voix arabe si la graphie arabe existe, phrases mélangeant FR et darija.

const RATE = 0.85;
let currentAudio = null;
let queueToken = 0;

export function stopSpeaking() {
  queueToken += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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

function voices() {
  return 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
}

function pickVoice(lang) {
  const all = voices();
  if (lang === 'ar') return all.find((v) => v.lang === 'ar-MA') || all.find((v) => v.lang.startsWith('ar')) || null;
  return all.find((v) => v.lang === 'fr-FR') || all.find((v) => v.lang.startsWith('fr')) || null;
}

export const hasArabicVoice = () => Boolean(pickVoice('ar'));

// Android ne parle qu'après un premier geste : à appeler au premier toucher.
export function unlockAudio() {
  if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.resume(); }
}

// Dit un texte avec la voix du téléphone. lang : 'fr' ou 'ar'.
export function speak(text, { lang = 'fr', rate = RATE } = {}) {
  return new Promise((resolve) => {
    if (!text || !('speechSynthesis' in window)) { resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    utterance.lang = voice ? voice.lang : (lang === 'ar' ? 'ar-MA' : 'fr-FR');
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    // Certains Android ne déclenchent jamais onend : on libère la file au bout d'un délai raisonnable.
    const safety = setTimeout(resolve, 1500 + text.length * 180);
    const done = () => { clearTimeout(safety); resolve(); };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  });
}

export function recordingFor(card, lang) {
  return lang === 'dr' ? card.audioDr : card.audioFr;
}

// Voix enregistrée, sinon voix arabe pour la darija (si graphie arabe), sinon français.
// sayFr / sayAr : phrase à dire quand elle diffère du mot affiché (ex. « Ghita, ma sœur »).
export function sayCard(card, lang) {
  const recording = recordingFor(card, lang);
  if (recording) return playBlob(recording);
  const arabic = card.sayAr || card.ar;
  if (lang === 'dr' && arabic && hasArabicVoice()) return speak(arabic, { lang: 'ar' });
  return speak(card.sayFr || card.fr, { lang: 'fr' });
}

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
