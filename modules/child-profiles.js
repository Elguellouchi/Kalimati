// v10.36 (pépite « Profils multiples sans abonnement », Otsimo) : plusieurs enfants sur le même téléphone.
// Chaque enfant a sa propre mémoire (sa propre base IndexedDB) : cartes, photos, voix, essais, réglages,
// sauvegarde et synchro. Rien n'est mélangé. Le premier enfant garde la base d'origine (« kalimati »),
// donc les données déjà présentes ne bougent pas. Les autres : « kalimati-child-<id> ».
// La liste (prénom + petit dessin) reste dans ce téléphone ; aucun prénom n'est écrit dans le code.

export const MAIN_ID = 'main';
const ACTIVE_KEY = 'kalimati-active-child';
const LIST_KEY = 'kalimati-children';
const PREFIX = 'kalimati-child-';

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export const dbNameFor = (id) => (!id || id === MAIN_ID ? 'kalimati' : `${PREFIX}${id}`);
export const isValidChildId = (id) => id === MAIN_ID || /^c[a-z0-9]{4,16}$/.test(String(id || ''));

export function cleanChildren(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const c of list) {
    if (!c || typeof c !== 'object' || !isValidChildId(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: String(c.name || '').trim().slice(0, 30), emoji: String(c.emoji || '🙂').slice(0, 8) });
  }
  if (!seen.has(MAIN_ID)) out.unshift({ id: MAIN_ID, name: '', emoji: '🙂' });
  return out.slice(0, 8);
}

export function listChildren() {
  const s = store();
  try { return cleanChildren(JSON.parse((s && s.getItem(LIST_KEY)) || '[]')); } catch { return cleanChildren([]); }
}
function saveChildren(list) {
  const s = store();
  try { if (s) s.setItem(LIST_KEY, JSON.stringify(cleanChildren(list))); } catch { /* navigation privée */ }
}

export function activeChildId() {
  const s = store();
  let id = MAIN_ID;
  try { id = (s && s.getItem(ACTIVE_KEY)) || MAIN_ID; } catch { id = MAIN_ID; }
  if (!isValidChildId(id)) return MAIN_ID;
  return listChildren().some((c) => c.id === id) ? id : MAIN_ID;
}
export const activeDbName = () => dbNameFor(activeChildId());

export function setActiveChild(id) {
  const s = store();
  if (!isValidChildId(id)) return false;
  try { if (s) s.setItem(ACTIVE_KEY, id); return true; } catch { return false; }
}

export function addChild(name, emoji = '🙂', now = Date.now()) {
  const id = `c${now.toString(36)}`;
  const list = listChildren();
  if (list.length >= 8) return null;
  saveChildren([...list, { id, name, emoji }]);
  return id;
}

export function renameChild(id, name, emoji) {
  saveChildren(listChildren().map((c) => (c.id === id ? { ...c, name, emoji: emoji || c.emoji } : c)));
}

// Effacer un enfant (jamais le premier, jamais celui qui est ouvert) : sa base entière est supprimée.
export function removeChild(id) {
  if (id === MAIN_ID || id === activeChildId()) return Promise.resolve(false);
  saveChildren(listChildren().filter((c) => c.id !== id));
  // v10.42 (Lot 4.3) : ses voix enregistrées (armoires « …:<enfant> ») partent avec lui.
  try {
    if (globalThis.caches) caches.keys().then((names) => names.filter((n) => n.endsWith(`:${id}`)).forEach((n) => caches.delete(n))).catch(() => {});
  } catch { /* pas d'armoire à voix */ }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(dbNameFor(id));
      req.onsuccess = () => resolve(true); req.onerror = () => resolve(false); req.onblocked = () => resolve(false);
    } catch { resolve(false); }
  });
}

// Si la liste a été effacée par le navigateur, on retrouve les bases des autres enfants.
export async function recoverChildren() {
  try {
    if (!globalThis.indexedDB || typeof indexedDB.databases !== 'function') return listChildren();
    const names = (await indexedDB.databases()).map((d) => d.name).filter((n) => n && n.startsWith(PREFIX));
    const list = listChildren();
    let changed = false;
    names.forEach((n, i) => {
      const id = n.slice(PREFIX.length);
      if (isValidChildId(id) && !list.some((c) => c.id === id)) { list.push({ id, name: `Enfant ${list.length + 1 + i}`, emoji: '🙂' }); changed = true; }
    });
    if (changed) saveChildren(list);
    return listChildren();
  } catch { return listChildren(); }
}

// Mémoire des étoiles (localStorage) : une clé par enfant, la clé d'origine pour le premier.
export const perChildKey = (key) => (activeChildId() === MAIN_ID ? key : `${key}:${activeChildId()}`);
