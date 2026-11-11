// Système visuel unifié. Chaque image de l'application a une clé stable (visualKey).
// Ordre d'affichage : 1) vraie photo mise par le parent (store visual_overrides) ;
// 2) grande illustration (émotions, personnes, objets de B.1) ; 3) emoji en grand, remplaçable en 1 clic.
import * as db from '../db.js';
import { h, btn } from './util.js';
import { resizePhoto } from '../media.js';
import { searchPictograms, downloadPictogram, ARASAAC_CREDIT } from './arasaac.js';

const PHOTO_MAX_SIDE = 800;
const photos = new Map(); // visualKey → URL de la photo

export async function loadVisuals() {
  photos.forEach((url) => URL.revokeObjectURL(url));
  photos.clear();
  (await db.getAllVisualOverrides()).forEach((o) => photos.set(o.key, URL.createObjectURL(o.blob)));
}

export const slugKey = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hasPhoto = (key) => photos.has(key);

// Clé d'un item : explicite (visualKey / vkey), sinon dérivée du mot, sinon de l'emoji.
export function keyFor(item) {
  if (item.visualKey || item.vkey) return item.visualKey || item.vkey;
  const text = item.label || item.fr;
  return text ? `obj:${slugKey(text)}` : `emo:${[...String(item.emoji || '')].map((c) => c.codePointAt(0).toString(16)).join('-')}`;
}

// ---------- Illustrations : visages d'émotions (couleurs de fond inspirées des Zones of Regulation) ----------
const SKIN = '#F2C9A0';
const HAIR = '#4A2E1F';
const INK = '#3A2A22';
const ZONE = { green: '#CFEBD2', blue: '#CFE3F5', yellow: '#FBEBB5', red: '#F7CFC9' };

