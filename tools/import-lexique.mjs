import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, defaultCards } from '../data.js';
import { importLexique, parseCsv, renderLexiqueModule } from '../modules/lexique-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaults = {
  source: resolve(root, 'lexique/lexique-v1.csv'),
  categories: resolve(root, 'lexique/categories.csv'),
  output: resolve(root, 'modules/lexique-data.js'),
  'missing-output': resolve(root, 'lexique/voix-manquantes.csv'),
};
const optionNames = new Set([...Object.keys(defaults), 'forbidden']);

function parseArgs(args) {
  const options = { ...defaults };
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (!argument.startsWith('--')) throw new Error('argument_invalide');
    const name = argument.slice(2);
    const value = args[i + 1];
    if (!optionNames.has(name) || !value || value.startsWith('--')) throw new Error('argument_invalide');
    options[name] = resolve(value);
    i += 1;
  }
  return options;
}

async function readUtf8(path, reason) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Error(reason);
  }
}

async function readIfExists(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function restore(io, path, content) {
  if (content === null) await io.removeIfExists(path);
  else await io.write(path, content);
}

export async function writeOutputsAtomically({ outputPath, missingOutputPath, moduleText, missingCsv, io }) {
  const previous = await Promise.all([io.readIfExists(outputPath), io.readIfExists(missingOutputPath)]);
  const tempOutput = `${outputPath}.tmp-${process.pid}`;
  const tempMissing = `${missingOutputPath}.tmp-${process.pid}`;
  let replacing = false;
  try {
    await io.write(tempOutput, moduleText);
    await io.write(tempMissing, missingCsv);
    replacing = true;
    await io.rename(tempOutput, outputPath);
    await io.rename(tempMissing, missingOutputPath);
  } catch (error) {
    if (replacing) {
      await restore(io, outputPath, previous[0]);
      await restore(io, missingOutputPath, previous[1]);
    }
    throw error;
  } finally {
    await io.removeIfExists(tempOutput);
    await io.removeIfExists(tempMissing);
  }
}

function forbiddenNames(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

async function listVoiceFiles(voiceIndex) {
  const files = new Set();
  for (const language of Object.keys(voiceIndex)) {
    let entries;
    try {
      entries = await readdir(resolve(root, 'voix', language), { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isFile() && /\.mp3$/i.test(entry.name)) files.add(`${language}/${entry.name}`);
    }
  }
  return files;
}

function printErrors(errors) {
  for (const error of errors) {
    const field = error.field ? `, champ ${error.field}` : '';
    console.error(`ligne ${error.line}, colonne ${error.column}${field} : ${error.reason}`);
  }
}

export async function runImport(args) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('node tools/import-lexique.mjs [--source CSV] [--categories CSV] [--forbidden TXT] [--output JS] [--missing-output CSV]');
    return 0;
  }
  const [categoriesText, syntheticText, sourceText, voiceText] = await Promise.all([
    readUtf8(options.categories, 'lecture_categories_impossible'),
    readUtf8(resolve(root, 'tools/prenoms-interdits.txt'), 'lecture_liste_synthetique_impossible'),
    readUtf8(options.source, 'lecture_source_impossible'),
    readUtf8(resolve(root, 'voix/index.json'), 'lecture_index_vocal_impossible'),
  ]);
  const sourceRows = parseCsv(sourceText).rows.length;
  if (sourceRows && !options.forbidden) {
    console.error('liste_interdite_obligatoire');
    return 1;
  }
  const names = forbiddenNames(syntheticText);
  if (options.forbidden) names.push(...forbiddenNames(await readUtf8(options.forbidden, 'lecture_liste_interdite_impossible')));
  let voiceIndex;
  try {
    voiceIndex = JSON.parse(voiceText);
  } catch {
    console.error('index_vocal_invalide');
    return 1;
  }
  const voiceFiles = await listVoiceFiles(voiceIndex);
  const result = importLexique({
    sourceText,
    categoriesText,
    forbiddenNames: names,
    baseCategories: CATEGORIES,
    defaultCards: defaultCards(),
    voiceIndex,
    voiceFiles,
  });
  if (result.errors.length) {
    printErrors(result.errors);
    return 1;
  }
  const io = {
    readIfExists,
    write: (path, content) => writeFile(path, content, 'utf8'),
    rename,
    removeIfExists: (path) => rm(path, { force: true }),
  };
  await writeOutputsAtomically({
    outputPath: options.output,
    missingOutputPath: options['missing-output'],
    moduleText: renderLexiqueModule(result.data),
    missingCsv: result.missingCsv,
    io,
  });
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runImport(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error?.message || 'import_impossible');
    process.exitCode = 1;
  });
}
