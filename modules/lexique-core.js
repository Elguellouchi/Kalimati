import { CATEGORIES, defaultCards } from '../data.js';

const REQUIRED_COLUMNS = 'wordId;niveau;palier;categorie;role;emoji;fr;dr_lat;dr_ar;pos_2;pos_3;pos_4;pos_5;relecteur_fr;relecteur_dr;date_relecture'.split(';');
const OPTIONAL_COLUMNS = ['ar', 'note', 'fonction'];
const COLUMNS = [...REQUIRED_COLUMNS.slice(0, 9), 'ar', ...REQUIRED_COLUMNS.slice(9), 'note', 'fonction'];
const CATEGORY_COLUMNS = ['id', 'fr', 'dr', 'ar', 'emoji', 'color'];
const LEVELS = ['noyau', 'frange'];
const ROLES = ['person', 'verb', 'noun', 'adj', 'social'];
const FUNCTIONS = ['', 'demande', 'commentaire', 'refus', 'social', 'question'];
const TEXT_FIELDS = ['fr', 'dr_lat', 'dr_ar', 'ar'];
const CUSTOM_FIELDS = ['fr', 'dr', 'ar', 'emoji', 'gram', 'cat', 'sub', 'sayFr', 'sayAr'];

function failure(line, field, reason, column = 1) {
  return { line, column, field, reason };
}

export function parseCsv(text, expectedHeader) {
  const source = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const errors = [];
  const rows = [];
  let cells = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let rowHasContent = false;
  let rowLine = 1;
  let line = 1;
  let i = 0;

  const finishRow = () => {
    if (!rowHasContent) return;
    cells.push(field);
    rows.push({ line: rowLine, column: 1, cells });
    cells = [];
    field = '';
    rowHasContent = false;
    afterQuote = false;
  };

  while (i < source.length) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        afterQuote = true;
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
      i += 1;
      continue;
    }
    if (char === '"' && !field) {
      quoted = true;
      if (!rowHasContent) rowLine = line;
      rowHasContent = true;
    } else if (char === ';') {
      cells.push(field);
      field = '';
      afterQuote = false;
      if (!rowHasContent) rowLine = line;
      rowHasContent = true;
    } else if (char === '\n') {
      finishRow();
      line += 1;
      if (!rowHasContent) rowLine = line;
    } else if (afterQuote) {
      if (!/\s/.test(char)) errors.push(failure(line, '', 'caractere_apres_guillemet'));
      else field += char;
    } else {
      field += char;
      if (!/\s/.test(char)) {
        if (!rowHasContent) rowLine = line;
        rowHasContent = true;
      }
    }
    i += 1;
  }
  if (quoted) errors.push(failure(line, '', 'guillemet_non_ferme'));
  else finishRow();

  const header = rows.shift()?.cells ?? [];
  if (expectedHeader) {
    const expected = Array.isArray(expectedHeader) ? expectedHeader : String(expectedHeader).split(';');
    if (expected.length !== header.length || expected.some((name, index) => name !== header[index])) {
      errors.push(failure(1, '', 'en_tete_invalide'));
    }
  }
  return { header, rows, errors };
}

export function normalizeForbiddenText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function containsForbiddenName(text, forbiddenNames = []) {
  const normalized = ` ${normalizeForbiddenText(text)} `;
  return forbiddenNames.some((name) => {
    const normalizedName = normalizeForbiddenText(name);
    if (!normalizedName) return false;
    if (normalized.includes(` ${normalizedName} `)) return true;
    return normalizedName.split(' ').some((token) => token && normalized.includes(` ${token} `));
  });
}

function forbiddenList(names) {
  if (Array.isArray(names)) return names;
  return String(names ?? '').split(/\r?\n/).filter((name) => name.trim() && !name.trimStart().startsWith('#'));
}

function textProblem(value, names) {
  if (containsForbiddenName(value, names)) return 'nom_interdit';
  if (/(?:https?:\/\/|www\.)\S+/i.test(value)) return 'coordonnees_interdites';
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) return 'coordonnees_interdites';
  if (/(?:\+?\d[\d\s().-]{5,}\d)/.test(value)) return 'coordonnees_interdites';
  return '';
}

