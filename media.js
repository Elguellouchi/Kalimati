// Photos, vidéos courtes, voix du parent, écoute du micro et petits sons doux.
// Rien n'est envoyé sur internet : tout reste dans le téléphone.

const MAX_PHOTO_SIDE = 640;
const PHOTO_QUALITY = 0.85;
const MAX_ANIMATED_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 8;

// Les GIF / WebP animés sont gardés tels quels (sinon l'animation serait perdue).
export async function preparePhoto(file) {
  const animated = /image\/(gif|webp)/.test(file.type) && file.size <= MAX_ANIMATED_BYTES;
  return animated ? file : resizePhoto(file);
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Photo illisible'))), 'image/jpeg', PHOTO_QUALITY);
  });
}

export async function resizePhoto(file, maxSide = MAX_PHOTO_SIDE) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

// Capture une image du miroir caméra (carrée, non inversée pour l'enfant qui se voit en miroir).
export function captureVideoFrame(video, side = 800) {
  const size = Math.min(video.videoWidth, video.videoHeight);
  if (!size) return Promise.reject(new Error('La caméra n\'est pas prête.'));
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(side, size); canvas.height = canvas.width;
  const g = canvas.getContext('2d');
  g.translate(canvas.width, 0); g.scale(-1, 1);
  g.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

function videoDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (value) => { URL.revokeObjectURL(url); resolve(value); };
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(NaN);
    video.src = url;
  });
}

// Vidéo courte (3 à 5 s conseillé) pour illustrer un verbe ou un geste.
export async function prepareVideo(file) {
  if (!/^video\/(webm|mp4|quicktime)/.test(file.type)) throw new Error('Choisissez une vidéo (mp4 ou webm).');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Vidéo trop lourde. Filmez 3 à 5 secondes.');
  const seconds = await videoDuration(file);
  if (Number.isFinite(seconds) && seconds > MAX_VIDEO_SECONDS) throw new Error('Vidéo trop longue. Filmez 3 à 5 secondes.');
  return file;
}

export function canRecord() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

// Démarre l'enregistrement. Renvoie une fonction stop() qui donne le son enregistré.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
  const finished = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
  });
  recorder.start();
  return () => { if (recorder.state !== 'inactive') recorder.stop(); return finished; };
}
export const recordVoice = startRecording;

// Écoute le micro : onLevel(0..1) à chaque image, enregistre en option.
// stop() renvoie { blob, peak, voiced } ; voiced = une vocalisation a été entendue.
const VOICE_THRESHOLD = 0.12;

export async function startListening({ onLevel, record = false } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const context = new AudioCtx();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let peak = 0;
  let voicedFrames = 0;
  let frame = 0;
  const loop = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) sum += ((value - 128) / 128) ** 2;
    const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
    peak = Math.max(peak, level);
    if (level > VOICE_THRESHOLD) voicedFrames += 1;
    if (onLevel) onLevel(level);
    frame = requestAnimationFrame(loop);
  };
  loop();

  let recorder = null;
  const chunks = [];
  if (record && window.MediaRecorder) {
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.start();
  }

  return () => new Promise((resolve) => {
    cancelAnimationFrame(frame);
    const finish = () => {
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
      const blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null;
      resolve({ blob, peak, voiced: voicedFrames >= 6 });
    };
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = finish; recorder.stop(); } else finish();
  });
}

// Petits sons doux (jamais de buzzer) : notes courtes, volume faible, attaque et fin progressives.
// Sur téléphone, le contexte audio naît « en pause » : on le réveille à chaque toucher (unlockSounds) et avant chaque note.
let audioContext = null;
function soundContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  audioContext = audioContext || new AudioCtx();
  if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
  return audioContext;
}
export function unlockSounds() {
  if (audioContext && audioContext.state === 'running') return;
  const context = soundContext();
  if (!context) return;
  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, 22050);
  source.connect(context.destination);
  source.start(0);
}
function softNote(frequency, start, duration) {
  if (!soundContext()) return;
  const t = audioContext.currentTime + start;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.04);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}
export const playBeep = () => softNote(523, 0, 0.25);
export const playClap = () => { softNote(523, 0, 0.2); softNote(659, 0.16, 0.2); softNote(784, 0.32, 0.35); };

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}
