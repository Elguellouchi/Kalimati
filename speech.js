// Fait parler une carte : voix enregistrée par le parent d'abord, sinon voix du téléphone en français.

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

function playBlob(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

function pickFrenchVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang.startsWith('fr')) || null;
}

function speakFrench(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    const voice = pickFrenchVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

// La darija n'a pas de voix de synthèse fiable : sans enregistrement, on dit le mot en français.
export function recordingFor(card, lang) {
  return lang === 'dr' ? card.audioDr : card.audioFr;
}

export function sayCard(card, lang) {
  const recording = recordingFor(card, lang);
  return recording ? playBlob(recording) : speakFrench(card.fr);
}

export async function sayCards(cards, lang) {
  stopSpeaking();
  const token = queueToken;
  for (const card of cards) {
    if (token !== queueToken) return;
    await sayCard(card, lang);
  }
}
