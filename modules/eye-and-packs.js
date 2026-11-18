// 👁️ Palier 3 (Suivi Oculaire Dwell Tap iOS 18+ & Suivi de Tête Caméra locale)
// + 📦 Palier 1B (Explorateur de Packs Thématiques à la demande : +80 cartes bilingues FR/Darija + 10 000 pictogrammes ARASAAC).
// 100 % local-first, 0 $ de serveur, aucune image de la caméra ne quitte jamais l'appareil.

import * as db from '../db.js';
import { h, btn } from './util.js';
import { searchPictograms, downloadPictogram } from './arasaac.js';

const EYE_KEY = 'eyeTrackingConfig';
const INSTALLED_PACKS_KEY = 'installedThematicPacks';

let eyeCfg = {
  dwellMs: 0, // 0 (désactivé) | 800 | 1200 | 1800
  largeGaps: false, // Espacement élargi 18 px + cibles agrandies pour éviter les erreurs de regard
  headCamera: false, // Curseur piloté par le mouvement de la tête via caméra frontale locale
};

let dwellTimer = 0;
let dwellTarget = null;
let dwellRingEl = null;
let headStream = null;
let headLoopId = 0;
let cursorEl = null;

// ---------- 1. Mode Regard (Dwell Tap compatible Eye Tracking natif iOS 18 / iPadOS 18 & Android) ----------
export async function loadEyeTracking() {
  const saved = await db.getSetting(EYE_KEY);
  if (saved && typeof saved === 'object') {
    eyeCfg = { ...eyeCfg, ...saved };
  }
  applyEyeTrackingStyles();
  initDwellListener();
  if (eyeCfg.headCamera) startHeadTrackingCamera().catch(() => {});
}

function applyEyeTrackingStyles() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('dwell-large-gaps', Boolean(eyeCfg.largeGaps));
  if (!document.getElementById('kalimati-eye-styles')) {
    const style = document.createElement('style');
    style.id = 'kalimati-eye-styles';
    style.textContent = `
      body.dwell-large-gaps .grid, body.dwell-large-gaps .choices { gap: 18px !important; }
      body.dwell-large-gaps .card, body.dwell-large-gaps .choice { min-height: 118px !important; border-width: 3px !important; }
      .dwell-ring-overlay {
        position: fixed; pointer-events: none; z-index: 9998;
        border-radius: 22px; border: 4px solid #FFD54F;
        box-shadow: 0 0 0 4px rgba(31, 111, 92, 0.28);
        transition: opacity 0.15s ease;
      }
      .dwell-ring-bar {
        position: absolute; left: 0; bottom: 0; height: 7px;
        background: linear-gradient(90deg, #1F6F5C, #FFD54F);
        border-radius: 0 0 18px 18px; width: 0%;
      }
      #kalimati-head-cursor {
        position: fixed; width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255, 213, 79, 0.75); border: 3px solid #1F6F5C;
        pointer-events: none; z-index: 9999; transform: translate(-50%, -50%);
        transition: left 0.08s linear, top 0.08s linear;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      }
    `;
    document.head.append(style);
  }
}

function clearDwell() {
  if (dwellTimer) {
    clearTimeout(dwellTimer);
    dwellTimer = 0;
  }
  dwellTarget = null;
  if (dwellRingEl) {
    dwellRingEl.remove();
    dwellRingEl = null;
  }
}

function triggerDwellOnElement(el) {
  if (!eyeCfg.dwellMs || !el) return;
  if (el === dwellTarget) return;
  clearDwell();
  dwellTarget = el;

  const rect = el.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;

  const bar = h('div', { class: 'dwell-ring-bar' });
  bar.style.transition = `width ${eyeCfg.dwellMs}ms linear`;
  dwellRingEl = h('div', {
    class: 'dwell-ring-overlay',
    style: {
      left: `${Math.round(rect.left - 3)}px`,
      top: `${Math.round(rect.top - 3)}px`,
      width: `${Math.round(rect.width + 6)}px`,
      height: `${Math.round(rect.height + 6)}px`,
    },
  }, bar);
  document.body.append(dwellRingEl);

  requestAnimationFrame(() => {
    if (bar) bar.style.width = '100%';
  });

  dwellTimer = setTimeout(() => {
    const targetToClick = dwellTarget;
    clearDwell();
    if (targetToClick && document.body.contains(targetToClick)) {
      targetToClick.click();
    }
  }, eyeCfg.dwellMs);
}

