export const SKIN_TONES = Object.freeze(['default', '1', '2', '3', '4', '5']);
export const SKIN_TONE_LABELS = Object.freeze({
  default: 'Jaune par défaut',
  1: 'Claire',
  2: 'Moyennement claire',
  3: 'Moyenne',
  4: 'Moyennement foncée',
  5: 'Foncée',
});

const MODIFIERS = Object.freeze({ default: '', 1: '🏻', 2: '🏼', 3: '🏽', 4: '🏾', 5: '🏿' });
let renderedSkinTone = 'default';

export function isSkinTone(value) {
  return SKIN_TONES.includes(value);
}

export function setEmojiSkinTone(value) {
  if (isSkinTone(value)) renderedSkinTone = value;
  return renderedSkinTone;
}

export function getEmojiSkinTone() {
  return renderedSkinTone;
}

export function applySkinTone(emoji, tone) {
  const text = String(emoji || '');
  const selected = isSkinTone(tone) ? tone : 'default';
  return text.replace(/(\p{Emoji_Modifier_Base})\p{Emoji_Modifier}/gu, `$1${MODIFIERS[selected]}`);
}

export function emojiForItem(item, tone = renderedSkinTone) {
  const emoji = String(item?.emoji || '');
  const person = item?.gram === 'person' || item?.lexicon?.role === 'person';
  return person ? applySkinTone(emoji, tone) : emoji;
}