const EYES = {
  open: `<ellipse cx="76" cy="104" rx="13" ry="15" fill="#fff"/><ellipse cx="124" cy="104" rx="13" ry="15" fill="#fff"/>
    <circle cx="76" cy="106" r="7" fill="${INK}"/><circle cx="124" cy="106" r="7" fill="${INK}"/><circle cx="78.5" cy="103" r="2.5" fill="#fff"/><circle cx="126.5" cy="103" r="2.5" fill="#fff"/>`,
  wide: `<ellipse cx="76" cy="102" rx="16" ry="20" fill="#fff"/><ellipse cx="124" cy="102" rx="16" ry="20" fill="#fff"/>
    <circle cx="76" cy="104" r="6" fill="${INK}"/><circle cx="124" cy="104" r="6" fill="${INK}"/>`,
  closed: `<path d="M63 104 q13 11 26 0 M111 104 q13 11 26 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  happy: `<path d="M63 108 q13 -14 26 0 M111 108 q13 -14 26 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  squeezed: `<path d="M64 98 l22 8 l-22 8 M136 98 l-22 8 l22 8" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const BROWS = {
  up: 'M60 82 q16 -12 32 0 M108 82 q16 -12 32 0',
  flat: 'M62 82 h28 M110 82 h28',
  angry: 'M58 72 L94 88 M142 72 L106 88',
  sad: 'M58 88 L92 76 M142 88 L108 76',
};
const MOUTH = {
  smile: `<path d="M68 132 Q100 172 132 132 Z" fill="#7A2E2E"/><path d="M74 136 Q100 146 126 136 L130 132 L70 132Z" fill="#fff"/><ellipse cx="100" cy="156" rx="14" ry="7" fill="#E57373"/>`,
  calm: `<path d="M80 140 q20 14 40 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  frown: `<path d="M76 152 q24 -20 48 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  gritted: `<path d="M72 150 Q100 128 128 150 Q100 160 72 150Z" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="M86 141 v14 M100 138 v18 M114 141 v14" stroke="${INK}" stroke-width="3"/>`,
  o: `<ellipse cx="100" cy="148" rx="11" ry="14" fill="#7A2E2E"/>`,
  yawn: `<ellipse cx="100" cy="148" rx="18" ry="24" fill="#7A2E2E"/><ellipse cx="100" cy="162" rx="11" ry="7" fill="#E57373"/>`,
  wince: `<path d="M76 146 l12 -8 l12 8 l12 -8 l12 8" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const EXTRA = {
  tears: '<path d="M70 124 q-10 18 0 26 q10 -8 0 -26Z M130 124 q-10 18 0 26 q10 -8 0 -26Z" fill="#4AA8F0"/><path d="M62 150 q-7 12 0 18 q7 -6 0 -18Z" fill="#4AA8F0"/>',
  blush: '<circle cx="60" cy="128" r="12" fill="#F08A7A" opacity=".65"/><circle cx="140" cy="128" r="12" fill="#F08A7A" opacity=".65"/>',
  redcheeks: '<circle cx="60" cy="126" r="15" fill="#E5533D" opacity=".75"/><circle cx="140" cy="126" r="15" fill="#E5533D" opacity=".75"/>',
  hands: `<ellipse cx="50" cy="142" rx="17" ry="24" fill="${SKIN}" stroke="#D9A77C" stroke-width="3"/><ellipse cx="150" cy="142" rx="17" ry="24" fill="${SKIN}" stroke="#D9A77C" stroke-width="3"/>`,
  zzz: `<text x="150" y="52" font-size="30" font-weight="800" fill="#5B8DEF" font-family="system-ui,sans-serif">z</text><text x="168" y="34" font-size="20" font-weight="800" fill="#5B8DEF" font-family="system-ui,sans-serif">z</text>`,
  bandage: '<g transform="rotate(-18 128 62)"><rect x="104" y="54" width="48" height="16" rx="8" fill="#F6E6CC" stroke="#C9A77A" stroke-width="2"/><rect x="121" y="54" width="14" height="16" fill="#E9CFA4"/></g>',
  stars: '<text x="18" y="46" font-size="30">⭐</text><text x="150" y="42" font-size="30">⭐</text>',
};

function face({ zone, eyes, brows, mouth, extra = [] }) {
  return `<rect width="200" height="200" rx="36" fill="${ZONE[zone]}"/>
  <path d="M38 124 Q26 26 100 22 Q174 26 162 124 Z" fill="${HAIR}"/>
  <circle cx="42" cy="112" r="11" fill="${SKIN}"/><circle cx="158" cy="112" r="11" fill="${SKIN}"/>
  <ellipse cx="100" cy="110" rx="58" ry="64" fill="${SKIN}"/>
  <path d="M44 92 Q56 40 100 42 Q144 40 156 92 Q132 60 100 62 Q68 60 44 92Z" fill="${HAIR}"/>
  ${EYES[eyes]}<path d="${BROWS[brows]}" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>
  ${MOUTH[mouth]}${extra.map((e) => EXTRA[e]).join('')}`;
}

export const EMOTIONS = [
  { id: 'content', fr: 'Content', ask: 'contente', face: { zone: 'green', eyes: 'happy', brows: 'up', mouth: 'smile', extra: ['blush'] } },
  { id: 'triste', fr: 'Triste', ask: 'triste', face: { zone: 'blue', eyes: 'open', brows: 'sad', mouth: 'frown', extra: ['tears'] } },
  { id: 'colere', fr: 'En colère', ask: 'en colère', face: { zone: 'red', eyes: 'open', brows: 'angry', mouth: 'gritted', extra: ['redcheeks'] } },
  { id: 'peur', fr: "J'ai peur", ask: 'a peur', face: { zone: 'yellow', eyes: 'wide', brows: 'sad', mouth: 'o', extra: ['hands'] } },
  { id: 'fatigue', fr: 'Fatigué', ask: 'fatiguée', face: { zone: 'blue', eyes: 'closed', brows: 'flat', mouth: 'yawn', extra: ['zzz'] } },
  { id: 'calme', fr: 'Calme', ask: 'calme', face: { zone: 'green', eyes: 'closed', brows: 'flat', mouth: 'calm' } },
  { id: 'mal', fr: "J'ai mal", ask: 'a mal', face: { zone: 'blue', eyes: 'squeezed', brows: 'sad', mouth: 'wince', extra: ['bandage', 'tears'] } },
  { id: 'fier', fr: 'Fier', ask: 'fière', face: { zone: 'green', eyes: 'open', brows: 'up', mouth: 'smile', extra: ['stars'] } },
].map((e) => ({ ...e, vkey: `emotion:${e.id}` }));

// ---------- Illustrations : portraits (à remplacer par les vraies photos) ----------
const HAIRSTYLE = {
  pigtails: (c) => `<circle cx="42" cy="118" r="19" fill="${c}"/><circle cx="158" cy="118" r="19" fill="${c}"/><circle cx="50" cy="100" r="6" fill="#F06292"/><circle cx="150" cy="100" r="6" fill="#F06292"/>`,
  ponytail: (c) => `<path d="M146 60 Q190 70 176 140 Q160 120 150 96Z" fill="${c}"/><circle cx="150" cy="70" r="6" fill="#FFD54F"/>`,
  long: (c) => `<path d="M48 80 Q34 150 52 178 L148 178 Q166 150 152 80Z" fill="${c}"/>`,
  bob: (c) => `<path d="M48 80 Q40 120 54 140 L146 140 Q160 120 152 80Z" fill="${c}"/>`,
  bun: (c) => `<circle cx="100" cy="30" r="17" fill="${c}"/>`,
  short: () => '',
};

function portrait({ bg, hair, style, shirt, glasses = false, grey = false }) {
  const color = grey ? '#B8B8B8' : hair;
  return `<rect width="200" height="200" rx="36" fill="${bg}"/>
  ${HAIRSTYLE[style](color)}
  <path d="M26 200 Q28 152 100 148 Q172 152 174 200Z" fill="${shirt}"/>
  <rect x="88" y="132" width="24" height="24" rx="8" fill="${SKIN}"/>
  <ellipse cx="100" cy="94" rx="46" ry="52" fill="${SKIN}"/>
  <path d="M54 84 Q58 38 100 40 Q142 38 146 84 Q126 58 100 60 Q74 58 54 84Z" fill="${color}"/>
  <circle cx="82" cy="96" r="5.5" fill="${INK}"/><circle cx="118" cy="96" r="5.5" fill="${INK}"/>
  <circle cx="70" cy="112" r="8" fill="#F4A9A0" opacity=".55"/><circle cx="130" cy="112" r="8" fill="#F4A9A0" opacity=".55"/>
  <path d="M84 116 q16 14 32 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  ${glasses ? `<circle cx="82" cy="96" r="13" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="118" cy="96" r="13" fill="none" stroke="${INK}" stroke-width="3"/><path d="M95 96 h10" stroke="${INK}" stroke-width="3"/>` : ''}`;
}

