// 🛡️ Console Super-Admin Bêta (100 familles), Liens d'invitation magiques, Assistant d'accueil (Setup Wizard),
// Lien Partage Équipe (AVS / Orthophoniste) & Sauvegarde chiffrée Zero-Knowledge AES-256 (Web Crypto API).
import * as db from '../db.js';
import { h, btn, dayKey } from './util.js';
import { profile, saveProfile, clinic, saveClinic, loadContext } from './aba.js';
import { LANGS, langInfo } from './languages.js';
import { speak } from '../speech.js';
import { SELF_CARD_ID } from '../data.js';
import { setChildGender } from './morphology.js';

export const APP_VERSION = 'v10.3';
export const BASE_APP_URL = 'https://elguellouchi.github.io/Kalimati/';
// v9.11 : la clé maître d'Aziz n'est jamais écrite dans le code, seulement son empreinte SHA-256.
// La clé tapée est transformée en empreinte puis comparée. Aucun mot de passe en clair.
// Une clé changée sur un téléphone (réglage « superAdminKeyHash ») marche aussi, sur ce téléphone seulement.
const OWNER_KEY_HASH = 'cd90045ded349f3a2eebe51dcf4d1373aadf26af393d8ac1855181266724dc22';
const MIN_MASTER_KEY_LENGTH = 10;

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || '').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
const MAX_BETA_FAMILIES = 100;

// ---------- Détection anonyme de l'appareil (Météo d'usage sans donnée nominative) ----------
export function detectDeviceType() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iOS (iPhone/iPad)';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Navigateur Web';
}

// ---------- Chiffrement Zero-Knowledge AES-GCM 256 bits (Web Crypto API native) ----------
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function generateFamilyKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(12);
  crypto.getRandomValues(rand);
  const seg = (start, len) => Array.from(rand.slice(start, start + len), (b) => chars[b % chars.length]).join('');
  return `KALI-AES-${seg(0, 4)}-${seg(4, 4)}-${seg(8, 4)}`;
}

async function deriveAesKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPayload(dataObj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(dataObj));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return JSON.stringify({
    kalimatiEncrypted: true,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256-100K',
    version: APP_VERSION,
    createdAt: new Date().toISOString(),
    salt: bufToB64(salt.buffer),
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(cipherBuf),
  }, null, 2);
}

export async function decryptPayload(bundleText, passphrase) {
  const parsed = JSON.parse(bundleText);
  if (!parsed || !parsed.kalimatiEncrypted || !parsed.ciphertext) {
    throw new Error('Ce fichier n’est pas une sauvegarde chiffrée Kalimati (.kalimati.enc).');
  }
  const salt = new Uint8Array(b64ToBuf(parsed.salt));
  const iv = new Uint8Array(b64ToBuf(parsed.iv));
  const key = await deriveAesKey(passphrase, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBuf(parsed.ciphertext));
    return JSON.parse(new TextDecoder().decode(plainBuf));
  } catch {
    throw new Error('Clé de chiffrement incorrecte. Impossible de déchiffrer ce dossier.');
  }
}

// ---------- Stockage des invitations Bêta, de l'état d'activation & des retours Bêta ----------
function randomSuffix(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

// Aucune invitation ni retour de démonstration : chaque téléphone démarre vide (aucun prénom réel dans le code public).
function defaultSeedInvites() { return []; }

function defaultSeedFeedback() { return []; }

export async function getBetaInvites() {
  let list = await db.getSetting('betaInvites');
  if (!Array.isArray(list)) {
    list = defaultSeedInvites();
    await db.setSetting('betaInvites', list);
  }
  return list;
}

export async function saveBetaInvites(list) {
  await db.setSetting('betaInvites', list);
  await syncToSupabaseIfConfigured('invites', list).catch(() => {});
  return list;
}

export async function getBetaFeedback() {
  let list = await db.getSetting('betaFeedback');
  if (!Array.isArray(list)) {
    list = defaultSeedFeedback();
    await db.setSetting('betaFeedback', list);
  }
  return list;
}

export async function addBetaFeedback({ category, message, role }) {
  const list = await getBetaFeedback();
  const activeInvite = (await db.getSetting('activeInviteCode')) || 'KALI-LOCAL';
  const entry = {
    id: `fb-${Date.now()}-${randomSuffix(3)}`,
    inviteCode: activeInvite,
    role: role || clinic.intervenant || 'Parent',
    category: category || '💡 Suggestion',
    message: message.trim(),
    deviceType: detectDeviceType(),
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    resolved: false,
  };
  const next = [entry, ...list];
  await db.setSetting('betaFeedback', next);
  await syncToSupabaseIfConfigured('feedback', entry).catch(() => {});
  return entry;
}

export function buildInviteUrl(code) {
  return `${BASE_APP_URL}?invite=${encodeURIComponent(code)}`;
}

export function buildTeamUrl(teamCode) {
  return `${BASE_APP_URL}?team=${encodeURIComponent(teamCode)}`;
}

export function buildWhatsAppInviteLink(invite) {
  const url = buildInviteUrl(invite.code);
  const text = [
    `Bonjour 👋,`,
    `Voici votre lien d'invitation personnel au programme Bêta privé *Kalimati* (application vocale & ABA bilingue Français / Darija) :`,
    `👉 ${url}`,
    ``,
    `🔑 Code d'accès : *${invite.code}* (${invite.maxDevices} appareils autorisés : ex. Papa + Maman + AVS)`,
    `🔒 *Confidentialité* : les photos, les voix et les progrès de votre enfant restent sur votre téléphone. Aucun compte à créer.`,
    `Touchez simplement le lien ci-dessus pour lancer l'assistant de configuration en 1 minute !`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppTeamLink(teamCode, roleName, childName) {
  const url = buildTeamUrl(teamCode);
  const text = [
    `Bonjour 👋,`,
    `Voici le lien d'accès Équipe *Kalimati* (${roleName}) pour accompagner *${childName || 'notre enfant'}* :`,
    `👉 ${url}`,
    ``,
    `En ouvrant ce lien sur votre téléphone ou tablette, votre profil intervenant (${roleName}) sera automatiquement configuré pour les séances ABA, les routines et le cahier de liaison.`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// ---------- Connecteur optionnel Supabase Cloud (pour synchroniser les 100 invitations à distance) ----------
async function syncToSupabaseIfConfigured(kind, payload) {
  const cfg = await db.getSetting('supabaseConfig');
  if (!cfg || !cfg.url || !cfg.anonKey) return false;
  const endpoint = `${cfg.url.replace(/\/$/, '')}/rest/v1/kalimati_beta_telemetry`;
  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: kind === 'heartbeat' ? payload.code : `${kind}-${Date.now()}`,
      kind,
      payload,
      updated_at: new Date().toISOString(),
    }),
  });
  return true;
}

// ---------- Création d'une nouvelle invitation Bêta en 10 secondes ----------
export async function createBetaInvite({ label, maxDevices = 3 }) {
  const invites = await getBetaInvites();
  const nextNum = String(invites.length + 1).padStart(3, '0');
  const code = `KALI-${nextNum}-${randomSuffix(4)}`;
  const entry = {
    code,
    label: (label || `Famille Bêta #${nextNum}`).trim(),
    maxDevices: Math.max(1, Math.min(10, Number(maxDevices) || 3)),
    usedDevices: 0,
    status: 'pending',
    createdAt: Date.now(),
    activatedAt: null,
    lastSeen: null,
    appVersion: '—',
    deviceType: 'En attente d’ouverture',
    teamLinks: [],
  };
  await saveBetaInvites([entry, ...invites]);
  return entry;
}

// ---------- Activation d'un code d'invitation + Météo d'usage anonyme ----------
export async function activateInviteCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const invites = await getBetaInvites();
  const now = Date.now();
  const dev = detectDeviceType();
  let found = invites.find((i) => i.code.toUpperCase() === clean);
  if (!found) {
    found = {
      code: clean,
      label: `Invitation activée (${clean})`,
      maxDevices: 3,
      usedDevices: 1,
      status: 'active',
      createdAt: now,
      activatedAt: now,
      lastSeen: now,
      appVersion: APP_VERSION,
      deviceType: dev,
      teamLinks: [],
    };
    invites.unshift(found);
  } else {
    if (found.status === 'suspended') throw new Error('Ce lien d’invitation a été temporairement suspendu par l’administrateur.');
    found.status = 'active';
    found.activatedAt = found.activatedAt || now;
    found.lastSeen = now;
    found.appVersion = APP_VERSION;
    found.deviceType = dev;
    found.usedDevices = Math.min(found.maxDevices, Math.max(1, (found.usedDevices || 0) + 1));
  }
  await saveBetaInvites(invites);
  await db.setSetting('activeInviteCode', found.code);
  await syncToSupabaseIfConfigured('heartbeat', {
    code: found.code,
    status: 'active',
    lastSeen: now,
    appVersion: APP_VERSION,
    deviceType: dev,
  }).catch(() => {});
  return found;
}

