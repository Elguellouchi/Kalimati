// v9.9 : récompenses pour l'enfant.
// - Une barre de 5 étoiles en haut des jeux ABA (une étoile par réussite).
// - Toutes les 5 étoiles : l'enfant choisit un autocollant animé (animaux, étoiles, dinosaures, trains).
// - Le Jardin de récompenses garde tous ses autocollants, avec Nour, Mchicha et Bouma.
// Tout reste dans le téléphone (stockage local). Aucune erreur n'enlève d'étoile.
import { h, btn } from './util.js';
import { speak } from '../speech.js';
import { playClap } from '../media.js';
import { tx, themeText } from './section-i18n.js';
import { perChildKey } from './child-profiles.js';
import { WARDROBE, ITEM_BY_ID, SLOTS, cleanWardrobe, coinsLeft, buyItem, toggleWear } from './wardrobe-data.js';

const KEY = perChildKey('kalimati-rewards-v1'); // v10.36 : étoiles propres à chaque enfant
const GOAL = 5;
const EVENT = 'kalimati:stars';

export const FRIENDS = [
  { id: 'nour', name: 'Nour', src: './assets/amis/nour.svg' },
  { id: 'mchicha', name: 'Mchicha', src: './assets/amis/mchicha.svg' },
  { id: 'bouma', name: 'Bouma', src: './assets/amis/bouma.svg' },
];

// Autocollants libres (émojis du téléphone) : aucune marque, aucun personnage connu.
export const THEMES = [
  { id: 'animaux', label: 'Animaux', icon: '🐢', items: ['🐢', '🐰', '🦒', '🐘', '🐧', '🦋', '🐳', '🦔', '🐞', '🦉'] },
  { id: 'etoiles', label: 'Étoiles', icon: '⭐', items: ['⭐', '🌟', '🌙', '🌈', '☀️', '💫', '🪐', '☁️', '🌻', '❄️'] },
  { id: 'dinos', label: 'Dinosaures', icon: '🦕', items: ['🦕', '🦖', '🥚', '🌋', '🦴', '🌿', '🐊', '🦎', '🪨', '🌴'] },
  { id: 'trains', label: 'Trains', icon: '🚂', items: ['🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚝', '🚞', '🚋', '🛤️'] },
];
const MOVES = ['float', 'sway', 'breathe'];

let memory = { stars: 0, stickers: [], total: 0, wardrobe: cleanWardrobe(null) };
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      memory = { stars: Math.max(0, Math.min(GOAL, data.stars | 0)), stickers: Array.isArray(data.stickers) ? data.stickers : [], total: data.total | 0, wardrobe: cleanWardrobe(data.wardrobe) };
    }
  } catch { /* stockage indisponible : on garde la mémoire de la page */ }
  return memory;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...memory } }));
}
load();

export const rewardState = () => ({ ...load() });

// Une réussite = une étoile. Deux signaux pour la même réussite (choix + note de l'adulte) ne comptent qu'une fois.
let lastStarAt = 0;
let picking = false;
export function addStar() {
  const now = Date.now();
  if (now - lastStarAt < 1500 || picking) return false;
  lastStarAt = now;
  load();
  memory.stars = Math.min(GOAL, memory.stars + 1);
  memory.total += 1;
  save();
  if (memory.stars >= GOAL) setTimeout(openStickerPicker, 700);
  return true;
}

