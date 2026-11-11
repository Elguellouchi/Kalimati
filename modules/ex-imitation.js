// Sections D et E : imitation motrice (miroir, gestes fins, chansons) et vocale (écho, phrases, atelier /t/ /d/ /k/).
// La caméra du miroir n'enregistre rien. Les voix d'Abir restent dans le téléphone et ne sont jamais exportées.
import * as db from '../db.js';
import { h, btn, sample, sleep, uid } from './util.js';
import { speak, playBlob, stopSpeaking } from '../speech.js';
import { startListening, startRecording, canRecord } from '../media.js';
import { recordTrial, ratingPanel } from './aba.js';
import { bigCard, videoModel, modeTabs } from './widgets.js';
import { nour, setBubbleLevel } from './nour.js';
import { GESTURE_SEQUENCE, FINE_GESTURES, SONGS, ECHO_WORDS, ECHO_PHRASES, PHONEMES } from './content.js';

const itemSelect = (items, label, onPick) => h('select', { 'aria-label': label, onchange: (e) => onPick(items.find((i) => i.id === e.target.value)) },
  items.map((i) => h('option', { value: i.id }, i.fr || i.label || i.id)));

// D.1 : Studio Miroir.
function d1(ctx) {
  let seq = sample(GESTURE_SEQUENCE, 3);
  let length = 3;
  const strip = h('div', { class: 'gesture-strip' });
  const draw = () => strip.replaceChildren(...seq.slice(0, length).map((g, i) => h('div', { class: 'gesture', dataset: { i } }, h('span', { class: 'step-num' }, String(i + 1)), h('span', { class: 'emoji' }, g.emoji), h('span', { class: 'label' }, g.fr))));
  const show = async () => {
    const cells = [...strip.children];
    for (let i = 0; i < cells.length; i += 1) {
      cells.forEach((c) => c.classList.remove('lit'));
      cells[i].classList.add('lit');
      await speak(seq[i].fr);
      await sleep(700);
    }
    cells.forEach((c) => c.classList.remove('lit'));
  };
  const video = h('video', { class: 'mirror', autoplay: true, playsinline: true, muted: true });
  const camBox = h('div', { class: 'mirror-box' }, h('p', { class: 'note' }, 'Le miroir montre Abir à elle-même. Rien n’est enregistré.'));
  let stream = null;
  const startCam = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      camBox.replaceChildren(video);
    } catch {
      camBox.replaceChildren(h('p', { class: 'note' }, 'Caméra refusée ou absente. Autorisez-la dans les réglages du téléphone.'));
    }
  };
  ctx.onCleanup(() => { if (stream) stream.getTracks().forEach((t) => t.stop()); });
  const lengthSelect = h('select', { onchange: (e) => { length = Number(e.target.value); draw(); } }, h('option', { value: 3 }, '3 gestes'), h('option', { value: 2 }, '2 gestes'));
  draw();
  return h('div', { class: 'stack' },
    h('div', { class: 'mirror-studio' }, h('div', { class: 'stack' }, strip, h('div', { class: 'row center' }, btn('▶ Montrer la séquence', show, 'primary'), btn('🔀', () => { seq = sample(GESTURE_SEQUENCE, 3); draw(); }, 'ghost'), lengthSelect)),
      h('div', { class: 'stack' }, camBox, btn('📷 Activer le miroir', startCam, 'ghost'))),
    ratingPanel('D.1', { item: () => seq.slice(0, length).map((g) => g.id).join('>'), labels: { plus: 'Séquence complète ✅' } }));
}

// D.2 : gestes fins, vidéo modèle avec ralenti.
function d2(ctx) {
  let current = FINE_GESTURES[0];
  const stage = h('div');
  const draw = () => stage.replaceChildren(bigCard(current.emoji, current.fr), videoModel(`fine:${current.id}`, current.alt || current.emoji, { canEdit: ctx.parent }));
  draw();
  return h('div', { class: 'stack' },
    itemSelect(FINE_GESTURES, 'Geste', (g) => { current = g; draw(); speak(g.fr); }),
    stage,
    ratingPanel('D.2', { item: () => current.id }));
}

