#!/usr/bin/env node
/**
 * Non-régression de la sauvegarde chiffrée (v10.11) :
 * - une sauvegarde normale reste lisible sans mot de passe ;
 * - un fichier chiffré ne contient ni le mot de passe ni les textes de l'enfant en clair ;
 * - la restauration exige le mot de passe et refuse un mauvais mot de passe ;
 * - les anciennes sauvegardes en clair restent acceptées.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildBackupFile, readBackup, encryptBackupFile, BACKUP_PASSWORD_MIN } = await import(
  pathToFileURL(path.join(ROOT, 'backup.js')).href
);

const card = { id: 'c1', fr: 'Bonjour', cat: 'base', sub: '', dr: '', ar: '', emoji: '👋', order: 1, gram: 'social' };
const file = await buildBackupFile({ cards: [card], settings: { lang: 'fr' } });
const plainText = await file.text();
assert.match(plainText, /kalimati-backup-v4/, 'format normal conservé');
assert.match(plainText, /Bonjour/, 'fichier en clair comme avant');

const password = 'mot-de-passe-famille-2026';
assert.ok(password.length >= BACKUP_PASSWORD_MIN, 'mot de passe de test assez long');
const encrypted = await encryptBackupFile(file, password);
const encryptedText = await encrypted.text();
assert.match(encryptedText, /kalimati-backup-encrypted-v1/, 'conteneur chiffré identifié');
assert.match(encryptedText, /"iterations":310000/, 'PBKDF2 310 000 tours');
assert.doesNotMatch(encryptedText, /Bonjour/, 'aucun texte de l’enfant en clair');
assert.doesNotMatch(encryptedText, new RegExp(password), 'aucun mot de passe en clair');
assert.match(encrypted.name, /-chiffree\.json$/, 'nom de fichier explicite');

let missingPassword = null;
try { await readBackup(encrypted); } catch (error) { missingPassword = error; }
assert.equal(missingPassword?.needsPassphrase, true, 'la restauration réclame le mot de passe');

const restored = await readBackup(encrypted, password);
assert.equal(restored.cards[0].fr, 'Bonjour', 'carte restaurée après déchiffrement');
assert.equal(restored.settings.lang, 'fr', 'réglages restaurés après déchiffrement');

await assert.rejects(() => readBackup(encrypted, 'mauvais-mot-de-passe'), /Mot de passe incorrect/, 'mauvais mot de passe refusé');
await assert.rejects(() => encryptBackupFile(file, 'court'), /au moins/, 'mot de passe trop court refusé');

const legacy = await readBackup(new File([plainText], 'ancienne.json', { type: 'application/json' }));
assert.equal(legacy.cards[0].fr, 'Bonjour', 'ancienne sauvegarde en clair toujours lisible');

console.log('✅ Sauvegarde chiffrée : PBKDF2 310 000, mauvais mot de passe refusé, anciennes sauvegardes lisibles.');