// Barre des 5 étoiles (en haut des jeux).
let rewardsLang = 'fr';
export function starBar(lang = 'fr') {
  rewardsLang = lang;
  const slots = Array.from({ length: GOAL }, () => h('span', { class: 'kid-star', 'aria-hidden': 'true' }, '⭐'));
  const count = h('span', { class: 'sr-only' });
  const garden = h('button', { type: 'button', class: 'garden-btn', onclick: () => openGarden(), 'aria-label': 'Mon jardin de récompenses' },
    h('span', { class: 'garden-ico' }, '🌷'), h('span', { class: 'garden-num' }, ''));
  const bar = h('div', { class: 'star-bar', role: 'status' }, h('div', { class: 'kid-stars' }, slots), count, garden);
  let shown = -1;
  const paint = () => {
    const { stars, stickers } = load();
    slots.forEach((s, i) => {
      s.classList.toggle('on', i < stars);
      if (i === stars - 1 && stars > shown && shown >= 0) { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }
    });
    shown = stars;
    count.textContent = tx('starsOfFive', lang, { n: stars, s: stars > 1 && !['dr', 'ar'].includes(lang) ? 's' : '' });
    garden.querySelector('.garden-num').textContent = String(stickers.length);
  };
  paint();
  const onChange = () => { if (bar.isConnected) paint(); else window.removeEventListener(EVENT, onChange); };
  window.addEventListener(EVENT, onChange);
  return bar;
}

const friendImg = (f, cls = 'friend') => h('img', { class: cls, src: f.src, alt: f.name, draggable: 'false' });

function overlay(content, onClose) {
  const close = () => { layer.remove(); if (onClose) onClose(); };
  const layer = h('div', { class: 'kid-overlay', onclick: (e) => { if (e.target === layer) close(); } },
    h('div', { class: 'kid-modal', role: 'dialog', 'aria-modal': 'true' }, content(close)));
  document.body.append(layer);
  const first = layer.querySelector('button');
  if (first) first.focus({ preventScroll: true });
  return close;
}

// 5 étoiles : l'enfant choisit un thème, puis son autocollant.
export function openStickerPicker() {
  if (picking || document.querySelector('.kid-overlay')) return;
  picking = true;
  const lang = rewardsLang;
  const friend = FRIENDS[load().stickers.length % FRIENDS.length];
  try { playClap(); } catch { /* pas de son */ }
  speak(`Bravo ! ${tx('pickSay', lang)}`);
  overlay((close) => {
    const body = h('div', { class: 'picker-body' });
    const themeLabel = (t) => themeText(lang, t.label);
    const themes = () => body.replaceChildren(
      h('div', { class: 'theme-grid' }, THEMES.map((t) => h('button', { type: 'button', class: 'theme-tile', onclick: () => items(t) },
        h('span', { class: 'theme-ico' }, t.icon), h('span', {}, themeLabel(t))))));
    const items = (theme) => {
      speak(themeLabel(theme));
      body.replaceChildren(
        h('div', { class: 'sticker-grid' }, theme.items.map((emoji) => h('button', { type: 'button', class: 'sticker-pick', 'aria-label': emoji, onclick: () => choose(theme, emoji) }, emoji))),
        btn('← Autres thèmes', themes, 'ghost'));
    };
    const choose = (theme, emoji) => {
      load();
      memory.stickers.push({ emoji, theme: theme.id, move: MOVES[memory.stickers.length % MOVES.length], at: Date.now() });
      memory.stars = 0;
      save();
      speak(tx('stickerGoes', lang));
      body.replaceChildren(h('div', { class: 'sticker-new' }, h('span', { class: `sticker big move-${memory.stickers.at(-1).move}` }, emoji)),
        h('p', { class: 'picker-say' }, tx('stickerGoes', lang)),
        h('div', { class: 'row center' }, btn(`🌷 ${tx('gardenSee', lang)}`, () => { close(); openGarden(); }, 'primary'), btn(`🎮 ${tx('continue', lang)}`, close, 'ghost')));
    };
    themes();
    return [h('div', { class: 'picker-head' }, friendImg(friend, 'friend hop'), h('div', {}, h('h2', {}, tx('fiveStars', lang)), h('p', { class: 'note' }, tx('friendOffer', lang, { name: friend.name })))), body];
  }, () => { picking = false; });
}

