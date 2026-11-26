import * as db from '../db.js';
import { h } from './util.js';
import { voiceCachePrefix } from './voice-cache.js';
import { VIDEO_SETTING_KEY, videoBlobKey } from './model-videos.js';
import { SCENE_SETTING_KEY, sceneImageKey } from './scenes.js';

const MEDIA_LABELS = { video: 'Vidéo', voice: 'Voix', photo: 'Photo' };

export function isStorageNearlyFull(estimate) {
  const usage = Number(estimate?.usage);
  const quota = Number(estimate?.quota);
  return Number.isFinite(usage) && Number.isFinite(quota) && quota > 0 && usage / quota > 0.85;
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 Ko';
  if (size >= 1048576) return `${(size / 1048576).toFixed(1).replace(/\.0$/, '').replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(size / 1024))} Ko`;
}

export function biggestMedia(items, limit = 3) {
  return items
    .filter((item) => item && MEDIA_LABELS[item.kind] && Number.isFinite(item.size) && item.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, Math.max(0, limit))
    .map(({ kind, size }) => ({ kind, size }));
}

async function read(fn, fallback = []) {
  try { return await fn(); } catch { return fallback; }
}

async function cachedVoices() {
  if (typeof caches === 'undefined') return [];
  const prefix = voiceCachePrefix();
  const names = await read(() => caches.keys(), []);
  const sizes = [];
  await Promise.all(names.filter((name) => name.startsWith(prefix)).map(async (name) => {
    const cache = await read(() => caches.open(name), null);
    if (!cache) return;
    const requests = await read(() => cache.keys(), []);
    await Promise.all(requests.map(async (request) => {
      const response = await read(() => cache.match(request), null);
      if (!response) return;
      const blob = await read(() => response.blob(), null);
      if (blob?.size > 0) sizes.push(blob.size);
    }));
  }));
  return sizes;
}

export async function collectLargestMedia() {
  const [cards, recordings, visuals, lifeBook, onlineCache, modelVideos, scenes, stories] = await Promise.all([
    read(() => db.getAllCards()),
    read(() => db.getAllRecordings()),
    read(() => db.getAllVisualOverrides()),
    read(() => db.getAllLifeBook()),
    read(() => db.getAllOnlineCache()),
    read(() => db.getSetting(VIDEO_SETTING_KEY), []),
    read(() => db.getSetting(SCENE_SETTING_KEY), []),
    read(() => db.getSetting('stories'), []),
  ]);
  const videoList = Array.isArray(modelVideos) ? modelVideos : [];
  const sceneList = Array.isArray(scenes) ? scenes : [];
  const [videoBlobs, sceneBlobs, voiceSizes] = await Promise.all([
    Promise.all(videoList.filter((video) => video?.id).map((video) => read(() => db.getSetting(videoBlobKey(video.id)), null))),
    Promise.all(sceneList.filter((scene) => scene?.id).map((scene) => read(() => db.getSetting(sceneImageKey(scene.id)), null))),
    cachedVoices(),
  ]);
  const items = [];
  const add = (kind, blob) => {
    if (blob && Number.isFinite(blob.size) && blob.size > 0) items.push({ kind, size: blob.size });
  };
  for (const card of cards) {
    add('photo', card?.photo);
    add('video', card?.video);
    for (const audio of Object.values(card?.audios || {})) add('voice', audio);
    add('voice', card?.audioFr);
    add('voice', card?.audioDr);
  }
  for (const recording of recordings) add(recording?.kind === 'model' ? 'video' : 'voice', recording?.blob);
  for (const visual of visuals) add('photo', visual?.blob);
  for (const entry of lifeBook) {
    add('photo', entry?.photoBlob);
    add('voice', entry?.audioBlob);
  }
  for (const entry of onlineCache) {
    for (const picto of entry?.pictos || []) add('photo', picto);
    add('photo', entry?.photo);
  }
  for (const blob of videoBlobs) add('video', blob);
  for (const blob of sceneBlobs) add('photo', blob);
  for (const story of Array.isArray(stories) ? stories : []) {
    for (const page of story?.pages || []) add('voice', page?.audio);
  }
  for (const size of voiceSizes) items.push({ kind: 'voice', size });
  return biggestMedia(items);
}

export function storageWarningBox() {
  const list = h('ol', { id: 'storage-largest-media' });
  const box = h('section', { class: 'card-box', id: 'storage-warning', hidden: true },
    h('h3', {}, 'Espace presque plein'),
    h('p', { class: 'note' }, 'Libérez de la place avant d’ajouter des photos, voix ou vidéos.'),
    list);
  db.storageEstimate().then(async (estimate) => {
    if (!isStorageNearlyFull(estimate)) return;
    const items = await collectLargestMedia();
    list.replaceChildren(...items.map((item) => h('li', {}, `${MEDIA_LABELS[item.kind]} — ${formatBytes(item.size)}`)));
    box.hidden = false;
  }).catch(() => {});
  return box;
}
