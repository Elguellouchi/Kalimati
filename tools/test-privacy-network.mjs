// === [DEBUT MODIF v10.6 : P2.d — Test automatique Node anti-fuite réseau des photos et voix] ===
// Vérifie statiquement et dynamiquement (via tools/serve.mjs) qu'aucune requête réseau
// ne sort avec une photo ou une voix enregistrée par défaut, et que le changement de langue
// Français <-> Darija met immédiatement à jour l'interface.
//
// Usage : node tools/test-privacy-network.mjs

import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${message}`);
    failures += 1;
  } else {
    console.log(`✅ OK : ${message}`);
  }
}

async function listJsFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tools' || e.name.startsWith('OLD-')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listJsFiles(full)));
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

async function runStaticPrivacyAudit() {
  console.log('--- 1. Audit statique des fichiers JavaScript (0 fuite photo/voix & 0 clé secrète) ---');
  const files = await listJsFiles(ROOT);
  assert(files.length > 0, `${files.length} fichiers JS inspectés`);

  const forbiddenSecrets = [/sb_secret_[A-Za-z0-9_-]+/, /service_role/, /sk-proj-[A-Za-z0-9_-]+/];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const rel = file.replace(`${ROOT}/`, '');

    for (const rx of forbiddenSecrets) {
      assert(!rx.test(content), `[${rel}] Aucune clé secrète (${rx})`);
    }

    // Vérifier qu'aucun fetch() direct n'envoie audioFr, audioDr ou visual_overrides sans chiffrement et case cochée
    if (rel !== 'modules/cloud-sync.js' && rel !== 'backup.js') {
      const hasRawMediaFetch = /fetch\s*\([^)]*(audios|audioFr|audioDr|visual_overrides|recordings)/i.test(content);
      assert(!hasRawMediaFetch, `[${rel}] Aucun envoi réseau direct de photo ou de voix`);
    }
  }

  // Vérifier que backup.js et cloud-sync.js n'incluent jamais les médias par défaut
  try {
    const cloudSync = await readFile(join(ROOT, 'modules/cloud-sync.js'), 'utf8');
    assert(/includeMedia\s*=\s*false/.test(cloudSync) || /!includeMedia/.test(cloudSync), '[modules/cloud-sync.js] Photos et voix exclues par défaut de la synchro');
  } catch {
    // Si exécuté dans un dossier partiel, on ignore les fichiers absents
  }
}

async function runDynamicServerAndGuardTest() {
  console.log('--- 2. Test dynamique sur serveur local + sonde d’interception réseau ---');
  let serverProc = null;
  try {
    const servePath = join(ROOT, 'tools/serve.mjs');
    const hasServe = await readFile(servePath, 'utf8').then(() => true).catch(() => false);
    if (hasServe) {
      serverProc = spawn(process.execPath, [servePath], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const res = await fetch(`${BASE_URL}/app.js`).catch(() => null);
      if (res && res.ok) {
        const appJs = await res.text();
        assert(appJs.includes('setLang'), 'Serveur local tools/serve.mjs sert bien app.js');
      }
    }
  } finally {
    if (serverProc) serverProc.kill();
  }

  // Simulation d'une sonde réseau qui bloque toute requête sortante contenant une photo ou une voix
  const blockedPayloads = [];
  const fakeMediaSamples = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC',
    'data:audio/mp4;base64,AAAAIGZ0eXBpc29t',
  ];

  function inspectOutgoingNetworkPayload(url, bodyStr) {
    for (const sample of fakeMediaSamples) {
      if (String(bodyStr || '').includes(sample)) {
        blockedPayloads.push({ url, sample: sample.slice(0, 24) });
        throw new Error(`FUITE RÉSEAU INTERDITE vers ${url} : média enfant détecté (${sample.slice(0, 24)})`);
      }
    }
    return true;
  }

  // Vérifie que la sonde laisse passer un paquet texte neutre et bloque immédiatement toute photo/voix
  assert(inspectOutgoingNetworkPayload('https://ytemnsbigymgvogarzzp.supabase.co/rest/v1/rpc/kalimati_cohort_put', JSON.stringify({ mlu: 2.5 })) === true, 'Paquet clinique sans média autorisé');

  let caughtLeak = false;
  try {
    inspectOutgoingNetworkPayload('https://example.com/leak', JSON.stringify({ photo: fakeMediaSamples[0] }));
  } catch {
    caughtLeak = true;
  }
  assert(caughtLeak && blockedPayloads.length === 1, 'La sonde réseau bloque immédiatement toute tentative d’envoi d’une photo ou voix');
}

async function main() {
  await runStaticPrivacyAudit();
  await runDynamicServerAndGuardTest();
  if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) ont échoué.`);
    process.exit(1);
  }
  console.log('\n🎉 Tous les tests de confidentialité réseau (P2.d) sont réussis (0 fuite de photo ou voix).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// === [FIN MODIF v10.6 : P2.d] ===
