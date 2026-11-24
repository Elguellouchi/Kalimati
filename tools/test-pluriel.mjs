// v10.45 : le jeu « Compter » écrit le pluriel (« Compte les voitures », pas « les voiture »).
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../modules/ex-online.js', import.meta.url), 'utf8');
const start = src.indexOf('const IRREGULAR_PLURAL');
const end = src.indexOf('\n}\n', src.indexOf('export function frPlural')) + 3;
const code = src.slice(start, end).replace(/export /g, '');
const frPlural = new Function(`${code}; return frPlural;`)();

const cases = { voiture: 'voitures', 'pomme de terre': 'pommes de terre', cheval: 'chevaux', bateau: 'bateaux', ananas: 'ananas', noix: 'noix', chou: 'choux', tracteur: 'tracteurs', bal: 'bals' };
for (const [one, many] of Object.entries(cases)) assert.equal(frPlural(one), many, one);
assert.match(src, /`Compte les \$\{frPlural\(thing\.fr\)\.toLowerCase\(\)\}`/);
console.log('✓ pluriel français du jeu Compter');
console.log('test-pluriel : OK');