let dwellListenerInstalled = false;
function initDwellListener() {
  if (dwellListenerInstalled || typeof document === 'undefined') return;
  dwellListenerInstalled = true;

  const selector = '.card, .choice, .strip-btn, .friend-banner, .nav-card, .morph-tense-btn, .morph-sentence-preview';
  document.addEventListener('pointerover', (e) => {
    if (!eyeCfg.dwellMs) return;
    const hit = e.target?.closest?.(selector);
    if (hit) triggerDwellOnElement(hit);
  });
  document.addEventListener('pointerout', (e) => {
    if (!dwellTarget) return;
    const related = e.relatedTarget?.closest?.(selector);
    if (related !== dwellTarget) clearDwell();
  });
}

// ---------- 2. Palier 2 : Suivi de la Tête par caméra frontale 100 % locale (zéro envoi réseau) ----------
export async function startHeadTrackingCamera() {
  stopHeadTrackingCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Caméra non disponible sur cet appareil.');
  }
  headStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 160 }, height: { ideal: 120 } },
    audio: false,
  });

  const video = document.createElement('video');
  video.srcObject = headStream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  cursorEl = h('div', { id: 'kalimati-head-cursor', style: { left: '50vw', top: '50vh' } });
  document.body.append(cursorEl);

  let smoothX = 0.5;
  let smoothY = 0.5;
  const selector = '.card, .choice, .strip-btn, .friend-banner, .nav-card';

  const step = () => {
    if (!headStream) return;
    ctx.drawImage(video, 0, 0, 64, 48);
    const frame = ctx.getImageData(0, 0, 64, 48).data;
    let sumX = 0;
    let sumY = 0;
    let weightTotal = 0;

    // Détection locale du centroïde du visage dans la zone centrale de l'image
    for (let y = 6; y < 42; y += 2) {
      for (let x = 8; x < 56; x += 2) {
        const idx = (y * 64 + x) * 4;
        const r = frame[idx];
        const g = frame[idx + 1];
        const b = frame[idx + 2];
        // Pondération des tons chair / luminance centrale
        const skinWeight = (r > 75 && g > 45 && r > b) ? (r + g) : ((r + g + b) * 0.25);
        sumX += (1 - x / 64) * skinWeight; // Miroir horizontal naturel
        sumY += (y / 48) * skinWeight;
        weightTotal += skinWeight;
      }
    }

    if (weightTotal > 0) {
      const rawX = Math.max(0.05, Math.min(0.95, ((sumX / weightTotal) - 0.32) / 0.36));
      const rawY = Math.max(0.05, Math.min(0.95, ((sumY / weightTotal) - 0.32) / 0.36));
      smoothX = smoothX * 0.82 + rawX * 0.18;
      smoothY = smoothY * 0.82 + rawY * 0.18;

      const px = Math.round(smoothX * window.innerWidth);
      const py = Math.round(smoothY * window.innerHeight);
      if (cursorEl) {
        cursorEl.style.left = `${px}px`;
        cursorEl.style.top = `${py}px`;
      }
      const elUnder = document.elementFromPoint(px, py)?.closest?.(selector);
      if (elUnder) {
        triggerDwellOnElement(elUnder);
      } else {
        clearDwell();
      }
    }
    headLoopId = requestAnimationFrame(step);
  };
  headLoopId = requestAnimationFrame(step);
}

export function stopHeadTrackingCamera() {
  if (headLoopId) {
    cancelAnimationFrame(headLoopId);
    headLoopId = 0;
  }
  if (headStream) {
    headStream.getTracks().forEach((t) => t.stop());
    headStream = null;
  }
  if (cursorEl) {
    cursorEl.remove();
    cursorEl = null;
  }
  clearDwell();
}

