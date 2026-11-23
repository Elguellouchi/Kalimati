#!/usr/bin/env node
// v10.25 : contrôle des thèmes « Cahier d'école », « Simple » et « Noir et blanc ».
// Usage : node tools/test-theme.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failed = 0;
const check = (ok, message) => { console.log(`${ok ? '✅' : '❌'} ${message}`); if (!ok) failed += 1; };

const html = read('index.html');
const head = html.slice(0, html.indexOf('</head>'));
check(/<script src="theme-boot\.js"><\/script>/.test(head), 'theme-boot.js est chargé dans <head> (aucun éclair de l’ancien thème)');
check(/'\.\/theme-boot\.js'/.test(read('sw.js')), 'theme-boot.js est gardé hors ligne (sw.js)');

const boot = read('theme-boot.js');
check(!/fetch|XMLHttpRequest|sendBeacon|WebSocket/.test(boot), 'theme-boot.js n’envoie rien sur internet');
check(/try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/.test(boot), 'theme-boot.js résiste à la navigation privée (try/catch)');
for (const id of ['scolaire', 'simple', 'contraste']) check(boot.includes(`'${id}'`), `theme-boot.js connaît le thème « ${id} »`);

const about = read('modules/about.js');
check(/export function applyTheme/.test(about) && /export const THEMES/.test(about), 'about.js propose le choix du thème');

const css = read('style.css');
const v25 = css.slice(css.indexOf('v10.25 — Thèmes'));
check(v25.length > 100, 'Bloc CSS v10.25 présent');
check(/:root\[data-theme="contraste"\]/.test(v25), 'Thème noir et blanc présent');
check(/:root\[data-theme="contraste"\] :focus-visible/.test(v25), 'Noir et blanc : contour de focus jaune visible');
// Charte sensorielle : aucun rouge vif, aucune animation dans les nouveaux décors.
check(!/#(F00|FF0000|E53935|D32F2F|F44336)\b/i.test(v25), 'Aucun rouge vif dans les décors v10.25');
check(!/animation\s*:/.test(v25), 'Aucune animation dans les décors v10.25');
// Le décor « cahier » ne s'applique qu'au thème scolaire : le thème simple reste sans décor.
const v22 = css.slice(css.indexOf('Habillage « SCOLAIRE »'), css.indexOf('Sens de lecture de droite à gauche (arabe)'));
const naked = v22.split('\n').filter((l) => /^[.:a-z]/i.test(l) && l.includes('{') && !l.startsWith(':root[data-theme="scolaire"]') && !l.startsWith(':root {') && !l.startsWith('@media') && !l.startsWith('  :root'));
check(naked.length === 0, `Décor cahier v10.22 limité au thème scolaire${naked.length ? ` (hors thème : ${naked.join(' | ')})` : ''}`);
// Les décors sont dessinés dans la page (data:), jamais chargés sur internet.
check(!/url\(["']?https?:/i.test(v25), 'Décors sans image chargée sur internet');

if (failed) { console.error(`\n❌ ${failed} contrôle(s) des thèmes en échec.`); process.exit(1); }
console.log('🎉 Thèmes v10.25 (cahier d’école, simple, noir et blanc) : contrôlés.');