function dateError(value, today) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date_invalide';
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return 'date_invalide';
  return value > today ? 'date_future' : '';
}

function validEmoji(value) {
  return /\p{Extended_Pictographic}/u.test(value) || /\p{Regional_Indicator}{2}/u.test(value);
}

function headerErrors(header, required, optional = [], order = [...required, ...optional]) {
  const errors = [];
  const seen = new Set();
  for (const name of header) {
    if (seen.has(name)) errors.push(failure(1, '', 'colonne_dupliquee', header.indexOf(name) + 1));
    seen.add(name);
  }
  for (const name of required) {
    if (!seen.has(name)) errors.push(failure(1, name, 'colonne_manquante', 1));
  }
  for (const name of header) {
    if (!required.includes(name) && !optional.includes(name)) {
      errors.push(failure(1, '', 'colonne_inconnue', header.indexOf(name) + 1));
    }
  }
  const positions = header.map((name) => order.indexOf(name));
  if (positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
    errors.push(failure(1, '', 'ordre_colonnes_invalide'));
  }
  return errors;
}

export function validateCategoriesCsv(text, { baseCategories = [], forbiddenNames = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const parsed = parseCsv(text);
  const errors = [...parsed.errors, ...headerErrors(parsed.header, CATEGORY_COLUMNS)];
  for (const row of parsed.rows) {
    if (row.cells.length !== parsed.header.length) errors.push(failure(row.line, '', 'nombre_cellules_incorrect', parsed.header.length + 1));
  }
  const names = forbiddenList(forbiddenNames);
  const categories = [];
  const seenIds = new Set();
  const baseIds = new Set(baseCategories.map((category) => category.id));
  for (const row of parsed.rows) {
    const values = Object.fromEntries(parsed.header.map((name, index) => [name, (row.cells[index] ?? '').trim()]));
    for (const field of CATEGORY_COLUMNS) {
      if (!values[field]) errors.push(failure(row.line, field, 'champ_obligatoire_vide', parsed.header.indexOf(field) + 1));
    }
    if (values.id && baseIds.has(values.id)) errors.push(failure(row.line, 'id', 'categorie_base_interdite', 1));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.id || '')) errors.push(failure(row.line, 'id', 'id_invalide', 1));
    if (values.id && seenIds.has(values.id)) errors.push(failure(row.line, 'id', 'id_duplique', 1));
    seenIds.add(values.id);
    for (const field of ['fr', 'dr', 'ar']) {
      const value = values[field] || '';
      if (Array.from(value).length > 40) errors.push(failure(row.line, field, 'texte_trop_long', parsed.header.indexOf(field) + 1));
      const problem = textProblem(value, names);
      if (problem) errors.push(failure(row.line, field, problem, parsed.header.indexOf(field) + 1));
    }
    if (!validEmoji(values.emoji || '')) errors.push(failure(row.line, 'emoji', 'emoji_invalide', parsed.header.indexOf('emoji') + 1));
    if ((values.emoji || '').length > 32) errors.push(failure(row.line, 'emoji', 'emoji_trop_long', parsed.header.indexOf('emoji') + 1));
    if (!/^#[0-9a-f]{6}$/i.test(values.color || '')) errors.push(failure(row.line, 'color', 'couleur_invalide', parsed.header.indexOf('color') + 1));
    categories.push({
      id: values.id || '', fr: values.fr || '', dr: values.dr || '', ar: values.ar || '',
      emoji: values.emoji || '', color: values.color || '', base: baseIds.has(values.id),
    });
  }
  return { categories, errors };
}

export function computeReviewStatus({ relecteurFr = '', relecteurDr = '', dateRevision = '', secondVoice = '' } = {}) {
  if (!relecteurDr) return 'brouillon';
  if (relecteurFr && dateRevision && secondVoice && secondVoice !== relecteurFr && secondVoice !== relecteurDr) return 'relu-clinique';
  return 'relu-langue';
}

