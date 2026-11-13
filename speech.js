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
  const key = lang === 'ar' ? 'ar' : 'fr';
  const matches = (v) => (key === 'ar' ? v.lang.startsWith('ar') : v.lang.replace('_', '-').startsWith('fr'));
  const exact = key === 'ar' ? 'ar-MA' : 'fr-FR';
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

export function canRecognizeSpeech() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Écoute et transcrit un mot ou une phrase prononcée par Abir (renvoie { heard, transcript, match, confidence }).
export function recognizeSpeech({ expected = '', lang = 'fr', timeoutMs = 4500 } = {}) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { resolve({ supported: false, heard: false, transcript: '', match: false }); return; }
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

// v7 (Aegon) : Assemblage grammatical naturel des phrases de la bande CAA (élision « Je veux » + verbe/nom, pronoms, etc.)
export function buildNaturalSentence(items, lang = 'fr') {
  if (!items || !items.length) return '';
  if (lang === 'dr' || items.every((x) => x.lang === 'dr')) {
    return items.map((x) => x.card.sayAr || x.card.ar || x.card.dr || x.card.fr).join(' ');
  }
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