const PORTRAITS = {
  abir: { bg: '#CDEFEA', hair: HAIR, style: 'pigtails', shirt: '#4FC3B8' },
  ghita: { bg: '#FBE0EC', hair: '#5A3825', style: 'ponytail', shirt: '#F06292' },
  papa: { bg: '#D6E6FA', hair: '#2E2420', style: 'short', shirt: '#5B8DEF' },
  maman: { bg: '#E9DCF7', hair: '#3B2A22', style: 'long', shirt: '#9575CD' },
  hosna: { bg: '#FFE9C9', hair: '#5A3825', style: 'bob', shirt: '#FFB74D', glasses: true },
  maitresse: { bg: '#DDF2D8', hair: '#6B4226', style: 'bun', shirt: '#66BB6A' },
  mamie: { bg: '#F3E5F5', hair: HAIR, style: 'bun', shirt: '#BA68C8', grey: true, glasses: true },
  papi: { bg: '#E0F2F1', hair: HAIR, style: 'short', shirt: '#4DB6AC', grey: true },
  camarade: { bg: '#FFF3D6', hair: '#2E2420', style: 'short', shirt: '#FF8A65' },
};

// ---------- Illustrations : objets de B.1 en deux styles du MÊME objet ----------
// Style A = illustration réaliste en couleurs ; style B = pictogramme au trait, retourné.
const OBJECTS = {
  pomme: { fr: 'pomme', color: '#D9342B', draw: (f, s) => `<path d="M100 66 C62 42 30 80 40 122 C48 162 80 178 100 166 C120 178 152 162 160 122 C170 80 138 42 100 66Z" fill="${f}" ${s}/><path d="M100 66 q2 -24 16 -32" stroke="#6B4226" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M114 44 q24 -14 36 4 q-22 12 -36 -4Z" fill="#5FA83A" ${s}/>` },
  chaise: { fr: 'chaise', color: '#B5793F', draw: (f, s) => `<rect x="58" y="28" width="16" height="150" rx="5" fill="${f}" ${s}/><rect x="58" y="34" width="62" height="14" rx="5" fill="${f}" ${s}/><rect x="58" y="62" width="62" height="12" rx="5" fill="${f}" ${s}/><rect x="58" y="102" width="92" height="18" rx="6" fill="${f}" ${s}/><rect x="134" y="118" width="16" height="60" rx="5" fill="${f}" ${s}/>` },
  chien: { fr: 'chien', color: '#B97A45', draw: (f, s) => `<path d="M40 120 q-18 -22 -8 -44" stroke="${f === '#fff' ? '#222' : f}" stroke-width="10" fill="none" stroke-linecap="round"/><ellipse cx="96" cy="124" rx="56" ry="30" fill="${f}" ${s}/><rect x="52" y="140" width="16" height="40" rx="7" fill="${f}" ${s}/><rect x="120" y="140" width="16" height="40" rx="7" fill="${f}" ${s}/><circle cx="150" cy="84" r="30" fill="${f}" ${s}/><path d="M130 62 q-14 22 0 44 q10 -20 0 -44Z" fill="#6B4226"/><circle cx="158" cy="78" r="5" fill="#222"/><ellipse cx="178" cy="92" rx="7" ry="5" fill="#222"/>` },
  tasse: { fr: 'tasse', color: '#3F8FD9', draw: (f, s) => `<path d="M136 86 q40 0 40 30 q0 30 -40 30" stroke="${f === '#fff' ? '#222' : f}" stroke-width="12" fill="none"/><path d="M48 70 h92 v70 q0 30 -30 30 h-32 q-30 0 -30 -30Z" fill="${f}" ${s}/><ellipse cx="94" cy="70" rx="46" ry="9" fill="#5A3A2A"/>` },
  chaussure: { fr: 'chaussure', color: '#E0572E', draw: (f, s) => `<path d="M28 150 Q26 96 58 92 L92 92 Q112 122 152 126 Q178 130 178 150Z" fill="${f}" ${s}/><rect x="26" y="148" width="154" height="16" rx="8" fill="${f === '#fff' ? '#222' : '#F4F4F4'}" stroke="#222" stroke-width="2"/><path d="M96 104 l14 -8 M106 114 l14 -8 M118 122 l14 -8" stroke="${f === '#fff' ? '#222' : '#fff'}" stroke-width="5" stroke-linecap="round"/>` },
  ballon: { fr: 'ballon', color: '#E8443A', draw: (f, s) => `<circle cx="100" cy="100" r="66" fill="${f}" ${s}/><path d="M40 78 Q100 110 160 78 M48 136 Q100 96 152 136" stroke="${f === '#fff' ? '#222' : '#fff'}" stroke-width="7" fill="none"/>` },
};
export const B1_OBJECTS = Object.entries(OBJECTS).map(([id, o]) => ({ id, fr: o.fr, a: `b1:${id}:a`, b: `b1:${id}:b` }));