const GRID_SIZES = [2, 3, 4, 5];
const BASE_CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));
const BASE_CARD_IDS = new Set(defaultCards().map((card) => card.id));

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function sameText(left, right) {
  return (left ?? '') === (right ?? '');
}

export function isLexicallyCustomized(card, baseline) {
  if (card?.lexicon?.customized === true) return true;
  const reference = baseline || (BASE_CARD_IDS.has(card?.id) ? defaultCards().find((entry) => entry.id === card.id) : null);
  if (!reference) return false;
  return CUSTOM_FIELDS.some((field) => !sameText(card[field], reference[field]));
}

export function matchesHistoricalCard(card, word, defaults = defaultCards()) {
  if (!card || !word?.legacyId || card.id !== word.legacyId || String(card.id).startsWith('u-')) return false;
  if (card.wordId && card.wordId !== card.id) return false;
  if (!BASE_CATEGORY_IDS.has(word.categorie) || card.cat !== word.categorie) return false;
  const baseline = defaults.find((entry) => entry.id === card.id);
  if (!baseline || baseline.cat !== word.categorie) return false;
  return CUSTOM_FIELDS.every((field) => sameText(card[field], baseline[field]));
}

function reviewStatus(word) {
  return computeReviewStatus({
    relecteurFr: word.relecteurFr,
    relecteurDr: word.relecteurDr,
    dateRevision: word.dateRevision,
    secondVoice: word.secondVoice,
  });
}

function lexiconMetadata(word, card, revision, baseline) {
  const previous = card?.lexicon || {};
  const legacy = previous.legacy === true || Boolean(word.legacyId && card?.id === word.legacyId && baseline);
  return {
    ...previous,
    owned: true,
    legacy,
    customized: previous.customized === true || isLexicallyCustomized(card, baseline),
    wordId: word.wordId,
    revision,
    niveau: word.niveau,
    palier: word.palier,
    fonction: word.fonction || '',
    sourceCategory: word.categorie,
    role: word.role,
    arStandard: word.arStandard || '',
    legacyFr: legacy ? (typeof previous.legacyFr === 'string' ? previous.legacyFr : baseline?.fr || '') : '',
    relecteurFr: word.relecteurFr || '',
    relecteurDr: word.relecteurDr || '',
    dateRevision: word.dateRevision || '',
    secondVoice: word.secondVoice || '',
    status: reviewStatus(word),
  };
}

const cleanLexiconText = (value, max) => {
  if (typeof value !== 'string' || textProblem(value, [])) return '';
  return value.slice(0, max);
};

export function sanitizeLexiconMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const wordId = typeof raw.wordId === 'string' && /^w-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.wordId) && raw.wordId.length <= 80
    ? raw.wordId : '';
  if (!wordId) return null;
  const relecteurFr = typeof raw.relecteurFr === 'string' && /^[A-Z]{2,4}$/.test(raw.relecteurFr) ? raw.relecteurFr : '';
  const relecteurDr = typeof raw.relecteurDr === 'string' && /^[A-Z]{2,4}$/.test(raw.relecteurDr) ? raw.relecteurDr : '';
  const secondVoice = typeof raw.secondVoice === 'string' && /^[A-Z]{2,4}$/.test(raw.secondVoice) ? raw.secondVoice : '';
  const dateRevision = typeof raw.dateRevision === 'string' && dateError(raw.dateRevision, '9999-12-31') === '' ? raw.dateRevision : '';
  const metadata = {
    owned: raw.owned === true,
    legacy: raw.legacy === true,
    customized: raw.customized === true,
    wordId,
    revision: typeof raw.revision === 'string' && /^[\w.:-]{1,80}$/.test(raw.revision) ? raw.revision : '',
    niveau: LEVELS.includes(raw.niveau) ? raw.niveau : 'noyau',
    palier: Number.isInteger(Number(raw.palier)) && Number(raw.palier) >= 1 && Number(raw.palier) <= 4 ? Number(raw.palier) : 1,
    fonction: FUNCTIONS.includes(raw.fonction) ? raw.fonction : '',
    sourceCategory: typeof raw.sourceCategory === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.sourceCategory) && raw.sourceCategory.length <= 80
      ? raw.sourceCategory : '',
    role: ROLES.includes(raw.role) ? raw.role : 'noun',
    arStandard: cleanLexiconText(raw.arStandard, 40),
    legacyFr: cleanLexiconText(raw.legacyFr, 40),
    relecteurFr,
    relecteurDr,
    dateRevision,
    secondVoice,
  };
  return { ...metadata, status: computeReviewStatus(metadata) };
}

