const LOCAL_MARKER = 'kalimati-lexique-v1-seen';
const INSTALLATION_SETTINGS = ['lang', 'cols', 'darijaScript', 'profile', 'layoutFingerprint', 'levels'];
const EMOJI_TONES = ['default', '1', '2', '3', '4', '5'];

function exists(value) {
  return value !== undefined && value !== null;
}

function hasRawChildren(rawChildren) {
  if (Array.isArray(rawChildren)) return rawChildren.length > 0;
  if (typeof rawChildren !== 'string' || !rawChildren.trim()) return false;
  try {
    const parsed = JSON.parse(rawChildren);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return true;
  }
}

export async function initLexiqueSettings({ db, localStorage: storage, rawChildren = null } = {}) {
  let onlyReviewed = false;
  let emojiSkinTone = 'default';
  try {
    const storedOnlyReviewed = await db.getSetting('onlyReviewed');
    const storedEmojiSkinTone = await db.getSetting('emojiSkinTone');
    if (EMOJI_TONES.includes(storedEmojiSkinTone)) emojiSkinTone = storedEmojiSkinTone;
    if (typeof storedOnlyReviewed === 'boolean') {
      onlyReviewed = storedOnlyReviewed;
    } else {
      let installed = exists(await db.getSetting('lexiqueV1Initialized'));
      if (!installed) {
        const cards = typeof db.getAllCards === 'function' ? await db.getAllCards() : [];
        installed = cards.length > 0;
      }
      if (!installed) installed = exists(await db.getSetting('seeded'));
      if (!installed) {
        for (const key of INSTALLATION_SETTINGS) {
          if (exists(await db.getSetting(key))) {
            installed = true;
            break;
          }
        }
      }
      if (!installed) installed = hasRawChildren(rawChildren);
      if (!installed) installed = storage.getItem(LOCAL_MARKER) !== null;
      onlyReviewed = !installed;
    }
  } catch {
    onlyReviewed = false;
  }

  try {
    await db.setSetting('lexiqueV1Initialized', true);
    storage.setItem(LOCAL_MARKER, '1');
    await db.setSetting('emojiSkinTone', emojiSkinTone);
    await db.setSetting('onlyReviewed', onlyReviewed);
  } catch {
    onlyReviewed = false;
  }
  return { onlyReviewed, emojiSkinTone };
}
