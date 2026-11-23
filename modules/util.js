// Petits outils partagés par tous les modules (aucune dépendance externe).

// v9.7 : garde-fou. append / replaceChildren du navigateur écrivent « null » à l'écran
// quand on leur passe un élément absent. On ignore donc null, undefined et false partout.
(() => {
  const keep = (items) => items.filter((x) => x !== null && x !== undefined && x !== false);
  for (const proto of [Element.prototype, DocumentFragment.prototype, Document.prototype]) {
    for (const name of ['append', 'prepend', 'replaceChildren']) {
      const original = proto[name];
      if (typeof original !== 'function' || original.kalimatiSafe) continue;
      const safe = function (...items) { return original.apply(this, keep(items)); };
      safe.kalimatiSafe = true;
      proto[name] = safe;
    }
  }
  for (const name of ['before', 'after', 'replaceWith']) {
    const original = Element.prototype[name];
    if (typeof original !== 'function' || original.kalimatiSafe) continue;
    const safe = function (...items) { return original.apply(this, keep(items)); };
    safe.kalimatiSafe = true;
    Element.prototype[name] = safe;
  }
})();

// Crée un élément : h('button', { class: 'btn', onclick }, 'Texte', autreElement)
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node[key] = value;
    else if (key === 'html') node.innerHTML = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// v10.40 (Lot 2.1) : en arabe (<html dir="rtl">), « ← Précédent » et « Suivant → » pointent dans le sens
// de lecture : la flèche est retournée (les signes ‹ › « » le sont déjà par le navigateur).
export const mirrorArrows = (text) => (typeof text === 'string' && typeof document !== 'undefined' && document.documentElement && document.documentElement.dir === 'rtl'
  ? text.replace(/[←→⬅➡]/g, (c) => ({ '←': '→', '→': '←', '⬅': '➡', '➡': '⬅' })[c]) : text);
export function btn(label, onclick, cls = '') {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick }, mirrorArrows(label));
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const sample = (items, count) => shuffle(items).slice(0, count);
export const pick = (items) => items[Math.floor(Math.random() * items.length)];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const pad = (n) => String(n).padStart(2, '0');

// Jour local AAAA-MM-JJ (une "séance" = un jour).
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Semaine ISO AAAA-Wss.
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

export function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export const percent = (part, total) => (total ? Math.round((100 * part) / total) : 0);

// v10.10 : une modification locale plus récente ne doit pas être écrasée par un paquet de synchro plus ancien.
export const isNewer = (local, remote) => (Number(local?.updatedAt) || 0) > (Number(remote?.updatedAt) || 0);

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
