// v10.42 (Lot 4.1) : app.js est découpé en un chef d'orchestre + 4 modules.
// Les tests qui lisent le code de « app.js » lisent désormais l'ensemble (même code, autres fichiers).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_PARTS = ['app.js', 'modules/strip-controller.js', 'modules/views.js', 'modules/talk-tools.js', 'modules/backup-ui.js'];
export const appSource = () => APP_PARTS.map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
export const readSource = (rel) => (rel === 'app.js' ? appSource() : fs.readFileSync(path.join(ROOT, rel), 'utf8'));
