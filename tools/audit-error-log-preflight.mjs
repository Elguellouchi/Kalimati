#!/usr/bin/env node
/**
 * Porte de Pré-Vol Obligatoire (Pre-Flight Diagnostic Gate) — Kalimati v10.8
 * RÈGLE D'INGÉNIERIE : Ce script DOIT être exécuté sur le journal d'erreurs exporté
 * (`kalimati-journal-erreurs-AAAA-MM-JJ.json`) AVANT toute nouvelle amélioration.
 *
 * Il classe les incidents rencontrés sur les téléphones en priorités P0 / P1 / P2
 * et génère le bloc Markdown obligatoire « 0. Traitement du journal d'erreurs en amont »
 * à placer en tête du CHANGELOG de la version suivante.
 *
 * Usage :
 *   node tools/audit-error-log-preflight.mjs [chemin/vers/kalimati-journal-erreurs.json] [--strict]
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const strictMode = args.includes('--strict');
const fileArg = args.find((a) => !a.startsWith('--'));

function formatMarkdownGate(report, sourceLabel) {
  const t = report.totals || {};
  const blockers = Array.isArray(report.blockersToFixFirst) ? report.blockersToFixFirst : [];
  const lines = [
    '## 0. Traitement obligatoire du journal d’erreurs en amont (Pre-Flight Gate)',
    '',
    `- **Source du journal consultée :** \`${sourceLabel}\` (généré le \`${report.generatedAt || 'N/A'}\`)`,
    `- **Bilan brut :** ${t.uniqueIssues || 0} sujet(s) unique(s) · ${t.totalOccurrences || 0} occurrence(s) totale(s) `
      + `(JS: ${t.jsErrors || 0}, Quota: ${t.quotaErrors || 0}, Audio muet: ${t.silentCards || 0}, Packs/Réseau: ${t.packIssues || 0}, UX tactile: ${t.uxFrictions || 0}).`,
    '',
  ];

  if (!blockers.length) {
    lines.push('- **Statut pré-vol :** ✅ **AUCUNE ERREUR EN ATTENTE** — Feu vert pour développer les nouvelles améliorations.');
  } else {
    lines.push('### Correctifs à traiter obligatoirement en amont des nouvelles améliorations :');
    lines.push('');
    lines.push('| Priorité | Empreinte (`fp`) | Occurrences | Action corrective en amont | Statut |');
    lines.push('| :--- | :--- | :---: | :--- | :--- |');
    for (const b of blockers) {
      lines.push(`| **${b.priority}** | \`${b.fp}\` | ${b.count} | ${b.summary} | **À TRAITER EN AMONT** |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  if (!fileArg || !fs.existsSync(fileArg)) {
    const emptyReport = {
      generatedAt: new Date().toISOString().slice(0, 16) + 'Z',
      totals: { uniqueIssues: 0, totalOccurrences: 0, jsErrors: 0, quotaErrors: 0, silentCards: 0, packIssues: 0, uxFrictions: 0 },
      blockersToFixFirst: [],
    };
    console.log(formatMarkdownGate(emptyReport, fileArg || 'aucun-journal-fourni (état initial propre)'));
    return 0;
  }

  const raw = JSON.parse(fs.readFileSync(path.resolve(fileArg), 'utf8'));
  console.log(formatMarkdownGate(raw, path.basename(fileArg)));

  const p0Count = (raw.blockersToFixFirst || []).filter((b) => String(b.priority).startsWith('P0')).length;
  if (strictMode && p0Count > 0) {
    console.error(`❌ Pré-vol bloqué (--strict) : ${p0Count} erreur(s) P0 doivent être corrigées avant toute amélioration.`);
    return 2;
  }
  return 0;
}

process.exit(main());