export function mergeLexicalCard(local, incoming, { defaultCards: defaults = defaultCards() } = {}) {
  const remoteLexicon = sanitizeLexiconMetadata(incoming?.lexicon);
  if (!local?.id || local.id !== incoming?.id || String(local.id).startsWith('u-') || !remoteLexicon?.owned) return null;
  if (local.cat !== incoming.cat || local.cat !== remoteLexicon.sourceCategory) return null;
  const localWordId = typeof local.lexicon?.wordId === 'string' ? local.lexicon.wordId : '';
  const localLexicon = localWordId ? sanitizeLexiconMetadata(local.lexicon) : null;
  if (localWordId && (!localLexicon || localWordId !== remoteLexicon.wordId)) return null;
  if (!localWordId) {
    const legacyId = `c-${remoteLexicon.wordId.slice(2)}`;
    const word = { wordId: remoteLexicon.wordId, legacyId, categorie: remoteLexicon.sourceCategory };
    if (!remoteLexicon.legacy || !matchesHistoricalCard(local, word, defaults)) return null;
  }
  const baseline = defaults.find((card) => card.id === local.id);
  const customized = localLexicon?.customized === true || remoteLexicon.customized === true
    || isLexicallyCustomized(local, baseline) || isLexicallyCustomized(incoming, baseline);
  const localRank = localLexicon ? ['brouillon', 'relu-langue', 'relu-clinique'].indexOf(computeReviewStatus(localLexicon)) : -1;
  const remoteRank = ['brouillon', 'relu-langue', 'relu-clinique'].indexOf(computeReviewStatus(remoteLexicon));
  const source = remoteRank > localRank ? { card: incoming, lexicon: remoteLexicon } : { card: local, lexicon: localLexicon };
  const next = { ...local };
  if (!customized) {
    next.fr = source.card.fr;
    next.dr = source.card.dr;
    next.ar = source.card.ar;
  }
  next.lexicon = {
    ...source.lexicon,
    customized,
    status: computeReviewStatus(source.lexicon),
  };
  const localUpdatedAt = Number(local.updatedAt);
  const remoteUpdatedAt = Number(incoming.updatedAt);
  if (Number.isFinite(localUpdatedAt) || Number.isFinite(remoteUpdatedAt)) {
    next.updatedAt = Math.max(Number.isFinite(localUpdatedAt) ? localUpdatedAt : 0, Number.isFinite(remoteUpdatedAt) ? remoteUpdatedAt : 0);
  }
  return next;
}

function validPlace(place, cols, maxRows = Infinity) {
  return Boolean(place) && Number.isInteger(place.row) && Number.isInteger(place.col)
    && place.row >= 1 && place.row <= maxRows && place.col >= 1 && place.col <= cols;
}

function placeKey(category, cols, place) {
  return `${category}|${cols}|${place.row}:${place.col}`;
}

function firstFreePlace(occupied, category, cols, maxRows) {
  for (let row = 1; row <= maxRows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const place = { row, col };
      if (!occupied.has(placeKey(category, cols, place))) return place;
    }
  }
  return null;
}

