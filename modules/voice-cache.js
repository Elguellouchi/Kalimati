import './storage.js';

export const voiceCachePrefix = () =>
  globalThis.KalimatiStorage.isTrial()
    ? 'kalimati-essai-amazigh-voices-'
    : 'kalimati-amazigh-voices-';