// D.3 : chansons à gestes, un geste en grand à chaque ligne.
function d3() {
  let song = SONGS[0];
  let token = 0;
  const stage = h('div', { class: 'song-stage' }, nour({ pose: 'sit', size: 90 }));
  let slow = false;
  const play = async () => {
    token += 1;
    const mine = token;
    for (const [emoji, text] of song.lines) {
      if (mine !== token) return;
      stage.replaceChildren(bigCard(emoji, text, 'song-line'));
      await speak(text, { rate: slow ? 0.6 : 0.85 });
      await sleep(slow ? 1600 : 900);
    }
    if (mine === token) stage.replaceChildren(nour({ pose: 'wave', size: 90, says: 'Bravo !' }));
  };
  const slowBtn = btn('🐢 Plus lent', () => { slow = !slow; slowBtn.classList.toggle('active', slow); }, 'ghost');
  return h('div', { class: 'stack' },
    h('div', { class: 'row center' }, itemSelect(SONGS, 'Chanson', (s) => { song = s; token += 1; stopSpeaking(); }), btn('▶ Chanter', play, 'primary'), slowBtn),
    stage,
    ratingPanel('D.3', { item: () => song.id, labels: { plus: 'A imité les gestes ✅' } }));
}

// E.1 : Écho-Studio bisyllabique ; Nour souffle des bulles quand Abir vocalise.
function e1(ctx) {
  let word = ECHO_WORDS[0];
  let stop = null;
  let lastVoice = null;
  const pills = h('div', { class: 'syllables' });
  const otter = nour({ pose: 'bubbles', size: 110 });
  setBubbleLevel(otter, 0);
  const micBtn = btn('🎙️ À toi !', () => toggleMic(), 'primary');
  const replay = btn('▶ Réécouter', () => { if (lastVoice) playBlob(lastVoice); }, 'ghost');
  replay.disabled = true;
  const draw = () => pills.replaceChildren(h('span', { class: 'emoji big' }, word.emoji), ...word.syllables.map((s) => h('span', { class: 'pill' }, s)));
  const model = async () => {
    const cells = [...pills.querySelectorAll('.pill')];
    for (let i = 0; i < cells.length; i += 1) {
      cells.forEach((c) => c.classList.remove('lit')); cells[i].classList.add('lit');
      await speak(word.syllables[i], { rate: 0.7 });
      await sleep(250);
    }
    cells.forEach((c) => c.classList.add('lit'));
    await speak(word.fr);
    cells.forEach((c) => c.classList.remove('lit'));
  };
  async function toggleMic() {
    if (stop) {
      const result = await stop();
      stop = null; micBtn.textContent = '🎙️ À toi !'; setBubbleLevel(otter, 0);
      if (result.blob) { lastVoice = result.blob; replay.disabled = false; }
      return;
    }
    if (!canRecord()) { window.alert('Ce téléphone ne permet pas d’utiliser le micro ici.'); return; }
    try {
      stop = await startListening({ record: true, onLevel: (level) => setBubbleLevel(otter, level) });
      micBtn.textContent = '⏹ Stop';
      setTimeout(() => { if (stop) toggleMic(); }, 5000);
    } catch { window.alert('Le micro est refusé. Autorisez-le dans les réglages du téléphone.'); }
  }
  ctx.onCleanup(() => { if (stop) stop(); });
  draw();
  return h('div', { class: 'stack' },
    itemSelect(ECHO_WORDS, 'Mot', (w) => { word = w; draw(); }),
    pills,
    h('div', { class: 'row center' }, btn('🔊 Écouter le modèle', model, 'primary'), micBtn, replay),
    otter,
    ratingPanel('E.1', { item: () => word.id, withPrompts: false, labels: { plus: 'Intelligible ✅', prompt: 'Approximatif 👉', minus: 'Pas de réponse ❌' } }));
}