export function planLexiqueApplication({
  words = [],
  cards = [],
  cols,
  revision = '',
  now = new Date().toISOString(),
  maxRows = Infinity,
  defaultCards: defaults = defaultCards(),
} = {}) {
  const additions = [];
  const updates = [];
  const conflicts = [];
  const changed = [];
  const report = { total: words.length, additions: 0, updates: 0, conflicts: 0, moved: 0, customizedPreserved: 0, unchanged: 0 };
  if (!GRID_SIZES.includes(cols)) {
    for (const word of words) conflicts.push({ wordId: word.wordId, reason: 'taille_active_invalide' });
    report.conflicts = conflicts.length;
    return { changed, additions, updates, conflicts, report };
  }
  const rowLimit = Number.isInteger(maxRows) && maxRows > 0 ? maxRows : Infinity;
  const occupied = new Set();
  const byLexiconId = new Map();
  const byCardId = new Map();
  const defaultsById = new Map(defaults.map((card) => [card.id, card]));
  let nextOrder = 0;

  for (const card of cards) {
    if (Number.isFinite(card.order)) nextOrder = Math.max(nextOrder, card.order);
    if (!byCardId.has(card.id)) byCardId.set(card.id, []);
    byCardId.get(card.id).push(card);
    const wordId = card.lexicon?.wordId;
    if (wordId && !String(card.id).startsWith('u-')) {
      if (!byLexiconId.has(wordId)) byLexiconId.set(wordId, []);
      byLexiconId.get(wordId).push(card);
    }
    for (const size of GRID_SIZES) {
      const place = card.positions?.[String(size)];
      if (validPlace(place, size, rowLimit)) occupied.add(placeKey(card.cat, size, place));
    }
  }

  for (const word of words) {
    let card = null;
    let identityConflict = '';
    const exact = byLexiconId.get(word.wordId) || [];
    if (exact.length > 1) identityConflict = 'identite_dupliquee';
    else if (exact.length === 1) card = exact[0];
    else if (word.legacyId) {
      const historical = (byCardId.get(word.legacyId) || []).filter((entry) => matchesHistoricalCard(entry, word, defaults));
      if (historical.length > 1) identityConflict = 'identite_dupliquee';
      else if (historical.length === 1) card = historical[0];
    }
    if (identityConflict) {
      conflicts.push({ wordId: word.wordId, reason: identityConflict });
      continue;
    }
    if (!card && byCardId.has(word.wordId)) {
      conflicts.push({ wordId: word.wordId, reason: 'identite_presente' });
      continue;
    }

    if (card) {
      if (card.cat !== word.categorie) {
        conflicts.push({ wordId: word.wordId, cardId: card.id, reason: 'categorie_differente' });
        continue;
      }
      const baseline = defaultsById.get(card.id);
      const lexicon = lexiconMetadata(word, card, revision, baseline);
      const customized = lexicon.customized;
      const next = {
        ...card,
        fr: customized ? card.fr : word.fr,
        dr: customized ? card.dr : word.drLat,
        ar: customized ? card.ar : word.drAr,
        lexicon,
      };
      if (!card.wordId && lexicon.legacy) next.wordId = card.id;
      const lexicalChange = !sameValue(card.fr, next.fr) || !sameValue(card.dr, next.dr) || !sameValue(card.ar, next.ar)
        || !sameValue(card.lexicon, next.lexicon) || !sameValue(card.wordId, next.wordId);
      if (!lexicalChange) {
        report.unchanged += 1;
        continue;
      }
      next.updatedAt = now;
      updates.push(next);
      changed.push(next);
      if (customized) report.customizedPreserved += 1;
      continue;
    }

    const positions = {};
    let moved = false;
    let noSpace = false;
    for (const size of GRID_SIZES) {
      const desired = word.positions?.[String(size)];
      let place = validPlace(desired, size, rowLimit) && !occupied.has(placeKey(word.categorie, size, desired)) ? desired : null;
      if (!place) {
        place = firstFreePlace(occupied, word.categorie, size, rowLimit);
        moved = true;
      }
      if (!place) {
        noSpace = true;
        break;
      }
      positions[String(size)] = { row: place.row, col: place.col };
    }
    if (noSpace) {
      conflicts.push({ wordId: word.wordId, reason: 'espace_epuise' });
      continue;
    }
    for (const size of GRID_SIZES) occupied.add(placeKey(word.categorie, size, positions[String(size)]));
    nextOrder += 1;
    const activePlace = positions[String(cols)];
    const newCard = {
      id: word.wordId,
      wordId: word.wordId,
      cat: word.categorie,
      fr: word.fr,
      dr: word.drLat,
      ar: word.drAr,
      emoji: word.emoji,
      gram: word.role,
      sub: '',
      sayFr: '',
      sayAr: '',
      photo: null,
      video: null,
      audios: {},
      hidden: false,
      order: nextOrder,
      positions,
      gridRow: activePlace.row,
      gridCol: activePlace.col,
      visualKey: null,
      lexicon: lexiconMetadata(word, null, revision),
      updatedAt: now,
    };
    additions.push(newCard);
    changed.push(newCard);
    if (moved) report.moved += 1;
  }

  report.additions = additions.length;
  report.updates = updates.length;
  report.conflicts = conflicts.length;
  return { changed, additions, updates, conflicts, report };
}