// Le jardin : tous les autocollants gagnés, avec les trois amis.
export function openGarden() {
  const lang = rewardsLang;
  const { stickers, total } = load();
  overlay((close) => [
    h('div', { class: 'garden-head' }, h('h2', {}, `🌷 ${tx('gardenTitle', lang)}`), btn(tx('close', lang), close, 'ghost')),
    h('div', { class: 'garden-friends' }, FRIENDS.map((f) => h('figure', {}, f.id === 'nour' ? dressedNour(load().wardrobe) : friendImg(f), h('figcaption', {}, f.name)))),
    h('div', { class: 'row center' }, btn(`👕 Habiller Nour (${coinsLeft(total, load().wardrobe)} ⭐)`, () => { close(); openWardrobe(); }, 'primary')),
    stickers.length
      ? h('div', { class: 'garden' }, stickers.map((s, i) => h('span', { class: `sticker move-${s.move || 'float'}`, style: { animationDelay: `${(i % 5) * 0.4}s` } }, s.emoji)))
      : h('p', { class: 'note center' }, tx('gardenEmpty', lang)),
    h('p', { class: 'note center' }, tx('gardenStats', lang, { total, s: total > 1 && !['dr', 'ar'].includes(lang) ? 's' : '' })),
  ]);
}

// v10.39 (pépite « Étoiles pour habiller le compagnon ») : Nour porte les habits choisis par l'enfant.
export function dressedNour(wardrobe, cls = 'friend') {
  const w = cleanWardrobe(wardrobe);
  return h('span', { class: 'nour-dressed' }, friendImg(FRIENDS[0], cls),
    SLOTS.filter((slot) => w.worn[slot]).map((slot) => h('span', { class: `wear wear-${slot}`, 'aria-hidden': 'true' }, ITEM_BY_ID.get(w.worn[slot]).emoji)));
}

export function openWardrobe() {
  const lang = rewardsLang;
  overlay((close) => {
    const body = h('div', { class: 'wardrobe' });
    const draw = (said = '') => {
      const { total, wardrobe } = load();
      const coins = coinsLeft(total, wardrobe);
      body.replaceChildren(
        h('div', { class: 'wardrobe-stage' }, dressedNour(wardrobe, 'friend big')),
        h('p', { class: 'wardrobe-coins', 'aria-live': 'polite' }, said || `Tu as ${coins} ⭐ à dépenser.`),
        h('div', { class: 'wardrobe-grid' }, WARDROBE.map((item) => {
          const owned = wardrobe.owned.includes(item.id);
          const worn = wardrobe.worn[item.slot] === item.id;
          const short = !owned && coins < item.price;
          return h('button', { type: 'button', class: `wardrobe-item${owned ? ' owned' : ''}${worn ? ' worn' : ''}${short ? ' short' : ''}`,
            'aria-pressed': owned ? String(worn) : null,
            'aria-label': owned ? `${item.name}${worn ? ', porté' : ''}` : `${item.name}, ${item.price} étoiles`,
            onclick: () => {
              if (owned) { memory.wardrobe = toggleWear(wardrobe, item.id); save(); speak(item.name); draw(); return; }
              const res = buyItem(wardrobe, item.id, total);
              if (!res.ok) { speak(`Encore ${item.price - coins} étoiles`); draw(`Encore ${item.price - coins} ⭐ pour ${item.name}. Continue à jouer !`); return; }
              memory.wardrobe = res.wardrobe; save();
              try { playClap(); } catch { /* pas de son */ }
              speak(`Bravo ! ${item.name}`); draw(`🎉 ${item.name} pour Nour !`);
            } },
          h('span', { class: 'wardrobe-emoji', 'aria-hidden': 'true' }, item.emoji),
          h('span', { class: 'wardrobe-price' }, owned ? (worn ? '✔ mis' : 'mettre') : `${item.price} ⭐`));
        })));
    };
    draw();
    return [h('div', { class: 'garden-head' }, h('h2', {}, '👕 Habiller Nour'), btn(tx('close', lang), close, 'ghost')),
      h('p', { class: 'note' }, 'Chaque étoile gagnée compte. Acheter un habit ne retire ni étoile du jeu ni autocollant.'), body];
  });
}
