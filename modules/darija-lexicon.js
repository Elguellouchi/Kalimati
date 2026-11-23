// v9.1 : lexique darija ouvert (assets/darija-lexicon.json, tiré du Darija Open Dataset, CC BY-NC 4.0).
// Sert seulement à PROPOSER la darija quand le parent crée une carte : rien n'est écrit sans lui, rien ne remplace ses mots.
let words = null;

const norm = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

async function load() {
  if (words) return words;
  try {
    const response = await fetch('./assets/darija-lexicon.json');
    words = response.ok ? (await response.json()).words || [] : [];
  } catch { words = []; }
  return words;
}

// { lat, ar } proposés pour un mot français, ou null. Verbes : forme « je » (ex. « nl3b »), sans graphie arabe.
export async function suggestDarija(fr) {
  const key = norm(fr);
  if (!key) return null;
  const entry = (await load()).find((w) => norm(w.fr.replace(/\s*\(.*\)$/, '')) === key);
  if (!entry) return null;
  if (entry.cat === 'verbs') return entry.dr_je ? { lat: entry.dr_je, ar: '' } : null;
  return { lat: entry.dr_lat, ar: entry.dr_ar };
}

export async function lexiconSize() {
  return (await load()).length;
}
