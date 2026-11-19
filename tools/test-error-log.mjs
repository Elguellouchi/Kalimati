#!/usr/bin/env node
/**
 * Suite de tests automatisés — Journal d'erreurs & Diagnostic (v10.8)
 * Vérifie :
 *  1. Anonymisation stricte : aucun prénom, aucune clé #key=, aucune URL blob:/data:, aucune carte personnelle.
 *  2. Déduplication par empreinte (fp) et respect du plafond circulaire de 150 entrées.
 *  3. Génération du rapport de pré-vol obligatoire (buildPreImprovementReport) avec classement P0 / P1 / P2.
 *  4. Non-régression de l'outil CLI tools/audit-error-log-preflight.mjs.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.env.KALIMATI_LOG_TEST_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Node n'a pas de page : on fournit le minimum attendu par modules/util.js (garde-fou des éléments).
for (const name of ['Element', 'DocumentFragment', 'Document']) if (!globalThis[name]) globalThis[name] = class {};

async function main() {
  const {
    LOG_TYPES,
    MAX_LOG_ENTRIES,
    sanitizeCardId,
    sanitizeText,
    sanitizeLogEntry,
    logDiagnostic,
    clearErrorLog,
    getErrorLogSnapshot,
    recordRejectedTap,
    buildPreImprovementReport,
    setDiagnosticContextProvider,
  } = await import(path.join(ROOT, 'modules/error-log.js'));

  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  };

  await clearErrorLog();
  setDiagnosticContextProvider(() => ({ v: '10.8', lang: 'tzm', space: 'talk', online: false }));

  check('Masquage des cartes personnelles et conservation des cartes catalogue', () => {
    assert.equal(sanitizeCardId('c-personnes-moi'), 'card:personal');
    assert.equal(sanitizeCardId('c-personnes-ghita'), 'card:personal');
    assert.equal(sanitizeCardId('c-personnes-hosna'), 'card:personal');
    assert.equal(sanitizeCardId('ma-carte-privee-123'), 'card:custom');
    assert.equal(sanitizeCardId('c-rural-tala'), 'c-rural-tala');
    assert.equal(sanitizeCardId('c-manger-pain'), 'c-manger-pain');
  });

  check('Purge des prénoms, clés #key=, ?token= et URLs blob:/data:', () => {
    const dirty = 'Erreur pour Abir et Ghita avec Hosna sur https://elguellouchi.github.io/Kalimati/#key=maCleSecrete123456 et ?token=abc et blob:https://site/123-456';
    const clean = sanitizeText(dirty, ['Youssef']);
    assert.equal(/abir|ghita|hosna|maCleSecrete123456|token=abc|blob:https/i.test(clean), false, `Fuite détectée : ${clean}`);
    assert.match(clean, /#key=\[REDACTED\]/);
    assert.match(clean, /blob:\[REDACTED\]/);
  });

  check('Déduplication par empreinte (count++) sur carte muette répétée', () => {
    for (let i = 0; i < 7; i += 1) {
      logDiagnostic(LOG_TYPES.AUDIO_SILENT, 'missing_voice_recording', { cardId: 'c-actions-boire' });
    }
    const snap = getErrorLogSnapshot();
    assert.equal(snap.length, 1);
    assert.equal(snap[0].count, 7);
    assert.equal(snap[0].cardId, 'c-actions-boire');
    assert.equal(snap[0].ctx.lang, 'tzm');
  });

  check('Détection de rafale anti-rebond (>= 4 rejets en 2 s -> 1 entrée UX_FRICTION)', () => {
    for (let i = 0; i < 5; i += 1) {
      recordRejectedTap({ cardId: 'c-manger-pain', space: 'talk' });
    }
    const snap = getErrorLogSnapshot();
    const ux = snap.find((x) => x.type === LOG_TYPES.UX_FRICTION);
    assert.ok(ux, 'Entrée UX_FRICTION attendue');
    assert.equal(ux.count, 1);
  });

  check('Plafond strict du tampon circulaire à 150 entrées', async () => {
    await clearErrorLog();
    for (let i = 0; i < 190; i += 1) {
      logDiagnostic(LOG_TYPES.SYNC_PACK, `timeout_item_${i}`, { packId: 'vie-au-village' });
    }
    const snap = getErrorLogSnapshot();
    assert.equal(snap.length, MAX_LOG_ENTRIES);
    assert.equal(snap[0].detail, 'timeout_item_40');
    assert.equal(snap[snap.length - 1].detail, 'timeout_item_189');
  });

  check('Rapport de pré-vol obligatoire (buildPreImprovementReport) & CLI preflight', async () => {
    await clearErrorLog();
    logDiagnostic(LOG_TYPES.JS_RUNTIME, 'TypeError: null element', { module: 'dashboard.js:142' });
    for (let i = 0; i < 12; i += 1) {
      logDiagnostic(LOG_TYPES.AUDIO_SILENT, 'missing_voice_recording', { cardId: 'c-actions-boire' });
    }
    const report = buildPreImprovementReport();
    assert.equal(report.totals.jsErrors, 1);
    assert.equal(report.totals.silentCards, 1);
    assert.equal(report.blockersToFixFirst[0].priority, 'P0-CRASH');
    assert.equal(report.blockersToFixFirst[1].priority, 'P1-AUDIO');

    const tmpJson = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kalimati-journal-')), 'sample-journal.json');
    fs.writeFileSync(tmpJson, JSON.stringify(report, null, 2));
    const cliOut = execFileSync('node', [path.join(ROOT, 'tools/audit-error-log-preflight.mjs'), tmpJson], { encoding: 'utf8' });
    assert.match(cliOut, /0\. Traitement obligatoire du journal d’erreurs en amont/);
    assert.match(cliOut, /P0-CRASH/);
    assert.match(cliOut, /P1-AUDIO/);
  });

  console.log(`\n🎉 Tous les tests du journal d'erreurs ont réussi (${passed}/${passed}).`);
}

main().catch((err) => {
  console.error('❌ Échec test error-log :', err);
  process.exit(1);
});