// ---------- 3. Explorateur de Packs Thématiques à la demande (FR + Darija + ARASAAC) ----------
export const THEMATIC_PACKS = [
  {
    id: 'ecole-classe',
    emoji: '🏫',
    title: 'École & Classe',
    desc: '10 cartes bilingues pour suivre en classe avec l’AVS et la maîtresse',
    cards: [
      { id: 'c-pack-cahier', cat: 'jouer', gram: 'noun', emoji: '📓', fr: 'Cahier', dr: 'Dftar', ar: 'دفتر', q: 'cahier' },
      { id: 'c-pack-crayon', cat: 'jouer', gram: 'noun', emoji: '✏️', fr: 'Crayon', dr: 'Qalam', ar: 'قلم', q: 'crayon' },
      { id: 'c-pack-cartable', cat: 'lieux', gram: 'noun', emoji: '🎒', fr: 'Cartable', dr: 'Chkara', ar: 'شكارة', q: 'cartable' },
      { id: 'c-pack-tableau', cat: 'lieux', gram: 'noun', emoji: '🧑‍🏫', fr: 'Tableau', dr: 'Sabboura', ar: 'سبورة', q: 'tableau classe' },
      { id: 'c-pack-recreation', cat: 'lieux', gram: 'noun', emoji: '🛝', fr: 'Récréation', dr: 'Stira7a', ar: 'استراحة', q: 'cour ecole' },
      { id: 'c-pack-ciseaux', cat: 'jouer', gram: 'noun', emoji: '✂️', fr: 'Ciseaux', dr: 'Mqess', ar: 'مقص', q: 'ciseaux' },
      { id: 'c-pack-colle', cat: 'jouer', gram: 'noun', emoji: '🧴', fr: 'Colle', dr: 'Lsaq', ar: 'لصاق', q: 'colle' },
      { id: 'c-pack-gomme', cat: 'jouer', gram: 'noun', emoji: '🧽', fr: 'Gomme', dr: 'Memsaha', ar: 'ممسحة', q: 'gomme' },
      { id: 'c-pack-ecouter-maitresse', cat: 'actions', gram: 'verb', emoji: '👂', fr: 'Écouter la maîtresse', dr: 'Nsme3 l-mo3allima', ar: 'نسمع للمعلمة', q: 'ecouter' },
      { id: 'c-pack-lever-main', cat: 'actions', gram: 'verb', emoji: '✋', fr: 'Lever la main', dr: 'Nhez yeddi', ar: 'نهز يدي', q: 'lever la main' },
    ],
  },
  {
    id: 'docteur-corps',
    emoji: '🩺',
    title: 'Docteur, Dentiste & Douleurs du corps',
    desc: '10 cartes pour montrer exactement où on a mal et préparer la visite médicale',
    cards: [
      { id: 'c-pack-mal-tete', cat: 'besoins', gram: 'social', emoji: '🤕', fr: 'Mal à la tête', dr: 'Rassi kayderni', ar: 'راسي كيضرني', q: 'mal de tete' },
      { id: 'c-pack-mal-ventre', cat: 'besoins', gram: 'social', emoji: '🤢', fr: 'Mal au ventre', dr: 'Kerchi katderni', ar: 'كرشي كتضرني', q: 'mal au ventre' },
      { id: 'c-pack-mal-dents', cat: 'besoins', gram: 'social', emoji: '🦷', fr: 'Mal aux dents', dr: 'Snani kayderroni', ar: 'سناني كيضروني', q: 'mal aux dents' },
      { id: 'c-pack-mal-oreilles', cat: 'besoins', gram: 'social', emoji: '👂', fr: 'Mal aux oreilles', dr: 'Wedni katderni', ar: 'ودني كتضرني', q: 'mal oreille' },
      { id: 'c-pack-docteur', cat: 'personnes', gram: 'person', emoji: '👩‍⚕️', fr: 'Docteur', dr: 'Tbib', ar: 'طبيب', q: 'medecin' },
      { id: 'c-pack-medicament', cat: 'besoins', gram: 'noun', emoji: '💊', fr: 'Médicament / Sirop', dr: 'Dwa', ar: 'دوا', q: 'medicament' },
      { id: 'c-pack-pansement', cat: 'besoins', gram: 'noun', emoji: '🩹', fr: 'Pansement', dr: 'Pansement', ar: 'فاصما', q: 'pansement' },
      { id: 'c-pack-thermometre', cat: 'besoins', gram: 'noun', emoji: '🌡️', fr: 'Thermomètre', dr: 'Mizane s-skhana', ar: 'ميزان السخانة', q: 'thermometre' },
      { id: 'c-pack-mouchoir', cat: 'besoins', gram: 'noun', emoji: '🤧', fr: 'Mouchoir', dr: 'Kliniks', ar: 'كلينيكس', q: 'mouchoir' },
      { id: 'c-pack-casque-bruit', cat: 'besoins', gram: 'noun', emoji: '🎧', fr: 'Casque anti-bruit', dr: 'Casque', ar: 'كاسك', q: 'casque audio' },
    ],
  },
  {
    id: 'cuisine-maroc',
    emoji: '🍲',
    title: 'Cuisine & Repas Marocains',
    desc: '10 cartes des plats familiaux au Maroc (Couscous, Tajine, Msemen, Thé…)',
    cards: [
      { id: 'c-pack-couscous', cat: 'manger', gram: 'noun', emoji: '🥘', fr: 'Couscous', dr: 'Ksksou', ar: 'كسكسو', q: 'couscous' },
      { id: 'c-pack-tajine', cat: 'manger', gram: 'noun', emoji: '🍲', fr: 'Tajine', dr: 'Tajine', ar: 'طاجين', q: 'ragout' },
      { id: 'c-pack-msemen', cat: 'manger', gram: 'noun', emoji: '🥞', fr: 'Msemen / Crêpe', dr: 'Msemen', ar: 'مسمن', q: 'crepe' },
      { id: 'c-pack-harira', cat: 'manger', gram: 'noun', emoji: '🥣', fr: 'Soupe / Harira', dr: '7rira', ar: 'حريرة', q: 'soupe' },
      { id: 'c-pack-poulet', cat: 'manger', gram: 'noun', emoji: '🍗', fr: 'Poulet', dr: 'Djaj', ar: 'دجاج', q: 'poulet roti' },
      { id: 'c-pack-poisson', cat: 'manger', gram: 'noun', emoji: '🐟', fr: 'Poisson', dr: '7out', ar: 'حوت', q: 'poisson' },
      { id: 'c-pack-frites', cat: 'manger', gram: 'noun', emoji: '🍟', fr: 'Frites', dr: 'Frit', ar: 'فريت', q: 'frites' },
      { id: 'c-pack-pates', cat: 'manger', gram: 'noun', emoji: '🍝', fr: 'Pâtes', dr: 'Les pâtes', ar: 'ليباط', q: 'spaghetti' },
      { id: 'c-pack-the-menthe', cat: 'boire', gram: 'noun', emoji: '🍵', fr: 'Thé à la menthe', dr: 'Atay', ar: 'أتاي', q: 'the' },
      { id: 'c-pack-dattes', cat: 'manger', gram: 'noun', emoji: '🌴', fr: 'Dattes', dr: 'Tmer', ar: 'تمر', q: 'datte' },
    ],
  },
  {
    id: 'sorties-jeux-sport',
    emoji: '⚽',
    title: 'Sorties, Parc, Plage & Sports',
    desc: '10 cartes pour choisir les activités du week-end à Salé et Rabat',
    cards: [
      { id: 'c-pack-toboggan', cat: 'jouer', gram: 'noun', emoji: '🛝', fr: 'Toboggan', dr: 'Toboggan', ar: 'زحليقة', q: 'toboggan' },
      { id: 'c-pack-velo', cat: 'jouer', gram: 'noun', emoji: '🚲', fr: 'Vélo', dr: 'Bikala', ar: 'بيكالا', q: 'velo' },
      { id: 'c-pack-trottinette', cat: 'jouer', gram: 'noun', emoji: '🛴', fr: 'Trottinette', dr: 'Trottinette', ar: 'تروتينيت', q: 'trottinette' },
      { id: 'c-pack-piscine', cat: 'lieux', gram: 'noun', emoji: '🏊‍♀️', fr: 'Piscine', dr: 'Lapiscine', ar: 'لابيسين', q: 'piscine' },
      { id: 'c-pack-plage', cat: 'lieux', gram: 'noun', emoji: '🏖️', fr: 'Plage / Mer', dr: 'Lb7er', ar: 'البحر', q: 'plage' },
      { id: 'c-pack-pate-modeler', cat: 'jouer', gram: 'noun', emoji: '🎨', fr: 'Pâte à modeler', dr: '3jina', ar: 'عجينة اللعب', q: 'pate a modeler' },
      { id: 'c-pack-puzzle', cat: 'jouer', gram: 'noun', emoji: '🧩', fr: 'Puzzle', dr: 'Puzzle', ar: 'بازل', q: 'puzzle' },
      { id: 'c-pack-bulles', cat: 'jouer', gram: 'noun', emoji: '🫧', fr: 'Bulles de savon', dr: 'Bwawaq', ar: 'فقاعات الصابون', q: 'bulles de savon' },
      { id: 'c-pack-supermarche', cat: 'lieux', gram: 'noun', emoji: '🛒', fr: 'Supermarché', dr: 'Marjane / Souq', ar: 'سوبرمارشي', q: 'supermarche' },
      { id: 'c-pack-promener', cat: 'actions', gram: 'verb', emoji: '🚶‍♀️', fr: 'Se promener', dr: 'Ntsara', ar: 'نتسارى', q: 'marcher' },
    ],
  },
];