export function cardPassesReviewFilter(card, { parent = false, onlyReviewed = false } = {}) {
  if (card.hidden === true) return false;
  if (parent || !onlyReviewed) return true;
  const lexicon = card.lexicon;
  if (!lexicon?.owned || lexicon.customized === true || lexicon.legacy === true) return true;
  if (String(card.id).startsWith('u-') || BASE_CARD_IDS.has(card.id)) return true;
  const status = computeReviewStatus({
    relecteurFr: lexicon.relecteurFr,
    relecteurDr: lexicon.relecteurDr,
    dateRevision: lexicon.dateRevision,
    secondVoice: lexicon.secondVoice,
  });
  return status === 'relu-langue' || status === 'relu-clinique';
}

export function computeLexiqueStats(words = [], cards = [], categories = []) {
  const byStatus = { brouillon: 0, 'relu-langue': 0, 'relu-clinique': 0 };
  const byPalier = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const byCategory = {};
  const sourceIds = new Set(words.map((word) => word.wordId));
  const appliedIds = new Set();
  for (const category of categories) byCategory[category.id] = 0;
  for (const word of words) {
    const status = reviewStatus(word);
    byStatus[status] += 1;
    byPalier[word.palier] = (byPalier[word.palier] || 0) + 1;
    byCategory[word.categorie] = (byCategory[word.categorie] || 0) + 1;
  }
  for (const card of cards) {
    if (card.lexicon?.owned && sourceIds.has(card.lexicon.wordId)) appliedIds.add(card.lexicon.wordId);
  }
  return { total: words.length, applied: appliedIds.size, byStatus, byPalier, byCategory };
}

function parsePosition(value, cols, line, field, errors) {
  const match = /^([1-9]\d*):([1-9]\d*)$/.exec(value || '');
  if (!match || Number(match[2]) > cols) {
    errors.push(failure(line, field, 'position_invalide', COLUMNS.indexOf(field) + 1));
    return null;
  }
  return { row: Number(match[1]), col: Number(match[2]) };
}

