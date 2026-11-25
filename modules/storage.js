// Lot 0, L0-10 : point unique des clés localStorage, isolées sous le chemin /essai/.
(function (global) {
  'use strict';
  if (global.KalimatiStorage) return;

  const pathname = global.location && global.location.pathname || '';
  const essai = /(^|\/)essai(?:\/|$)/.test(pathname);
  const store = () => { try { return global.localStorage || null; } catch { return null; } };

  function storageKey(nom) {
    const key = String(nom);
    return essai && !key.startsWith('essai-') ? `essai-${key}` : key;
  }

  global.KalimatiStorage = Object.freeze({
    storageKey,
    isTrial() { return essai; },
    getItem(nom) {
      try { const s = store(); return s ? s.getItem(storageKey(nom)) : null; } catch { return null; }
    },
    setItem(nom, valeur) {
      try { const s = store(); if (!s) return false; s.setItem(storageKey(nom), String(valeur)); return true; } catch { return false; }
    },
  });
})(globalThis);