function objectSvg(id, style) {
  const object = OBJECTS[id];
  if (style === 'a') {
    return `<defs><radialGradient id="g-${id}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="200" height="200" rx="28" fill="#EFE7DA"/><ellipse cx="100" cy="180" rx="66" ry="9" fill="#000" opacity=".12"/>
      ${object.draw(object.color, 'stroke="#00000033" stroke-width="3"')}<rect width="200" height="200" rx="28" fill="url(#g-${id})"/>`;
  }
  return `<rect x="3" y="3" width="194" height="194" rx="28" fill="#fff" stroke="#222" stroke-width="6"/>
    <g transform="translate(200 0) scale(-1 1)">${object.draw('#fff', 'stroke="#222" stroke-width="7" stroke-linejoin="round"')}</g>`;
}

function illustration(key) {
  const [kind, id, style] = key.split(':');
  if (kind === 'emotion') { const e = EMOTIONS.find((x) => x.id === id); return e ? face(e.face) : null; }
  if (kind === 'person') return PORTRAITS[id] ? portrait(PORTRAITS[id]) : null;
  if (kind === 'b1') return OBJECTS[id] ? objectSvg(id, style) : null;
  return null;
}
export const hasIllustration = (key) => /^(emotion|person|b1):/.test(key) && Boolean(illustration(key));

// ---------- Rendu ----------
function fill(box) {
  const key = box.dataset.vkey;
  const url = photos.get(key);
  const keep = [...box.children].filter((c) => c.classList.contains('photo-btn'));
  let content;
  if (url) content = h('img', { src: url, alt: '', class: 'visual-photo' });
  else {
    const svg = illustration(key);
    content = svg
      ? h('span', { class: 'visual-art', html: `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">${svg}</svg>` })
      : h('span', { class: 'emoji' }, box.dataset.emoji || '❔');
  }
  box.classList.toggle('has-photo', Boolean(url));
  box.replaceChildren(content, ...keep);
}

// item : { visualKey | vkey, emoji, label | fr }. Options : button (📷 visible en mode parent), cls.
export function renderVisual(item, { button = true, cls = '' } = {}) {
  const key = keyFor(item);
  const box = h('span', { class: `visual ${cls}`.trim(), dataset: { vkey: key, emoji: item.emoji || '' } });
  if (button) {
    const label = item.label || item.fr || '';
    box.append(h('span', { class: 'photo-btn', role: 'button', tabindex: '0', title: 'Mettre une photo', onclick: (e) => { e.stopPropagation(); e.preventDefault(); openPhotoPickerModal(key, label); } }, '📷'));
  }
  fill(box);
  return box;
}