export async function installThematicPack(packId, { fetchArasaac = true } = {}) {
  const pack = THEMATIC_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error('Pack introuvable.');

  const existingCards = await db.getAllCards();
  const byId = new Map(existingCards.map((c) => [c.id, c]));
  let maxOrder = existingCards.reduce((m, c) => Math.max(m, Number(c.order) || 0), 0);

  const toSave = [];
  for (const raw of pack.cards) {
    if (byId.has(raw.id)) continue;
    maxOrder += 1;
    let photoBlob = null;
    if (fetchArasaac && raw.q && navigator.onLine) {
      try {
        const hits = await searchPictograms(raw.q);
        if (hits && hits[0]?.id) {
          photoBlob = await downloadPictogram(hits[0].id);
        }
      } catch {
        // Garde l'émoji hors-ligne si ARASAAC ne répond pas
      }
    }
    toSave.push({
      id: raw.id,
      cat: raw.cat,
      gram: raw.gram,
      emoji: raw.emoji,
      fr: raw.fr,
      dr: raw.dr,
      ar: raw.ar,
      sub: '',
      order: maxOrder,
      hidden: false,
      photo: photoBlob,
      video: null,
      audioFr: null,
      audioDr: null,
    });
  }

  if (toSave.length) {
    await db.putCards(toSave);
  }
  const installed = (await db.getSetting(INSTALLED_PACKS_KEY)) || [];
  if (!installed.includes(pack.id)) {
    installed.push(pack.id);
    await db.setSetting(INSTALLED_PACKS_KEY, installed);
  }
  return { addedCount: toSave.length, packTitle: pack.title };
}