export function validateLexiqueCsv(text, { categories = [], defaultCards = [], forbiddenNames = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const parsed = parseCsv(text);
  const errors = [...parsed.errors, ...headerErrors(parsed.header, REQUIRED_COLUMNS, OPTIONAL_COLUMNS, COLUMNS)];
  for (const row of parsed.rows) {
    if (row.cells.length !== parsed.header.length) errors.push(failure(row.line, '', 'nombre_cellules_incorrect', parsed.header.length + 1));
  }
  const names = forbiddenList(forbiddenNames);
  const categoryIds = new Set(categories.map((category) => category.id));
  const defaults = new Map(defaultCards.map((card) => [card.id, card]));
  const words = [];
  const seenWords = new Set();
  const seenPlaces = new Set();

  for (const row of parsed.rows) {
    const values = Object.fromEntries(parsed.header.map((name, index) => [name, (row.cells[index] ?? '').trim()]));
    const wordId = values.wordId || '';
    if (!/^w-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(wordId) || wordId.length > 80) {
      errors.push(failure(row.line, 'wordId', 'wordId_invalide', 1));
    }
    if (wordId && seenWords.has(wordId)) errors.push(failure(row.line, 'wordId', 'wordId_duplique', 1));
    seenWords.add(wordId);
    if (!LEVELS.includes(values.niveau)) errors.push(failure(row.line, 'niveau', 'valeur_invalide', 2));
    if (!['1', '2', '3', '4'].includes(values.palier)) errors.push(failure(row.line, 'palier', 'valeur_invalide', 3));
    if (!categoryIds.has(values.categorie)) errors.push(failure(row.line, 'categorie', 'categorie_invalide', 4));
    if (!ROLES.includes(values.role)) errors.push(failure(row.line, 'role', 'valeur_invalide', 5));
    if (!validEmoji(values.emoji || '')) errors.push(failure(row.line, 'emoji', 'emoji_invalide', 6));
    if ((values.emoji || '').length > 32) errors.push(failure(row.line, 'emoji', 'emoji_trop_long', 6));

    for (const field of TEXT_FIELDS) {
      const value = values[field] || '';
      if (field !== 'ar' && !value) errors.push(failure(row.line, field, 'champ_obligatoire_vide', COLUMNS.indexOf(field) + 1));
      if (Array.from(value).length > 40) errors.push(failure(row.line, field, 'texte_trop_long', COLUMNS.indexOf(field) + 1));
      const problem = textProblem(value, names);
      if (problem) errors.push(failure(row.line, field, problem, COLUMNS.indexOf(field) + 1));
    }

    const positions = {};
    for (const cols of [2, 3, 4, 5]) {
      const field = `pos_${cols}`;
      const position = parsePosition(values[field], cols, row.line, field, errors);
      if (position) {
        positions[String(cols)] = position;
        const key = `${values.categorie}|${cols}|${position.row}:${position.col}`;
        if (seenPlaces.has(key)) errors.push(failure(row.line, field, 'position_dupliquee', COLUMNS.indexOf(field) + 1));
        seenPlaces.add(key);
      }
    }

    for (const field of ['relecteur_fr', 'relecteur_dr']) {
      if (values[field] && !/^[A-Z]{2,4}$/.test(values[field])) {
        errors.push(failure(row.line, field, 'relecteur_invalide', COLUMNS.indexOf(field) + 1));
      }
    }
    const dateProblem = dateError(values.date_relecture || '', today);
    if (dateProblem) errors.push(failure(row.line, 'date_relecture', dateProblem, COLUMNS.indexOf('date_relecture') + 1));

    let secondVoice = '';
    const note = values.note || '';
    if (note) {
      const match = /^2e_voix\s*=\s*([A-Z]{2,4})$/.exec(note);
      if (!match) errors.push(failure(row.line, 'note', 'note_invalide', COLUMNS.indexOf('note') + 1));
      else secondVoice = match[1];
    }
    if (secondVoice && [values.relecteur_fr, values.relecteur_dr].includes(secondVoice)) {
      errors.push(failure(row.line, 'note', 'seconde_voix_identique', COLUMNS.indexOf('note') + 1));
    }
    if (!FUNCTIONS.includes(values.fonction || '')) errors.push(failure(row.line, 'fonction', 'valeur_invalide', COLUMNS.indexOf('fonction') + 1));

    const legacyId = `c-${wordId.slice(2)}`;
    words.push({
      wordId,
      niveau: values.niveau || '',
      palier: Number(values.palier) || 0,
      categorie: values.categorie || '',
      role: values.role || '',
      emoji: values.emoji || '',
      fr: values.fr || '',
      drLat: values.dr_lat || '',
      drAr: values.dr_ar || '',
      arStandard: values.ar || '',
      positions,
      relecteurFr: values.relecteur_fr || '',
      relecteurDr: values.relecteur_dr || '',
      dateRevision: values.date_relecture || '',
      secondVoice,
      fonction: values.fonction || '',
      status: computeReviewStatus({ relecteurFr: values.relecteur_fr, relecteurDr: values.relecteur_dr, dateRevision: values.date_relecture, secondVoice }),
      legacyId: defaults.has(legacyId) ? legacyId : '',
    });
  }
  return { words, errors };
}

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotate = (value, count) => (value >>> count) | (value << (32 - count));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(64);
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotate(words[i - 15], 7) ^ rotate(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotate(words[i - 2], 17) ^ rotate(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + SHA_K[i] + words[i]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((value) => value.toString(16).padStart(8, '0')).join('');
}

function canonicalCategory(category) {
  return { id: category.id, fr: category.fr, dr: category.dr, ar: category.ar, emoji: category.emoji, color: category.color };
}

function canonicalWord(word) {
  return {
    wordId: word.wordId, niveau: word.niveau, palier: word.palier, categorie: word.categorie,
    role: word.role, emoji: word.emoji, fr: word.fr, drLat: word.drLat, drAr: word.drAr,
    arStandard: word.arStandard,
    positions: Object.fromEntries(['2', '3', '4', '5'].map((cols) => [cols, { row: word.positions[cols].row, col: word.positions[cols].col }])),
    relecteurFr: word.relecteurFr, relecteurDr: word.relecteurDr, dateRevision: word.dateRevision,
    secondVoice: word.secondVoice, fonction: word.fonction, status: word.status, legacyId: word.legacyId,
  };
}

export function canonicalRevision(categories, words) {
  return sha256(JSON.stringify({
    categories: categories.map(canonicalCategory),
    words: words.map(canonicalWord),
  }));
}

export function buildLexiqueData({ categories, words }) {
  const normalizedCategories = categories.map(canonicalCategory);
  const normalizedWords = words.map(canonicalWord);
  return {
    schema: 1,
    revision: canonicalRevision(normalizedCategories, normalizedWords),
    categories: normalizedCategories,
    words: normalizedWords,
  };
}

export function renderLexiqueModule(data) {
  return `export const LEXIQUE = ${JSON.stringify(data, null, 2)};\n`;
}

function expectedVoiceText(word, language) {
  if (language === 'fr') return word.fr;
  if (language === 'dr') return word.drAr;
  if (language === 'ar') return word.arStandard;
  return '';
}

function hasVoiceFile(voiceFiles, language, id) {
  if (!voiceFiles) return false;
  const path = `${language}/${id}.mp3`;
  if (voiceFiles instanceof Set) return voiceFiles.has(path);
  return Array.isArray(voiceFiles) && voiceFiles.includes(path);
}

export function renderMissingVoices(words, voiceIndex = {}, voiceFiles = null) {
  const languages = Object.keys(voiceIndex);
  const rows = [];
  for (const word of words) {
    for (const language of languages) {
      const voices = voiceIndex[language] || {};
      const expected = expectedVoiceText(word, language);
      const ids = [word.wordId, word.legacyId].filter(Boolean);
      const present = ids.some((id) => voices[id] === expected && hasVoiceFile(voiceFiles, language, id));
      if (!present) rows.push([word.wordId, language]);
    }
  }
  return `wordId;langue\n${rows.map((row) => row.join(';')).join('\n')}${rows.length ? '\n' : ''}`;
}

export function importLexique({ sourceText, categoriesText, forbiddenNames = [], today = new Date().toISOString().slice(0, 10), baseCategories = [], defaultCards = [], voiceIndex = {}, voiceFiles = null }) {
  const categoryResult = validateCategoriesCsv(categoriesText, { baseCategories, forbiddenNames, today });
  const wordResult = validateLexiqueCsv(sourceText, { categories: [...baseCategories, ...categoryResult.categories], defaultCards, forbiddenNames, today });
  const errors = [...categoryResult.errors, ...wordResult.errors];
  if (errors.length) return { data: null, missingCsv: null, errors };
  const data = buildLexiqueData({ categories: categoryResult.categories, words: wordResult.words });
  return { data, missingCsv: renderMissingVoices(data.words, voiceIndex, voiceFiles), errors: [] };
}