function refresh(key) {
  document.querySelectorAll('.visual').forEach((box) => { if (box.dataset.vkey === key) fill(box); });
  document.dispatchEvent(new CustomEvent('visual-changed', { detail: { key } }));
}

export async function setVisual(key, blob, meta = {}) {
  await db.putVisualOverride(key, blob, meta);
  if (photos.has(key)) URL.revokeObjectURL(photos.get(key));
  photos.set(key, URL.createObjectURL(blob));
  refresh(key);
}

export async function clearVisual(key) {
  await db.deleteVisualOverride(key);
  if (photos.has(key)) URL.revokeObjectURL(photos.get(key));
  photos.delete(key);
  refresh(key);
}

// ---------- Fenêtre « Mettre une photo » : caméra, galerie, ARASAAC, retour à l'illustration ----------
export function openPhotoPickerModal(visualKey, label, onSaved) {
  let dialog = document.getElementById('photo-picker');
  if (!dialog) { dialog = h('dialog', { id: 'photo-picker' }); document.body.append(dialog); }
  const error = h('p', { class: 'hint', role: 'alert' });
  const results = h('div', { class: 'ed-picto-grid' });
  const source = [...document.querySelectorAll('.visual')].find((box) => box.dataset.vkey === visualKey);
  const preview = renderVisual({ vkey: visualKey, emoji: source ? source.dataset.emoji : '' }, { button: false, cls: 'picker-preview' });
  const save = async (blob, origin) => {
    await setVisual(visualKey, blob, { source: origin, label });
    if (onSaved) onSaved(blob);
    dialog.close();
  };
  const fileInput = (capture) => {
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true, capture });
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      try { await save(await resizePhoto(file, PHOTO_MAX_SIDE), capture ? 'camera' : 'gallery'); } catch { error.textContent = 'Cette photo ne peut pas être lue. Essayez-en une autre.'; }
    };
    return input;
  };
  const query = h('input', { value: label || '', placeholder: 'Mot à chercher' });
  const search = async () => {
    results.textContent = 'Recherche…';
    try {
      const pictos = await searchPictograms(query.value);
      results.replaceChildren(...(pictos.length ? pictos.map((p) => h('button', { type: 'button', class: 'ed-picto', onclick: async () => {
        try { await save(await downloadPictogram(p.id), 'arasaac'); } catch (e) { error.textContent = e.message; }
      } }, h('img', { src: p.url, alt: '', loading: 'lazy' }))) : ['Aucun pictogramme trouvé.']));
    } catch (e) { results.textContent = e.message; }
  };
  dialog.replaceChildren(h('div', { class: 'editor' },
    h('h2', {}, `📷 Photo${label ? ` : ${label}` : ''}`), preview,
    h('label', { class: 'btn primary' }, '📸 Prendre une photo maintenant', fileInput('environment')),
    h('label', { class: 'btn' }, '🤳 Photo du visage (caméra avant)', fileInput('user')),
    h('label', { class: 'btn' }, '🖼️ Choisir une photo dans la galerie', fileInput(false)),
    h('details', {}, h('summary', {}, '🎨 Chercher une image ARASAAC'),
      h('div', { class: 'ed-row' }, query, btn('Chercher', search, 'primary')),
      h('p', { class: 'hint-muted' }, `Seul le mot est envoyé à ARASAAC. ${ARASAAC_CREDIT}`), results),
    error,
    h('div', { class: 'ed-row end' },
      hasPhoto(visualKey) ? btn('↺ Revenir à l’image par défaut', async () => { await clearVisual(visualKey); dialog.close(); }, 'ghost') : null,
      btn('Fermer', () => dialog.close(), 'ghost'))));
  dialog.showModal();
}

// Remplit d'un coup les images sans photo avec le premier pictogramme ARASAAC trouvé (mots génériques seulement).
export async function fillWithArasaac(items, onProgress) {
  let done = 0;
  for (const item of items) {
    const key = keyFor(item);
    if (!hasPhoto(key) && !hasIllustration(key)) {
      try {
        const [first] = await searchPictograms(item.label || item.fr);
        if (first) { await setVisual(key, await downloadPictogram(first.id), { source: 'arasaac', label: item.label || item.fr }); done += 1; }
      } catch { /* mot introuvable ou hors ligne : on garde l'emoji */ }
    }
    if (onProgress) onProgress(done);
  }
  return done;
}