// ---------- 4. Interface Parent : Boîte Suivi Oculaire (Eye-Tracking) & Packs 10 000+ mots ----------
export function eyeTrackingAndPacksBox({ onCardsAdded } = {}) {
  const wrap = h('details', { class: 'card-box' },
    h('summary', {}, '👁️ Suivi Oculaire (Eye-Tracking / Dwell) & 📦 Packs Thématiques ARASAAC'));

  const body = h('div', { class: 'stack' });
  wrap.append(body);

  async function render() {
    const installed = (await db.getSetting(INSTALLED_PACKS_KEY)) || [];
    const statusNote = h('p', { class: 'note' },
      'Compatible avec le suivi oculaire natif iOS 18 / iPadOS 18 (Réglages > Accessibilité > Suivi des yeux) et le suivi de tête par caméra locale.');

    const dwellSelect = h('select', {
      onchange: async (e) => {
        eyeCfg.dwellMs = Number(e.target.value) || 0;
        await db.setSetting(EYE_KEY, eyeCfg);
        clearDwell();
        statusNote.textContent = eyeCfg.dwellMs
          ? `✅ Mode Regard activé : fixer une carte pendant ${eyeCfg.dwellMs / 1000} s la sélectionne automatiquement.`
          : 'Mode Regard (Dwell) désactivé.';
      },
    }, [
      [0, 'Désactivé (toucher normal)'],
      [800, 'Rapide — 0,8 s de regard'],
      [1200, 'Confort — 1,2 s de regard (recommandé iOS 18)'],
      [1800, 'Lent — 1,8 s de regard'],
    ].map(([val, label]) => h('option', { value: val, selected: eyeCfg.dwellMs === val ? 'selected' : null }, label)));

    const gapChk = h('input', {
      type: 'checkbox',
      checked: eyeCfg.largeGaps ? 'checked' : null,
      onchange: async (e) => {
        eyeCfg.largeGaps = e.target.checked;
        await db.setSetting(EYE_KEY, eyeCfg);
        applyEyeTrackingStyles();
      },
    });

    const camChk = h('input', {
      type: 'checkbox',
      checked: eyeCfg.headCamera ? 'checked' : null,
      onchange: async (e) => {
        eyeCfg.headCamera = e.target.checked;
        await db.setSetting(EYE_KEY, eyeCfg);
        if (eyeCfg.headCamera) {
          try {
            if (!eyeCfg.dwellMs) eyeCfg.dwellMs = 1200;
            await startHeadTrackingCamera();
            statusNote.textContent = '📷 Suivi de tête local activé (100 % dans le téléphone, aucune image envoyée).';
          } catch (err) {
            eyeCfg.headCamera = false;
            camChk.checked = false;
            statusNote.textContent = `⚠️ ${err.message || err}`;
          }
        } else {
          stopHeadTrackingCamera();
          statusNote.textContent = 'Caméra de suivi de tête arrêtée.';
        }
      },
    });

    const packRows = THEMATIC_PACKS.map((p) => {
      const isDone = installed.includes(p.id);
      const actionBtn = btn(
        isDone ? '✅ Déjà installé (Réinstaller)' : `📥 Installer (+${p.cards.length} cartes)`,
        async () => {
          actionBtn.disabled = true;
          actionBtn.textContent = '⏳ Téléchargement des pictogrammes ARASAAC…';
          try {
            const res = await installThematicPack(p.id, { fetchArasaac: true });
            statusNote.textContent = `✅ Pack « ${res.packTitle} » installé (+${res.addedCount} nouvelles cartes bilingues ajoutées dans Parler).`;
            if (typeof onCardsAdded === 'function') onCardsAdded(res);
            render();
          } catch (err) {
            statusNote.textContent = `⚠️ ${err.message || err}`;
            actionBtn.disabled = false;
          }
        },
        isDone ? 'ghost tiny' : 'primary tiny',
      );
      return h('div', { class: 'row spread wrap', style: { padding: '8px 0', borderBottom: '1px solid var(--line, #DDD8CE)' } },
        h('div', {},
          h('strong', {}, `${p.emoji} ${p.title}`),
          h('div', { class: 'note' }, p.desc)),
        actionBtn);
    });

    body.replaceChildren(
      statusNote,
      h('h3', {}, '👁️ 1. Suivi Oculaire (Eye-Tracking) & Suivi de Tête'),
      h('label', { class: 'check' }, 'Validation par fixation du regard (Dwell Tap) : ', dwellSelect),
      h('label', { class: 'check' }, gapChk, ' Espacement élargi (18 px) et grandes cibles anti-erreur de regard'),
      h('label', { class: 'check' }, camChk, ' Activer le curseur de suivi de la tête par caméra frontale (100 % local, Android / PC / iPad)'),
      h('h3', {}, '📦 2. Packs Thématiques à la demande (ARASAAC + Darija)'),
      h('p', { class: 'note' }, 'Téléchargez un pack thématique en 1 clic : ses cartes bilingues (FR + Darija) et leurs pictogrammes ARASAAC sont rangés dans le téléphone pour marcher ensuite sans internet.'),
      h('div', { class: 'stack' }, ...packRows),
    );
  }

  wrap.addEventListener('toggle', () => {
    if (wrap.open) render();
  });
  render();
  return wrap;
}