// ---------- Vérification automatique au démarrage de l'application (?invite=... ou ?team=...) ----------
export async function checkUrlInvite({ onConfigured } = {}) {
  // Active le stockage persistant pour éviter toute purge par iOS/Android
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // Met à jour la météo d'usage anonyme si un code est déjà actif sur cet appareil
  const existingCode = await db.getSetting('activeInviteCode');
  if (existingCode) {
    const invites = await getBetaInvites();
    const row = invites.find((i) => i.code === existingCode);
    if (row) {
      row.lastSeen = Date.now();
      row.appVersion = APP_VERSION;
      row.deviceType = detectDeviceType();
      await db.setSetting('betaInvites', invites);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const inviteParam = params.get('invite');
  const teamParam = params.get('team');

  if (inviteParam) {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
    openSetupWizard({ inviteCode: inviteParam.trim().toUpperCase(), onDone: onConfigured });
    return { mode: 'invite', code: inviteParam };
  }

  if (teamParam) {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
    const code = teamParam.trim().toUpperCase();
    const roleMap = { AVS: 'AVS', ORT: 'Orthophoniste', PSY: 'Psychologue', PAR: 'Parent' };
    const matchedRoleKey = Object.keys(roleMap).find((k) => code.includes(`-${k}-`)) || 'AVS';
    const roleLabel = roleMap[matchedRoleKey];
    clinic.intervenant = { AVS: 'teacher', ORT: 'psy', PSY: 'psy', PAR: 'parents' }[matchedRoleKey] || 'teacher';
    await saveClinic();
    await db.setSetting('activeTeamCode', code);
    const parentCode = code.split('-').slice(0, 2).join('-');
    const invites = await getBetaInvites();
    const parentInvite = invites.find((i) => i.code.startsWith(parentCode));
    if (parentInvite) {
      parentInvite.usedDevices = Math.min(parentInvite.maxDevices, (parentInvite.usedDevices || 1) + 1);
      parentInvite.lastSeen = Date.now();
      parentInvite.deviceType = `${detectDeviceType()} (${roleLabel})`;
      await saveBetaInvites(invites);
    }
    showTeamWelcomeModal(roleLabel, code, onConfigured);
    return { mode: 'team', code, role: roleLabel };
  }
  return null;
}

function showTeamWelcomeModal(roleLabel, code, onDone) {
  const dialog = h('dialog', { class: 'wizard-dialog' });
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); if (onDone) onDone(); };
  dialog.append(
    h('div', { class: 'stack wizard-box' },
      h('div', { class: 'wizard-badge' }, `🤝 Lien Partage Équipe activé · ${code}`),
      h('h2', {}, `Bienvenue dans l’équipe (${roleLabel}) !`),
      h('p', {}, `Votre profil intervenant a été automatiquement réglé sur « ${roleLabel} ». Tous les essais ABA et observations que vous noterez sur cet appareil porteront automatiquement votre étiquette intervenant.`),
      h('div', { class: 'card-box soft-green' },
        h('strong', {}, '🔐 Rappel de confidentialité'),
        h('p', { class: 'note' }, 'Les données restent stockées localement sur votre appareil. Pour synchroniser le dossier complet avec les parents, utilisez le fichier de sauvegarde chiffré (.kalimati.enc) partagé par la famille.')),
      h('div', { class: 'row' }, btn('🚀 Commencer la séance', close, 'primary'))),
  );
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- Assistant de configuration (Onboarding Setup Wizard en 5 étapes) ----------
export async function openSetupWizard({ inviteCode = '', onDone } = {}) {
  const currentCode = inviteCode || (await db.getSetting('activeInviteCode')) || '';
  let familyKey = await db.getSetting('familyEncryptionKey');
  if (!familyKey) {
    familyKey = generateFamilyKey();
    await db.setSetting('familyEncryptionKey', familyKey);
  }

  const draft = {
    inviteCode: currentCode,
    consentCndp: true,
    name: (await db.getSetting('onboardingCompleted')) ? (profile.name || '') : '',
    age: (await db.getSetting('onboardingCompleted')) ? (profile.age || '') : '',
    gender: (await db.getSetting('childGender')) || 'girl',
    sister: (await db.getSetting('onboardingCompleted')) ? (profile.sister || '') : '',
    father: profile.father || 'Papa',
    mother: profile.mother || 'Maman',
    therapist: (await db.getSetting('therapistName')) || '',
    city: (await db.getSetting('onboardingCompleted')) ? (profile.city || '') : '',
    lang: (await db.getSetting('lang')) || 'fr',
    cols: (await db.getSetting('cols')) || 4,
    familyKey,
  };

  let step = 1;
  const totalSteps = 5;
  const dialog = h('dialog', { class: 'wizard-dialog' });
  const content = h('div', { class: 'stack wizard-box' });
  dialog.append(content);

  const closeWizard = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const renderStep = () => {
    const progressPct = Math.round((step / totalSteps) * 100);
    const header = h('div', { class: 'wizard-header' },
      h('div', { class: 'row spread' },
        h('span', { class: 'wizard-badge' }, `🪄 Assistant de bienvenue · Étape ${step} / ${totalSteps}`),
        btn('✕', closeWizard, 'ghost tiny')),
      h('div', { class: 'progress-bar big' }, h('span', { style: { width: `${progressPct}%` } })));

    if (step === 1) {
      const codeInput = h('input', { value: draft.inviteCode, placeholder: 'Ex. KALI-012-X9B4', maxlength: 24 });
      const consentChk = h('input', { type: 'checkbox', checked: draft.consentCndp ? 'checked' : null });
      const errNote = h('p', { class: 'note err-text' });
      content.replaceChildren(
        header,
        h('h2', {}, '👋 Bienvenue dans Kalimati Bêta !'),
        h('p', {}, 'Votre lien d’invitation a bien été détecté. Configurons ensemble l’espace sur-mesure de votre enfant en moins d’une minute.'),
        h('label', { class: 'field' }, '🎟️ Votre code d’invitation Bêta', codeInput),
        h('div', { class: 'card-box soft-green' },
          h('strong', {}, '🛡️ Vie privée'),
          h('ul', { class: 'wizard-list' },
            h('li', {}, '📱 100 % Local-First : le prénom, les vraies photos, les vidéos et la voix de votre enfant restent uniquement dans votre téléphone.'),
            h('li', {}, '🔐 Chiffrement AES-256 : vos sauvegardes sont chiffrées avec votre clé familiale privée avant tout export.'),
            h('li', {}, '📊 Rien n’est envoyé automatiquement : le code d’invitation et les retours Bêta restent aussi sur ce téléphone.'))),
        h('label', { class: 'wizard-check' }, consentChk, h('span', {}, 'J’accepte en tant que parent / représentant légal l’utilisation locale de Kalimati pour mon enfant.')),
        errNote,
        h('div', { class: 'row spread' },
          btn('Plus tard', closeWizard, 'ghost'),
          btn('Continuer ➔', () => {
            if (!consentChk.checked) { errNote.textContent = 'Merci de cocher la case de consentement parental pour continuer.'; return; }
            draft.inviteCode = codeInput.value.trim().toUpperCase() || 'KALI-BETA';
            draft.consentCndp = true;
            step = 2;
            renderStep();
          }, 'primary')),
      );
      return;
    }

    if (step === 2) {
      const nameIn = h('input', { value: draft.name, placeholder: 'Prénom de l’enfant' });
      const ageIn = h('input', { value: draft.age, placeholder: 'Ex. 8 ans' });
      const sisterIn = h('input', { value: draft.sister, placeholder: 'Prénom sœur / frère' });
      const fatherIn = h('input', { value: draft.father, placeholder: 'Ex. Papa ou prénom' });
      const motherIn = h('input', { value: draft.mother, placeholder: 'Ex. Maman' });
      const psyIn = h('input', { value: draft.therapist, placeholder: 'Ex. prénom de la psychologue ou de l’orthophoniste' });
      const cityIn = h('input', { value: draft.city, placeholder: 'Ex. Rabat, Casablanca, Paris…' });
      const genderGirl = h('button', {
        type: 'button',
        class: `pill-btn${draft.gender === 'girl' ? ' active' : ''}`,
        onclick: () => { draft.gender = 'girl'; renderStep(); },
      }, '👧 Fille');
      const genderBoy = h('button', {
        type: 'button',
        class: `pill-btn${draft.gender === 'boy' ? ' active' : ''}`,
        onclick: () => { draft.gender = 'boy'; renderStep(); },
      }, '👦 Garçon');

      content.replaceChildren(
        header,
        h('h2', {}, '👧 Prénom & Entourage de votre enfant'),
        h('p', { class: 'note' }, 'Ces prénoms personnalisent automatiquement les histoires sociales, les cartes de la famille et les bilans imprimables.'),
        h('div', { class: 'row' }, genderGirl, genderBoy),
        h('div', { class: 'wizard-grid-2' },
          h('label', { class: 'field' }, 'Prénom de l’enfant', nameIn),
          h('label', { class: 'field' }, 'Âge', ageIn),
          h('label', { class: 'field' }, 'Prénom sœur / frère', sisterIn),
          h('label', { class: 'field' }, 'Ville', cityIn),
          h('label', { class: 'field' }, 'Comment il/elle appelle Papa', fatherIn),
          h('label', { class: 'field' }, 'Comment il/elle appelle Maman', motherIn)),
        h('label', { class: 'field' }, 'Psychologue / Orthophoniste référent(e)', psyIn),
        h('div', { class: 'row spread' },
          btn('⬅ Retour', () => { step = 1; renderStep(); }, 'ghost'),
          btn('Continuer ➔', () => {
            if (!nameIn.value.trim()) { nameIn.focus(); nameIn.placeholder = 'Merci d’indiquer le prénom'; return; }
            draft.name = nameIn.value.trim();
            draft.age = ageIn.value.trim();
            draft.sister = sisterIn.value.trim();
            draft.father = fatherIn.value.trim() || 'Papa';
            draft.mother = motherIn.value.trim() || 'Maman';
            draft.therapist = psyIn.value.trim() || 'Orthophoniste';
            draft.city = cityIn.value.trim();
            step = 3;
            renderStep();
          }, 'primary')),
      );
      return;
    }

    if (step === 3) {
      content.replaceChildren(
        header,
        h('h2', {}, '🌍 Langue principale & Voix'),
        h('p', { class: 'note' }, 'Votre enfant pourra passer du Français à la Darija en 1 tap à tout moment (code-switching). Choisissez la langue d’ouverture par défaut :'),
        h('div', { class: 'lang-grid' }, LANGS.map((l) => h('button', {
          type: 'button',
          class: `lang-choice${draft.lang === l.code ? ' active' : ''}`,
          onclick: () => {
            draft.lang = l.code;
            speak(l.code === 'dr' || l.code === 'ar' ? `سلام ${draft.name}` : `Bonjour ${draft.name}`, { lang: l.code === 'dr' || l.code === 'ar' ? 'ar' : 'fr' });
            renderStep();
          },
        }, h('span', { class: 'emoji' }, l.flag), h('span', {}, l.name)))),
        h('div', { class: 'row' },
          btn(`🔊 Tester la voix pour ${draft.name}`, () => {
            speak(`Bonjour ${draft.name}, bienvenue dans Kalimati !`, { lang: 'fr' });
          }, 'ghost')),
        h('div', { class: 'row spread' },
          btn('⬅ Retour', () => { step = 2; renderStep(); }, 'ghost'),
          btn('Continuer ➔', () => { step = 4; renderStep(); }, 'primary')),
      );
      return;
    }

    if (step === 4) {
      const sizes = [
        [2, 'Très grandes cartes (2 par ligne)', 'Idéal pour débuter ou en cas de motricité fine en émergence.'],
        [3, 'Grandes cartes (3 par ligne)', 'Recommandé sur téléphone pour une lecture visuelle immédiate.'],
        [4, 'Cartes moyennes (4 par ligne)', 'Équilibre idéal pour construire des phrases riches (sujet + verbe + complément).'],
        [5, 'Petites cartes (5 par ligne)', 'Idéal sur iPad / tablette ou pour un vocabulaire étendu.'],
      ];
      content.replaceChildren(
        header,
        h('h2', {}, '📐 Taille des cartes de communication'),
        h('p', { class: 'note' }, 'Vous pourrez changer cette taille à tout moment depuis la barre Parent.'),
        h('div', { class: 'stack' }, sizes.map(([cols, title, desc]) => h('button', {
          type: 'button',
          class: `wizard-size-card${draft.cols === cols ? ' active' : ''}`,
          onclick: () => { draft.cols = cols; renderStep(); },
        }, h('strong', {}, `${draft.cols === cols ? '✅ ' : ''}${title}`), h('small', {}, desc)))),
        h('div', { class: 'row spread' },
          btn('⬅ Retour', () => { step = 3; renderStep(); }, 'ghost'),
          btn('Continuer ➔', () => { step = 5; renderStep(); }, 'primary')),
      );
      return;
    }

    if (step === 5) {
      const copyNotice = h('span', { class: 'note' });
      const downloadKeyTxt = () => {
        const txt = [
          `==========================================================`,
          `🔐 CLÉ DE CHIFFREMENT FAMILIALE KALIMATI (AES-256-GCM)`,
          `==========================================================`,
          `Enfant : ${draft.name} (${draft.city})`,
          `Code d'invitation Bêta : ${draft.inviteCode}`,
          `Clé secrète AES-256 : ${draft.familyKey}`,
          `Date de création : ${new Date().toLocaleString('fr-FR')}`,
          ``,
          `IMPORTANT : Conservez précieusement ce fichier sur votre PC ou dans vos notes.`,
          `Cette clé est indispensable pour déchiffrer vos sauvegardes (.kalimati.enc)`,
          `si vous changez de téléphone ou partagez le dossier avec l'AVS / l'orthophoniste.`,
        ].join('\n');
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `kalimati-cle-secours-${draft.name.toLowerCase()}.txt` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        copyNotice.textContent = 'Clé téléchargée ✅';
      };

      content.replaceChildren(
        header,
        h('h2', {}, '🔐 Votre Clé de Chiffrement Familiale (AES-256)'),
        h('p', {}, 'Voici la clé secrète unique générée par votre téléphone. Elle chiffre toutes vos sauvegardes pour que personne d’autre que vous ne puisse jamais lire les photos ou le suivi de votre enfant.'),
        h('div', { class: 'key-vault-box' },
          h('code', { class: 'key-code' }, draft.familyKey),
          h('div', { class: 'row wrap' },
            btn('📋 Copier la clé', async () => {
              try { await navigator.clipboard.writeText(draft.familyKey); copyNotice.textContent = 'Copiée dans le presse-papiers ✅'; } catch { copyNotice.textContent = 'Sélectionnez le code ci-dessus.'; }
            }, 'ghost tiny'),
            btn('📥 Télécharger ma clé de secours (.txt)', downloadKeyTxt, 'ghost tiny'),
            copyNotice)),
        h('div', { class: 'row spread' },
          btn('⬅ Retour', () => { step = 4; renderStep(); }, 'ghost'),
          btn('🚀 Activer Kalimati maintenant ✅', async () => {
            await saveProfile({
              name: draft.name,
              age: draft.age,
              sister: draft.sister,
              father: draft.father,
              mother: draft.mother,
              city: draft.city,
            });
            await setChildGender(draft.gender === 'boy' ? 'boy' : 'girl'); // v9.13 : le moteur de phrases suit tout de suite le genre choisi.
            await db.setSetting('therapistName', draft.therapist);
            await db.setSetting('lang', langInfo(draft.lang).code);
            await db.setSetting('cols', Number(draft.cols));
            await db.setSetting('familyEncryptionKey', draft.familyKey);
            await db.setSetting('cndpConsentAt', Date.now());
            await db.setSetting('onboardingCompleted', true);

            // Met à jour la carte "Moi" avec le prénom de l'enfant
            const cards = await db.getAllCards();
            const selfCard = cards.find((c) => c.id === SELF_CARD_ID);
            if (selfCard) {
              selfCard.fr = `${draft.name} (Moi)`;
              selfCard.sayFr = `Je m'appelle ${draft.name}`;
              selfCard.emoji = draft.gender === 'boy' ? '👦' : '👧';
              await db.putCard(selfCard);
            }

            try {
              await activateInviteCode(draft.inviteCode);
            } catch (e) {
              window.alert(e.message);
            }

            closeWizard();
            speak(`Bienvenue ${draft.name} !`, { lang: 'fr' });
            if (onDone) onDone(draft);
          }, 'primary')),
      );
    }
  };

  renderStep();
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- Sauvegarde & Restauration Chiffrée AES-256 (.kalimati.enc) ----------
async function blobToDataUrl(blob) {
  if (!blob) return null;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const mime = dataUrl.slice(5, comma).split(';')[0] || 'application/octet-stream';
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportEncryptedBackup() {
  let key = await db.getSetting('familyEncryptionKey');
  if (!key) {
    key = generateFamilyKey();
    await db.setSetting('familyEncryptionKey', key);
  }
  const pass = window.prompt(
    '🔐 Clé de chiffrement AES-256 pour protéger cette sauvegarde PC / Cloud :\n(Conservez cette clé pour pouvoir restaurer le fichier sur un autre appareil)',
    key,
  );
  if (!pass) return;

  const cards = await db.getAllCards();
  const serializedCards = await Promise.all(cards.map(async (c) => ({
    ...c,
    photo: await blobToDataUrl(c.photo),
    video: await blobToDataUrl(c.video),
    audioFr: await blobToDataUrl(c.audioFr),
    audioDr: await blobToDataUrl(c.audioDr),
  })));
  const visuals = await db.getAllVisualOverrides();
  const serializedVisuals = await Promise.all(visuals.map(async (v) => ({
    ...v,
    blob: await blobToDataUrl(v.blob),
  })));

  const bundle = {
    profile,
    clinic,
    lang: await db.getSetting('lang'),
    cols: await db.getSetting('cols'),
    levels: await db.getSetting('levels'),
    customSchedules: await db.getSetting('customSchedules'),
    scheduleTempOverrides: await db.getSetting('scheduleTempOverrides'),
    atecHistory: await db.getSetting('atecHistory'),
    activeInviteCode: await db.getSetting('activeInviteCode'),
    cards: serializedCards,
    visuals: serializedVisuals,
    trials: await db.getAllTrials(),
    abcLogs: await db.getAllAbcLogs(),
    orthoLogs: await db.getAllOrthoLogs(),
  };

  const encryptedText = await encryptPayload(bundle, pass);
  const blob = new Blob([encryptedText], { type: 'application/json;charset=utf-8' });
  const childSlug = (profile.name || 'enfant').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const link = h('a', {
    href: URL.createObjectURL(blob),
    download: `kalimati-${childSlug}-${dayKey()}.kalimati.enc`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

export async function importEncryptedBackup(file, onRestored) {
  try {
    const defaultKey = (await db.getSetting('familyEncryptionKey')) || '';
    const pass = window.prompt('🔓 Entrez la clé de chiffrement familiale AES-256 pour déchiffrer ce dossier :', defaultKey);
    if (!pass) return;
    const text = await file.text();
    const data = await decryptPayload(text, pass);
    if (!window.confirm(`Dossier déchiffré avec succès (${(data.cards || []).length} cartes, ${(data.trials || []).length} essais ABA). Restaurer maintenant sur cet appareil ?`)) return;

    if (data.profile) await saveProfile(data.profile);
    if (data.clinic) { Object.assign(clinic, data.clinic); await saveClinic(); }
    if (data.lang) await db.setSetting('lang', data.lang);
    if (data.cols) await db.setSetting('cols', data.cols);
    if (data.levels) await db.setSetting('levels', data.levels);
    if (data.customSchedules) await db.setSetting('customSchedules', data.customSchedules);
    if (data.atecHistory) await db.setSetting('atecHistory', data.atecHistory);
    await db.setSetting('familyEncryptionKey', pass.trim());

    if (Array.isArray(data.cards) && data.cards.length) {
      const cards = await Promise.all(data.cards.map(async (c) => ({
        ...c,
        photo: await dataUrlToBlob(c.photo),
        video: await dataUrlToBlob(c.video),
        audioFr: await dataUrlToBlob(c.audioFr),
        audioDr: await dataUrlToBlob(c.audioDr),
      })));
      await db.clearCards();
      await db.putCards(cards);
    }
    if (Array.isArray(data.visuals) && data.visuals.length) {
      const vis = await Promise.all(data.visuals.map(async (v) => ({
        ...v,
        blob: await dataUrlToBlob(v.blob),
      })));
      await db.putVisualOverrides(vis);
    }
    if (Array.isArray(data.trials) && data.trials.length) await db.putTrials(data.trials);
    if (Array.isArray(data.abcLogs) && data.abcLogs.length) await db.putAbcLogs(data.abcLogs);
    if (Array.isArray(data.orthoLogs) && data.orthoLogs.length) await db.putOrthoLogs(data.orthoLogs);

    await loadContext();
    window.alert('Dossier familial restauré et déchiffré avec succès ✅');
    if (onRestored) onRestored();
  } catch (err) {
    window.alert(err.message || 'Impossible de restaurer cette sauvegarde chiffrée.');
  }
}

// ---------- 4. Bonus pratique : « Lien Partage Équipe » & Sauvegarde Chiffrée (Côté Parent ⚙️ Settings) ----------
export function parentBetaSettingsBox({ onRefresh } = {}) {
  const wrap = h('section', { class: 'card-box beta-parent-box' });

  const render = async () => {
    const activeCode = (await db.getSetting('activeInviteCode')) || 'KALI-LOCAL';
    let familyKey = await db.getSetting('familyEncryptionKey');
    if (!familyKey) {
      familyKey = generateFamilyKey();
      await db.setSetting('familyEncryptionKey', familyKey);
    }
    const invites = await getBetaInvites();
    const myInvite = invites.find((i) => i.code === activeCode) || invites[0];

    const roleSelect = h('select', {},
      h('option', { value: 'AVS' }, '👩‍🏫 AVS (Auxiliaire de Vie Scolaire / Sociale)'),
      h('option', { value: 'ORT' }, '🗣️ Orthophoniste'),
      h('option', { value: 'PSY' }, '🧠 Psychologue / Superviseur ABA'),
      h('option', { value: 'PAR' }, '👨‍👩‍👧 Second Parent (Papa / Maman)'));

    const teamResultBox = h('div', { class: 'stack' });

    const generateTeamSubLink = async () => {
      const roleCode = roleSelect.value;
      const roleNames = { AVS: 'AVS', ORT: 'Orthophoniste', PSY: 'Psychologue', PAR: 'Parent' };
      const roleName = roleNames[roleCode] || 'AVS';
      const prefix = activeCode.split('-').slice(0, 2).join('-');
      const teamCode = `${prefix}-${roleCode}-${randomSuffix(4)}`;
      const url = buildTeamUrl(teamCode);
      const waHref = buildWhatsAppTeamLink(teamCode, roleName, profile.name);

      if (myInvite) {
        myInvite.teamLinks = [...(myInvite.teamLinks || []), { role: roleName, code: teamCode, createdAt: Date.now() }];
        await saveBetaInvites(invites);
      }

      const copiedMsg = h('span', { class: 'note' });
      teamResultBox.replaceChildren(
        h('div', { class: 'invite-result-card' },
          
          h('div', { class: 'stack' },
            h('strong', {}, `🤝 Sous-lien ${roleName} prêt pour ${profile.name || 'votre enfant'}`),
            h('code', { class: 'magic-url' }, url),
            h('div', { class: 'row wrap' },
              h('a', { class: 'btn primary', href: waHref, target: '_blank', rel: 'noopener' }, '📲 Envoyer sur WhatsApp'),
              btn('📋 Copier le sous-lien', async () => {
                try { await navigator.clipboard.writeText(url); copiedMsg.textContent = 'Lien copié ✅'; } catch { copiedMsg.textContent = 'Sélectionnez le lien ci-dessus.'; }
              }, 'ghost'),
              copiedMsg),
            h('p', { class: 'note' }, `Astuce : envoyez aussi la sauvegarde chiffrée (.kalimati.enc) et votre clé familiale (${familyKey}) si vous souhaitez transférer vos photos personnelles.`))),
      );
    };

    // Formulaire Retour Bêta
    const fbCat = h('select', {},
      h('option', { value: '💡 Suggestion' }, '💡 Suggestion d’amélioration'),
      h('option', { value: '🐞 Bug' }, '🐞 Signaler un bug technique'),
      h('option', { value: '🩺 Clinique' }, '🩺 Retour clinique (Orthophoniste / ABA)'));
    const fbInput = h('input', { placeholder: 'Votre retour ou suggestion pour l’équipe Kalimati…', maxlength: 280 });
    const fbSent = h('span', { class: 'note' });

    const fileInput = h('input', {
      type: 'file',
      accept: '.enc,.json,application/json',
      hidden: true,
      onchange: async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f) await importEncryptedBackup(f, onRefresh);
      },
    });

    wrap.replaceChildren(
      h('div', { class: 'row spread wrap' },
        h('h3', {}, '🤝 Partage Équipe (AVS / Orthophoniste) & Chiffrement Familial AES-256'),
        h('span', { class: 'status-pill ok' }, `🎟️ ${activeCode} · Activé ✅`)),
      h('p', { class: 'note' }, `Générez un sous-lien sécurisé rattaché au dossier de ${profile.name || 'votre enfant'} pour que l’AVS ou l’orthophoniste puisse saisir les essais ABA sur son téléphone sans que vous ayez à demander un nouveau code à l’administrateur.`),
      h('div', { class: 'row wrap' },
        roleSelect,
        btn('🤝 Inviter l’AVS / l’Orthophoniste', generateTeamSubLink, 'primary')),
      teamResultBox,
      h('hr', { class: 'soft-hr' }),
      h('div', { class: 'row wrap' },
        btn('🔐 Exporter sauvegarde chiffrée (.kalimati.enc)', exportEncryptedBackup, 'ghost'),
        h('label', { class: 'btn ghost' }, '🔓 Restaurer sauvegarde chiffrée', fileInput),
        btn('🪄 Assistant de configuration (Setup Wizard)', () => openSetupWizard({ inviteCode: activeCode, onDone: onRefresh }), 'ghost')),
      h('p', { class: 'note' }, `Clé AES-256 de ce téléphone : ${familyKey} · Stockage persistant navigateur activé.`),
      h('details', { class: 'beta-fb-details' },
        h('summary', {}, '💡 Envoyer un retour Bêta ou signaler un bug'),
        h('div', { class: 'stack' },
          h('div', { class: 'row wrap' }, fbCat, fbInput),
          h('div', { class: 'row' },
            btn('📨 Envoyer mon retour Bêta', async () => {
              if (!fbInput.value.trim()) return;
              await addBetaFeedback({ category: fbCat.value, message: fbInput.value });
              fbInput.value = '';
              fbSent.textContent = 'Merci ! Votre retour est enregistré sur ce téléphone ✅ Pour l’envoyer, partagez-le aussi par WhatsApp.';
            }, 'primary'),
            fbSent))),
    );
  };

  render();
  return wrap;
}

// ---------- Carte d'accès à la Console Super-Admin depuis Progrès PEI ----------
export function adminSummaryCard(openAdmin) {
  const card = h('section', { class: 'card-box admin-summary-card' });
  getBetaInvites().then(async (invites) => {
    const feedbacks = await getBetaFeedback();
    const activeCount = invites.filter((i) => i.status === 'active').length;
    const unreadFb = feedbacks.filter((f) => !f.resolved).length;
    card.replaceChildren(
      h('div', { class: 'row spread wrap' },
        h('div', {},
          h('h3', {}, '🛡️ Console Super-Admin · Pilotage des 100 familles Bêta'),
          h('p', { class: 'note' }, `${activeCount} / ${MAX_BETA_FAMILIES} invitations activées · ${invites.length} liens générés · ${unreadFb} retour(s) Bêta à lire · données de ce téléphone uniquement`)),
        btn('🔑 Ouvrir la Console Super-Admin', openAdmin, 'primary')),
    );
  });
  return card;
}

// ---------- Écran Complet : Console Super-Admin (Côté Aziz) ----------
export function superAdminScreen(nav) {
  const container = h('div', { class: 'screen stack' });
  let filterStatus = 'all';
  let searchQuery = '';
  let lastCreatedInvite = null;

  const checkUnlocked = async () => {
    const unlocked = sessionStorage.getItem('kalimati_super_admin_unlocked') === '1';
    if (unlocked) {
      await renderConsole();
    } else {
      await renderLogin();
    }
  };

  // Retour : le tableau de bord seulement si le mode parent est ouvert, sinon l'accueil.
  const leave = () => {
    if (document.body.classList.contains('parent')) nav.openScreen(() => import('./dashboard.js').then((m) => m.dashboardScreen(nav)));
    else window.location.href = window.location.pathname;
  };

  const renderLogin = async () => {
    const savedHash = await db.getSetting('superAdminKeyHash');
    const keyInput = h('input', {
      type: 'password',
      placeholder: 'Clé maître Super-Admin',
      value: '',
    });
    const err = h('p', { class: 'note err-text' });

    const unlock = async () => {
      const typed = await sha256Hex(keyInput.value);
      if (typed === OWNER_KEY_HASH || (savedHash && typed === savedHash)) {
        sessionStorage.setItem('kalimati_super_admin_unlocked', '1');
        renderConsole();
      } else {
        err.textContent = 'Clé maître administrateur incorrecte.';
      }
    };

    container.replaceChildren(
      h('div', { class: 'row spread' },
        h('h2', {}, '🛡️ Console Super-Admin Kalimati'),
        btn('⬅ Retour', leave, 'ghost')),
      h('section', { class: 'card-box stack' },
        h('h3', {}, '🔑 Authentification Clé Maître Administrateur (Côté Aziz)'),
        h('p', { class: 'note' }, 'Cet espace est réservé à l’administrateur de la Bêta Kalimati pour générer les liens d’invitation magiques en 1 clic et suivre la météo d’usage anonyme des 100 familles.'),
        h('label', { class: 'field' }, 'Clé Maître Super-Admin', keyInput),
        err,
        h('div', { class: 'row wrap' },
          btn('🔓 Déverrouiller la Console Super-Admin', unlock, 'primary'),
          )),
    );
  };

  const renderConsole = async () => {
    const invites = await getBetaInvites();
    const feedbacks = await getBetaFeedback();
    const activeCount = invites.filter((i) => i.status === 'active').length;
    const pendingCount = invites.filter((i) => i.status === 'pending').length;
    const suspendedCount = invites.filter((i) => i.status === 'suspended').length;
    const totalDevices = invites.reduce((acc, i) => acc + (i.usedDevices || 0), 0);
    const unreadFb = feedbacks.filter((f) => !f.resolved).length;

    // 1. Création en 10 secondes
    const labelInput = h('input', {
      placeholder: 'Ex. Famille référée #12, ou prénom du parent…',
      maxlength: 70,
    });
    const quotaSelect = h('select', {},
      h('option', { value: '3', selected: 'selected' }, '3 appareils (Papa + Maman + AVS)'),
      h('option', { value: '2' }, '2 appareils (Papa + Maman)'),
      h('option', { value: '4' }, '4 appareils (Famille + AVS + Orthophoniste)'),
      h('option', { value: '5' }, '5 appareils (Équipe complète)'),
      h('option', { value: '1' }, '1 appareil unique'));

    const handleCreateInvite = async () => {
      const created = await createBetaInvite({
        label: labelInput.value.trim() || `Famille référée #${invites.length + 1}`,
        maxDevices: Number(quotaSelect.value) || 3,
      });
      lastCreatedInvite = created;
      await renderConsole();
    };

    // Carte du lien magique fraîchement généré
    const highlightCard = lastCreatedInvite ? (() => {
      const url = buildInviteUrl(lastCreatedInvite.code);
      const waHref = buildWhatsAppInviteLink(lastCreatedInvite);
      const copyNote = h('span', { class: 'note' });
      return h('div', { class: 'invite-result-card highlight' },
        
        h('div', { class: 'stack' },
          h('div', { class: 'row spread wrap' },
            h('strong', {}, `✨ Lien magique prêt : ${lastCreatedInvite.label}`),
            h('span', { class: 'status-pill pending' }, `Code ${lastCreatedInvite.code} · ${lastCreatedInvite.maxDevices} appareils`)),
          h('code', { class: 'magic-url' }, url),
          h('div', { class: 'row wrap' },
            h('a', { class: 'btn primary', href: waHref, target: '_blank', rel: 'noopener' }, '📲 Envoyer sur WhatsApp (1 tap)'),
            btn('📋 Copier le lien magique', async () => {
              try { await navigator.clipboard.writeText(url); copyNote.textContent = 'Lien copié ✅'; } catch { copyNote.textContent = 'Sélectionnez le lien ci-dessus.'; }
            }, 'ghost'),
            btn('🪄 Tester l’ouverture du lien (Setup Wizard)', () => openSetupWizard({ inviteCode: lastCreatedInvite.code, onDone: renderConsole }), 'ghost'),
            copyNote)));
    })() : null;

    // 2. Filtrage de la liste des invitations
    const filteredInvites = invites.filter((inv) => {
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return inv.code.toLowerCase().includes(q) || (inv.label || '').toLowerCase().includes(q) || (inv.deviceType || '').toLowerCase().includes(q);
      }
      return true;
    });

    const exportInvitesCsv = () => {
      const header = ['code', 'repere_admin', 'statut', 'appareils_utilises', 'quota_appareils', 'derniere_connexion', 'version_app', 'type_appareil', 'sous_liens_equipe'];
      const rows = invites.map((i) => [
        i.code,
        `"${(i.label || '').replace(/"/g, '""')}"`,
        i.status,
        i.usedDevices || 0,
        i.maxDevices || 3,
        i.lastSeen ? new Date(i.lastSeen).toLocaleString('fr-FR') : 'Jamais',
        i.appVersion || '—',
        `"${i.deviceType || ''}"`,
        (i.teamLinks || []).map((t) => `${t.role}:${t.code}`).join(' | '),
      ].join(';'));
      const blob = new Blob([`\uFEFF${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `kalimati-invitations-beta-${dayKey()}.csv` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };

    // 3. Tableau de garantie Zero-Knowledge (Ce que vous pilotez vs Ce qui reste 100 % privé)
    const zeroKnowledgeTable = h('section', { class: 'card-box' },
      h('h3', {}, '🔐 Ce que la console voit, et ce qu’elle ne voit pas'),
      h('p', { class: 'note' }, 'Important : sans connecteur Cloud, cette console ne voit que les invitations créées sur CE téléphone. Elle ne reçoit rien des autres familles.'),
      h('div', { class: 'scatter-wrap' },
        h('table', { class: 'scatter-table zk-table' },
          h('thead', {},
            h('tr', {},
              h('th', {}, '✅ Ce que vous pouvez piloter (Console Super-Admin)'),
              h('th', {}, '🔒 Ce qui reste dans le téléphone de la famille'))),
          h('tbody', {},
            h('tr', {},
              h('td', {}, `Compteur (sur ce téléphone) : ${activeCount} / ${MAX_BETA_FAMILIES} invitations activées`),
              h('td', {}, 'Le prénom réel, les vraies photos et les vidéos de l’enfant')),
            h('tr', {},
              h('td', {}, 'Gestion des accès : créer, prolonger (+1 appareil), suspendre ou réinitialiser un lien si un parent change de téléphone'),
              h('td', {}, 'Le détail des essais ABA, du journal ABC et des bilans orthophoniques')),
            h('tr', {},
              h('td', {}, `Météo d’usage anonyme : date de dernière connexion, version de l’app (${APP_VERSION}), type d’appareil (iOS/Android)`),
              h('td', {}, 'Les enregistrements vocaux de l’enfant et des parents (Français / Darija)')),
            h('tr', {},
              h('td', {}, 'Boîte de réception des retours Bêta : bugs signalés et suggestions envoyées par les 100 familles ou leurs thérapeutes'),
              h('td', {}, 'Les notes cliniques personnelles des parents, de l’AVS et de l’orthophoniste'))))));

    // 4. Configuration optionnelle Supabase Cloud
    const supaCfg = (await db.getSetting('supabaseConfig')) || { url: '', anonKey: '' };
    const supaUrlIn = h('input', { value: supaCfg.url || '', placeholder: 'https://xxxx.supabase.co' });
    const supaKeyIn = h('input', { value: supaCfg.anonKey || '', placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' });
    const supaNote = h('span', { class: 'note' });
    const newKeyIn = h('input', { type: 'password', placeholder: 'Nouvelle clé maître (8 caractères minimum)' });
    const keyNote = h('span', { class: 'note' });

    container.replaceChildren(
      h('div', { class: 'row spread wrap' },
        h('h2', {}, '🛡️ Console Super-Admin · Bêta 100 Familles'),
        h('div', { class: 'row wrap' },
          btn('📥 Exporter CSV des invitations', exportInvitesCsv, 'ghost tiny'),
          btn('🔒 Verrouiller Console', () => { sessionStorage.removeItem('kalimati_super_admin_unlocked'); renderLogin(); }, 'ghost tiny'))),

      // Compteurs temps réel
      h('section', { class: 'card-box kpi-block' },
        h('h3', {}, `📊 Compteur Bêta sur ce téléphone (${activeCount} / ${MAX_BETA_FAMILIES})`),
        h('div', { class: 'kpis ortho-kpis' },
          h('div', { class: 'kpi' }, h('strong', {}, `${activeCount} / ${MAX_BETA_FAMILIES}`), h('span', {}, 'Invitations activées ✅')),
          h('div', { class: 'kpi' }, h('strong', {}, String(pendingCount)), h('span', {}, 'En attente d’ouverture ⏳')),
          h('div', { class: 'kpi' }, h('strong', {}, String(totalDevices)), h('span', {}, 'Appareils actifs (iOS/Android)')),
          h('div', { class: 'kpi' }, h('strong', {}, `${unreadFb} / ${feedbacks.length}`), h('span', {}, 'Retours Bêta non lus 💡'))),
        h('div', { class: 'progress-bar big' }, h('span', { style: { width: `${Math.min(100, Math.round((activeCount / MAX_BETA_FAMILIES) * 100))}%` } }))),

      // Création d'invitation en 10 secondes
      h('section', { class: 'card-box stack' },
        h('h3', {}, '➕ Nouvelle invitation Bêta (Création en 10 secondes)'),
        h('div', { class: 'wizard-grid-2' },
          h('label', { class: 'field' }, 'Repère pour vous (ex. « Famille référée #12 »)', labelInput),
          h('label', { class: 'field' }, 'Quota d’appareils autorisés', quotaSelect)),
        h('div', { class: 'row wrap' },
          btn('➕ Générer le lien d’invitation magique', handleCreateInvite, 'primary')),
        highlightCard),

      // Gestion des accès & Météo d'usage anonyme
      h('section', { class: 'card-box stack' },
        h('div', { class: 'row spread wrap' },
          h('h3', {}, `🎟️ Gestion des accès & Météo d’usage anonyme (${filteredInvites.length})`),
          h('div', { class: 'row wrap' },
            ...[
              ['all', `Toutes (${invites.length})`],
              ['active', `Activées ✅ (${activeCount})`],
              ['pending', `En attente ⏳ (${pendingCount})`],
              ['suspended', `Suspendues ⛔ (${suspendedCount})`],
            ].map(([st, lbl]) => h('button', {
              type: 'button',
              class: `pill-btn${filterStatus === st ? ' active' : ''}`,
              onclick: () => { filterStatus = st; renderConsole(); },
            }, lbl)))),
        h('input', {
          placeholder: '🔍 Rechercher un code (ex. KALI-012) ou un repère (ex. #12)…',
          value: searchQuery,
          oninput: (e) => { searchQuery = e.target.value; renderConsole(); },
        }),
        h('div', { class: 'stack' }, filteredInvites.map((inv) => {
          const url = buildInviteUrl(inv.code);
          const waHref = buildWhatsAppInviteLink(inv);
          const qrHolder = h('div', { hidden: true });
          const statusBadge = inv.status === 'active'
            ? h('span', { class: 'status-pill ok' }, 'Activé ✅')
            : inv.status === 'suspended'
              ? h('span', { class: 'status-pill low' }, 'Suspendu ⛔')
              : h('span', { class: 'status-pill pending' }, 'En attente ⏳');

          const lastSeenText = inv.lastSeen
            ? new Date(inv.lastSeen).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Jamais connecté';

          return h('div', { class: 'admin-invite-row stack' },
            h('div', { class: 'row spread wrap' },
              h('div', {},
                h('strong', {}, `${inv.code} — ${inv.label}`),
                h('p', { class: 'note' }, `📱 Appareils : ${inv.usedDevices || 0} / ${inv.maxDevices} · 🌤️ Dernière connexion : ${lastSeenText} · Version : ${inv.appVersion || '—'} · Appareil : ${inv.deviceType || '—'}`),
                (inv.teamLinks && inv.teamLinks.length)
                  ? h('p', { class: 'note' }, `🤝 Sous-liens équipe générés par le parent : ${inv.teamLinks.map((t) => `${t.role} (${t.code})`).join(', ')}`)
                  : null),
              statusBadge),
            h('div', { class: 'row wrap' },
              h('a', { class: 'btn primary tiny', href: waHref, target: '_blank', rel: 'noopener' }, '📲 WhatsApp'),
              btn('📋 Copier lien', async (e) => {
                try { await navigator.clipboard.writeText(url); e.target.textContent = 'Copié ✅'; } catch {}
              }, 'ghost tiny'),
              btn('➕ +1 appareil', async () => {
                inv.maxDevices = (inv.maxDevices || 3) + 1;
                await saveBetaInvites(invites);
                await renderConsole();
              }, 'ghost tiny'),
              btn('🔄 Réinitialiser téléphone', async () => {
                inv.usedDevices = 0;
                inv.deviceType = 'Réinitialisé (prêt pour nouveau téléphone)';
                await saveBetaInvites(invites);
                await renderConsole();
              }, 'ghost tiny'),
              btn(inv.status === 'suspended' ? '▶️ Réactiver' : '⛔ Suspendre', async () => {
                inv.status = inv.status === 'suspended' ? (inv.activatedAt ? 'active' : 'pending') : 'suspended';
                await saveBetaInvites(invites);
                await renderConsole();
              }, 'ghost tiny'),
              btn('🗑️', async () => {
                if (!window.confirm(`Supprimer l’invitation ${inv.code} (${inv.label}) ?`)) return;
                await saveBetaInvites(invites.filter((x) => x.code !== inv.code));
                await renderConsole();
              }, 'ghost tiny')),
            qrHolder);
        }))),

      // Boîte de réception des retours Bêta
      h('section', { class: 'card-box stack' },
        h('h3', {}, `📬 Boîte de réception des retours Bêta (${feedbacks.length})`),
        feedbacks.length === 0
          ? h('p', { class: 'note' }, 'Aucun retour ou bug signalé pour le moment.')
          : feedbacks.map((fb) => h('div', { class: 'admin-invite-row row spread wrap' },
            h('div', {},
              h('strong', {}, `${fb.category} · Code ${fb.inviteCode} (${fb.role})`),
              h('p', {}, fb.message),
              h('small', { class: 'note' }, `${new Date(fb.createdAt).toLocaleString('fr-FR')} · ${fb.deviceType} · ${fb.appVersion}`)),
            btn(fb.resolved ? '✅ Traité' : 'Marquer traité', async () => {
              fb.resolved = !fb.resolved;
              await db.setSetting('betaFeedback', feedbacks);
              await renderConsole();
            }, fb.resolved ? 'ghost tiny' : 'primary tiny')))),

      // Tableau Zero-Knowledge
      zeroKnowledgeTable,

      // Connecteur Cloud Supabase optionnel
      h('details', { class: 'card-box' },
        h('summary', {}, '☁️ Synchronisation Cloud Supabase (Optionnel · Mode multi-appareils à distance)'),
        h('div', { class: 'stack' },
          h('p', { class: 'note' }, 'Désactivé par défaut : rien ne quitte le téléphone. Si vous remplissez ces champs, le code d’invitation, le type d’appareil et les retours Bêta écrits sur CE téléphone seront envoyés à votre projet Supabase (jamais les photos, voix ou données de l’enfant). Laissez vide si vous n’êtes pas sûr.'),
          h('label', { class: 'field' }, 'Supabase Project URL', supaUrlIn),
          h('label', { class: 'field' }, 'Supabase Anon Public Key', supaKeyIn),
          h('div', { class: 'row wrap' },
            btn('💾 Enregistrer le connecteur Supabase', async () => {
              await db.setSetting('supabaseConfig', { url: supaUrlIn.value.trim(), anonKey: supaKeyIn.value.trim() });
              supaNote.textContent = 'Connecteur Supabase enregistré ✅';
            }, 'primary'),
            supaNote),
          h('hr', { class: 'soft-hr' }),
          h('label', { class: 'field' }, '🔐 Changer la clé maître de ce téléphone', newKeyIn),
          h('div', { class: 'row wrap' },
            btn('Enregistrer la nouvelle clé', async () => {
              if (newKeyIn.value.trim().length < MIN_MASTER_KEY_LENGTH) { keyNote.textContent = `Au moins ${MIN_MASTER_KEY_LENGTH} caractères.`; return; }
              await db.setSetting('superAdminKeyHash', await sha256Hex(newKeyIn.value));
              newKeyIn.value = '';
              keyNote.textContent = 'Nouvelle clé enregistrée sur ce téléphone ✅ L’ancienne ne marche plus ici.';
            }, 'primary'),
            keyNote))),
    );
  };

  checkUnlocked();
  return container;
}