// E.2 : phrases de 2-3 mots, cartes éclairées l'une après l'autre.
function e2() {
  let phrase = ECHO_PHRASES[0];
  const row = h('div', { class: 'phrase-row' });
  const draw = () => row.replaceChildren(...phrase.words.map(([emoji, text]) => bigCard(emoji, text, 'phrase-card')));
  const play = async () => {
    const cards = [...row.children];
    for (let i = 0; i < cards.length; i += 1) {
      cards.forEach((c) => c.classList.remove('lit')); cards[i].classList.add('lit');
      await speak(phrase.words[i][1]);
    }
    cards.forEach((c) => c.classList.remove('lit'));
  };
  draw();
  const options = ECHO_PHRASES.map((p) => ({ id: p.id, fr: p.words.map((w) => w[1]).join(' ') }));
  return h('div', { class: 'stack' },
    itemSelect(options, 'Phrase', (p) => { phrase = ECHO_PHRASES.find((x) => x.id === p.id); draw(); }),
    row, btn('🔊 Écouter la phrase', play, 'primary'),
    ratingPanel('E.2', { item: () => phrase.id, labels: { plus: 'Phrase reproduite ✅' } }));
}

// E.3 : atelier phonémique, enregistrements horodatés + grille orthophonique.
function phonemeTab(phoneme) {
  const list = h('div', { class: 'stack' });
  const wordRow = (word) => {
    const key = `e3:${phoneme.id}:${word}`;
    const recs = h('div', { class: 'recs' });
    const drawRecs = async () => {
      const items = (await db.getRecordingsOf(key)).sort((a, b) => b.ts - a.ts).slice(0, 5);
      recs.replaceChildren(...items.map((r) => h('span', { class: 'rec' },
        btn(`▶ ${new Date(r.ts).toLocaleDateString('fr-FR')} ${new Date(r.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, () => playBlob(r.blob), 'ghost tiny'))));
    };
    let stop = null;
    const rec = btn('🎙️', async () => {
      if (stop) { const blob = await stop(); stop = null; rec.textContent = '🎙️'; await db.putRecording({ id: uid('rec'), key, ts: Date.now(), kind: 'child-voice', blob }); drawRecs(); return; }
      try { stop = await startRecording(); rec.textContent = '⏹'; } catch { window.alert('Le micro est refusé.'); }
    }, 'ghost');
    const grade = (result, label) => btn(label, async (e) => {
      await recordTrial('E.3', result, { item: `${phoneme.id}:${word}` });
      e.target.classList.add('active'); setTimeout(() => e.target.classList.remove('active'), 800);
    }, 'ghost tiny');
    drawRecs();
    return h('div', { class: 'phon-word' },
      h('strong', {}, word), btn('🔊', () => speak(word, { rate: 0.7 }), 'ghost'), rec,
      grade('plus', 'Net'), grade('prompt', 'Approximatif'), grade('minus', 'Substitué / omis'), recs);
  };
  list.append(
    h('div', { class: 'phon-cue' }, h('span', { class: 'emoji big' }, phoneme.emoji), h('p', {}, phoneme.cue)),
    ...phoneme.words.map(wordRow),
    btn('✅ Progrès validé avec l’orthophoniste', async (e) => {
      if (!window.confirm('Confirmer que l’orthophoniste valide l’amélioration ?')) return;
      await recordTrial('E.3', 'plus', { item: 'validation', meta: { validated: true, phoneme: phoneme.id } });
      e.target.textContent = 'Validation enregistrée ✅';
    }, 'ghost'));
  return list;
}

const e3 = () => modeTabs(PHONEMES.map((p) => [p.label, () => phonemeTab(p)]));

export const EXERCISES = { 'D.1': d1, 'D.2': d2, 'D.3': d3, 'E.1': e1, 'E.2': e2, 'E.3': e3 };
