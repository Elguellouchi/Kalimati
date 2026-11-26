// Lot 1 / Tâche 3 (L1-06) : pré-chargement silencieux des voix de la page visible.
// Objectif clinique : quand l'enfant touche une carte, le son est déjà dans le téléphone.
// Rien n'est bloquant, rien n'est envoyé sur internet : on relit seulement ce que le
// Service Worker garde hors ligne (cache: 'force-cache').

export const VOICE_PRELOAD_MAX = 40;
const PRELOAD_MEMORY_MAX = 200;
const preloaded = new Set();

// Une carte peut porter une voix enregistrée (Blob, déjà dans le téléphone : rien à charger)
// ou le fichier mp3 livré avec l'appli. Seules les adresses réseau sont pré-chargées.
function voiceUrlOf(card, lang, getDefaultUrl) {
  if (!card) return null;
  const audios = card.audios && typeof card.audios === 'object' ? card.audios : null;
  const perLang = audios ? audios[lang] : null;
  const legacy = lang === 'dr' ? card.audioDr : card.audioFr;
  const direct = typeof perLang === 'string' && perLang
    ? perLang
    : (typeof legacy === 'string' && legacy ? legacy : null);
  const url = direct || (typeof getDefaultUrl === 'function' ? getDefaultUrl(card, lang) : null);
  if (typeof url !== 'string' || !url) return null;
  return /^(blob|data|javascript):/i.test(url) ? null : url;
}

function schedule(fn) {
  if (typeof window !== 'undefined' && typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: 1000 });
    return;
  }
  setTimeout(fn, 0);
}

// cards : cartes visibles de la page (40 au plus) ; lang : langue affichée.
// getDefaultUrl : facultatif, retrouve le mp3 livré pour une carte (defaultVoiceUrl de speech.js).
// Renvoie le nombre d'adresses programmées (utile aux tests).
export function preloadVisibleVoices(cards, lang, { getDefaultUrl = null } = {}) {
  const list = Array.isArray(cards) ? cards.slice(0, VOICE_PRELOAD_MAX) : [];
  if (preloaded.size > PRELOAD_MEMORY_MAX) preloaded.clear();
  const urls = [];
  for (const card of list) {
    const url = voiceUrlOf(card, lang, getDefaultUrl);
    if (!url || preloaded.has(url)) continue;
    preloaded.add(url);
    urls.push(url);
  }
  if (!urls.length) return 0;
  // Asynchrone : le rendu de la grille ne l'attend jamais.
  schedule(() => {
    for (const url of urls) {
      try {
        if (typeof fetch !== 'function') { preloaded.delete(url); continue; }
        fetch(url, { cache: 'force-cache' })
          .then((response) => { if (!response || response.ok === false) preloaded.delete(url); })
          .catch(() => { preloaded.delete(url); });
      } catch {
        preloaded.delete(url);
      }
    }
  });
  return urls.length;
}
