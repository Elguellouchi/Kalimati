import * as db from '../db.js';
import { h, btn } from './util.js';
import { LEXIQUE, allCategories, planLexiqueApplication, computeLexiqueStats } from './lexique-rules.js';
import { layoutFingerprint } from './grid-layout.js';
import { categoryName } from './languages.js';

const STATUS_LABELS = {
  brouillon: '⚪ Brouillon',
  'relu-langue': '🟡 Relu en langue',
  'relu-clinique': '🟢 Relu cliniquement',
};

export function lexiconBadge(card) {
  const status = card?.lexicon?.status || 'brouillon';
  const label = STATUS_LABELS[status] || STATUS_LABELS.brouillon;
  return h('span', { class: 'lexicon-badge', dataset: { status }, 'aria-label': label.replace(/^\S+\s/, '') }, label);
}

function stat(label, key, value) {
  return h('div', { class: 'lexique-stat' }, h('span', {}, label), h('strong', { dataset: { stat: key } }, String(value)));
}

function categoryLabel(id, lang = 'fr') {
  const category = allCategories.find((entry) => entry.id === id);
  return category ? `${category.emoji || ''} ${categoryName(category, lang)}`.trim() : id;
}

export function lexiqueScreen(nav, self) {
  const shell = h('section', { id: 'lexique', class: 'card-box lexique-box' }, h('h3', {}, '📖 Lexique relu'));
  const report = h('div', { id: 'lexique-report', class: 'stack', role: 'status' });
  const revision = h('p', { class: 'note' });
  const counts = h('div', { class: 'lexique-stats' });
  const categories = h('div', { class: 'lexique-stats' });
  const planCounts = h('div', { class: 'lexique-stats' });
  const status = h('p', { role: 'status' });
  const reviewToggle = h('input', { id: 'only-reviewed', type: 'checkbox' });
  const apply = btn('Appliquer le lexique', async () => {
    apply.disabled = true;
    status.textContent = 'Application en cours…';
    try {
      const cards = await db.getAllCards();
      const plan = planLexiqueApplication({ words: LEXIQUE.words, cards, cols: nav.state.cols, revision: LEXIQUE.revision });
      if (plan.changed.length) {
        await db.putCards(plan.changed);
        nav.state.cards = cards.map((card) => plan.changed.find((changed) => changed.id === card.id) || card).concat(plan.changed.filter((changed) => !cards.some((card) => card.id === changed.id)));
        await db.setSetting('layoutFingerprint', await layoutFingerprint(nav.state.cards));
      }
      report.replaceChildren(
        h('p', {}, `Total : ${plan.report.total} · Ajouts : ${plan.report.additions} · Mises à jour : ${plan.report.updates} · Conflits : ${plan.report.conflicts}`),
        h('p', {}, `Déplacements : ${plan.report.moved} · Textes personnalisés conservés : ${plan.report.customizedPreserved} · Sans changement : ${plan.report.unchanged}`),
        plan.changed.length ? h('p', {}, `${plan.changed.length} carte${plan.changed.length > 1 ? 's' : ''} enregistrée${plan.changed.length > 1 ? 's' : ''} dans une seule transaction.`) : h('p', {}, 'Aucune modification.'),
        plan.conflicts.length ? h('ul', {}, plan.conflicts.map((conflict) => h('li', {}, `${conflict.wordId} : ${conflict.reason}`))) : null,
      );
      paintPlan(plan, nav.state.cards);
      status.textContent = 'Application terminée.';
      nav.renderAllTalk();
    } catch (error) {
      status.textContent = `L’application n’a pas abouti : ${String(error?.message || error)}`;
    } finally {
      apply.disabled = false;
    }
  }, 'primary');
  apply.id = 'lexique-apply';

  const paintPlan = (plan, cards) => {
    planCounts.replaceChildren(
      stat('Appliquées', 'applied', computeLexiqueStats(LEXIQUE.words, cards, allCategories).applied),
      stat('Ajouts', 'additions', plan.report.additions),
      stat('Mises à jour', 'updates', plan.report.updates),
      stat('Conflits', 'conflicts', plan.report.conflicts),
    );
  };
  const words = h('div', { class: 'lexique-words' }, LEXIQUE.words.length
    ? LEXIQUE.words.map((word) => h('div', { class: 'lexique-word' },
      h('strong', {}, word.fr), h('span', {}, word.drLat), h('span', { dir: 'rtl' }, word.drAr),
      h('span', {}, `Palier ${word.palier}`), h('span', {}, categoryLabel(word.categorie)), lexiconBadge({ lexicon: { status: word.status } })))
    : h('p', { class: 'note' }, 'Aucun mot dans le lexique embarqué.'));
  reviewToggle.checked = nav.state.onlyReviewed;
  reviewToggle.onchange = async () => {
    reviewToggle.disabled = true;
    try {
      await db.setSetting('onlyReviewed', reviewToggle.checked);
      nav.state.onlyReviewed = reviewToggle.checked;
      nav.renderAllTalk();
      status.textContent = 'Réglage enregistré. Les cartes et leurs places ne changent pas.';
    } catch (error) {
      reviewToggle.checked = !reviewToggle.checked;
      status.textContent = `Le réglage n’a pas pu être enregistré : ${String(error?.message || error)}`;
    } finally {
      reviewToggle.disabled = false;
    }
  };
  shell.append(
    revision,
    h('h4', {}, 'Mots et relecture'),
    counts,
    h('h4', {}, 'Paliers et catégories'),
    categories,
    h('label', { class: 'check' }, reviewToggle, ' Afficher seulement les mots relus'),
    h('h4', {}, 'Application sur ce téléphone'),
    planCounts,
    apply,
    status,
    report,
    h('h4', {}, 'Liste des mots'),
    words,
  );

  const paint = (cards) => {
    const stats = computeLexiqueStats(LEXIQUE.words, cards, allCategories);
    revision.textContent = `Révision ${LEXIQUE.revision || 'non renseignée'} · ${LEXIQUE.words.length} mot${LEXIQUE.words.length > 1 ? 's' : ''}.`;
    counts.replaceChildren(
      stat('Total', 'total', stats.total),
      ...Object.entries(stats.byStatus).map(([key, value]) => stat(STATUS_LABELS[key], `status-${key}`, value)),
    );
    categories.replaceChildren(
      ...[1, 2, 3, 4].map((palier) => stat(`Palier ${palier}`, `palier-${palier}`, stats.byPalier[palier])),
      ...allCategories.map((category) => stat(categoryLabel(category.id), `category-${category.id}`, stats.byCategory[category.id] || 0)),
    );
    paintPlan(planLexiqueApplication({ words: LEXIQUE.words, cards, cols: nav.state.cols, revision: LEXIQUE.revision }), cards);
  };
  db.getAllCards().then(paint).catch((error) => { status.textContent = `Lecture impossible : ${String(error?.message || error)}`; });
  return shell;
}
