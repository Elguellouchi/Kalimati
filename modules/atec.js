// Bilan trimestriel ATEC (Autism Treatment Evaluation Checklist — 4 sous-échelles cliniques).
// Permet au pédopsychiatre et aux parents de mesurer l'évolution globale tous les 90 jours.
// Plus le score est bas, plus les difficultés diminuent (0 à 179 points). 100 % local (IndexedDB settings).
import * as db from '../db.js';
import { h, btn, dayKey } from './util.js';
import { iconLabel } from './ui-icons.js';
import { firstName } from './aba.js';

const ATEC_KEY = 'atec_history';

// Sous-échelles officielles ATEC résumées de façon claire pour les parents (même barème clinique 0–179) :
// I. Parole/Langage/Communication (14 items, 0–28, inversé: 0=vrai, 2=faux)
// II. Sociabilité (20 items, 0–40: 0=pas un problème, 2=très problématique)
// III. Conscience sensorielle/cognitive (18 items, 0–36, inversé: 0=beaucoup, 2=pas du tout)
// IV. Santé / Comportement physique (25 items, 0–75, 0=pas un problème à 3=problème sévère)
export const ATEC_SECTIONS = [
  {
    id: 'speech',
    title: 'I. Parole, Langage & Communication',
    color: '#1565C0',
    max: 28,
    hint: '0 = Très vrai (acquis) · 1 = Parfois vrai · 2 = Pas vrai',
    options: [[0, 'Très vrai ✅'], [1, 'Parfois'], [2, 'Pas vrai']],
    items: [
      'Connaît son propre prénom',
      'Répond à « Non » ou « Stop »',
      'Suit certaines consignes simples',
      'Comprend une phrase entière',
      'Sait prononcer des mots simples (ou utilise ses cartes CAA spontanément)',
      'Utilise 2 mots ensemble (« Je veux eau »)',
      'Utilise des phrases de 3 mots ou plus',
      'Sait poser une question simple',
      'Nomme des objets courants quand on lui montre',
      'Utilise les pronoms (je, tu, il/elle)',
      'Explique ce qu’elle veut clairement',
      'Tient une petite conversation (2–3 échanges)',
      'Comprend les explications simples',
      'Raconte une petite chose vécue dans sa journée',
    ],
  },
  {
    id: 'social',
    title: 'II. Sociabilité & Interactions',
    color: '#2E7D32',
    max: 40,
    hint: '0 = Pas un problème · 1 = Un peu problématique · 2 = Très problématique',
    options: [[0, 'Pas un problème'], [1, 'Un peu'], [2, 'Très problématique']],
    items: [
      'Semble dans sa propre bulle / difficile à joindre',
      'Ignore les autres personnes autour',
      'Peu d’attention portée quand on lui parle',
      'Manque de coopération avec les adultes',
      'Absence de contact visuel',
      'Préfère rester seule',
      'Ne montre pas d’affection',
      'Ne salue pas ses parents / proches',
      'Évite les autres enfants',
      'Se fâche facilement quand on l’interrompt',
      'Insensible aux émotions des autres',
      'Indifférence à être aimée / félicitée',
      'Ne regarde pas où l’adulte pointe du doigt',
      'Ne cherche pas à imiter les gestes ou les pairs',
      'Ne partage pas ses découvertes / jouets',
      'Ne demande pas d’aide',
      'Anxiété ou peur excessive face aux inconnus',
      'Résistance aux câlins ou au toucher affectueux',
      'Difficile à consoler quand elle est contrariée',
      'Crises ou pleurs lors des interactions sociales',
    ],
  },
  {
    id: 'sensory',
    title: 'III. Conscience Sensorielle & Cognitive',
    color: '#7E57C2',
    max: 36,
    hint: '0 = Très présent (acquis) · 1 = Un peu · 2 = Pas du tout',
    options: [[0, 'Très présent ✅'], [1, 'Un peu'], [2, 'Pas du tout']],
    items: [
      'Répond quand on l’appelle par son prénom',
      'Répond aux félicitations et encouragements',
      'Regarde les personnes et les animaux avec intérêt',
      'Regarde les images d’un livre avec attention',
      'Dessine, colorie ou fait des tracés',
      'Joue de façon adaptée avec ses jouets',
      'Expression du visage adaptée à la situation',
      'Comprend les histoires simples',
      'Comprend les explications de cause à effet',
      'Est consciente de son environnement',
      'Est consciente du danger (escalier, route, chaud)',
      'Montre de l’imagination dans le jeu',
      'Initie des activités toute seule',
      'S’habille avec de plus en plus d’autonomie',
      'Curieuse et intéressée par de nouvelles choses',
      'Cherche à explorer de nouveaux lieux calmement',
      'Sensible aux besoins des autres membres de la famille',
      'S’adapte aux routines du quotidien',
    ],
  },
  {
    id: 'behavior',
    title: 'IV. Santé, Sommeil & Comportements',
    color: '#E65100',
    max: 75,
    hint: '0 = Pas un problème · 1 = Léger · 2 = Modéré · 3 = Sévère',
    options: [[0, 'Aucun (0)'], [1, 'Léger (1)'], [2, 'Modéré (2)'], [3, 'Sévère (3)']],
    items: [
      'Accidents urinaires nocturnes (pipi au lit)',
      'Accidents urinaires le jour',
      'Accidents de selles / constipation ou diarrhée',
      'Troubles du sommeil / réveils nocturnes',
      'Mange trop peu ou sélectivité alimentaire forte',
      'Mange trop ou cherche sans cesse à manger',
      'Manque d’énergie / fatigue marquée',
      'Hyperactivité / agitation incessante',
      'Agitation motrice lors des attentes',
      'Mouvements répétitifs (flapping, balancements)',
      'Sensibilité extrême aux bruits',
      'Sensibilité extrême aux textures / vêtements',
      'Cris ou pleurs fréquents sans raison apparente',
      'Frappe ou se fait mal (auto-agression)',
      'Pousse, mord ou frappe les autres',
      'Jette ou casse des objets',
      'Rigidité extrême / crises au moindre changement',
      'Peurs inhabituelles ou phobies',
      'Fixation obsessionnelle sur certains objets',
      'Répétition incessante des mêmes mots/sons',
      'Tolère mal la frustration ou l’attente',
      'Sensibilité réduite ou excessive à la douleur',
      'Baisse d’attention rapide (< 2 minutes)',
      'Refus fréquent des soins d’hygiène (ongles, dents, douche)',
      'Fatigabilité émotionnelle en fin de journée',
    ],
  },
];

export async function getAtecHistory() {
  const saved = await db.getSetting(ATEC_KEY);
  // v10.3.1 : on écarte les bilans abîmés (vides ou sans score) au lieu de bloquer la page Progrès.
  return Array.isArray(saved)
    ? saved.filter((e) => e && typeof e === 'object' && Number.isFinite(Number(e.total)))
      .map((e) => ({ ...e, total: Number(e.total), ts: Number(e.ts) || Date.parse(e.day || '') || 0 }))
      .sort((a, b) => a.ts - b.ts)
    : [];
}

export function atecSummaryCard(history, onOpen) {
  const latest = history[history.length - 1] || null;
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const delta = latest && prev ? latest.total - prev.total : null;
  const daysSince = latest ? Math.floor((Date.now() - latest.ts) / 86400000) : null;
  const due = !latest || daysSince >= 90;

  return h('section', { class: 'card-box atec-summary' },
    h('div', { class: 'row between' },
      h('h3', {}, '📋 Bilan Trimestriel ATEC (Pédopsychiatre)'),
      btn(due ? '✨ Faire le bilan ATEC' : 'Voir l’évolution ATEC', onOpen, due ? 'primary' : 'ghost')),
    latest
      ? h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('strong', {}, `${latest.total}/179`), h('span', {}, 'score total (↓ = progrès)')),
        h('div', { class: 'kpi' }, h('strong', {}, delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`), h('span', {}, 'vs bilan précédent')),
        h('div', { class: 'kpi' }, h('strong', {}, `J-${Math.max(0, 90 - daysSince)}`), h('span', {}, due ? 'bilan recommandé' : 'prochain bilan')))
      : h('p', { class: 'note' }, 'Aucun bilan ATEC rempli. Remplissez ce questionnaire (5 min) tous les 3 mois pour suivre l’évolution globale avec le pédopsychiatre.'));
}

function atecTrendSvg(history) {
  if (history.length < 2) return h('p', { class: 'note' }, 'La courbe d’évolution apparaîtra dès le 2e bilan trimestriel.');
  const w = 520; const hgt = 150; const padL = 36; const padB = 26; const padT = 18;
  const chartW = w - padL - 20; const chartH = hgt - padB - padT;
  const maxScore = 179;
  const pts = history.map((entry, i) => {
    const x = padL + (i / Math.max(1, history.length - 1)) * chartW;
    const y = padT + chartH - (entry.total / maxScore) * chartH;
    return { x, y, label: entry.day.slice(5), total: entry.total };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = pts.map((p) => `<g>
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="#1565C0"/>
    <text x="${p.x}" y="${Math.max(12, p.y - 8)}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${p.total}</text>
    <text x="${p.x}" y="${hgt - 6}" text-anchor="middle" font-size="10" fill="currentColor">${p.label}</text>
  </g>`).join('');
  return h('div', {
    class: 'trend-chart',
    html: `<svg viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Courbe ATEC">
      <line x1="${padL}" y1="${padT + chartH}" x2="${w - 10}" y2="${padT + chartH}" stroke="currentColor" stroke-opacity=".2"/>
      <path d="${path}" fill="none" stroke="#1565C0" stroke-width="3" stroke-linecap="round"/>
      ${dots}
    </svg>`,
  });
}

export function atecScreen(nav) {
  const answers = {};
  ATEC_SECTIONS.forEach((sec) => {
    answers[sec.id] = sec.items.map(() => 1);
  });
  const body = h('div', { class: 'stack' });

  const exportAtecCsv = async () => {
    const hist = await getAtecHistory();
    const header = ['date', 'total_179', 'I_parole_28', 'II_sociabilite_40', 'III_sensoriel_36', 'IV_comportement_75'];
    const rows = hist.map((x) => [x.day, x.total, x.scores.speech, x.scores.social, x.scores.sensory, x.scores.behavior].join(';'));
    const blob = new Blob([`\uFEFF${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `kalimati-atec-${dayKey()}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  async function render() {
    const history = await getAtecHistory();
    const historyBlock = h('section', { class: 'card-box stack' },
      h('div', { class: 'row between' },
        h('h3', {}, `📈 Évolution ATEC de ${firstName()} (${history.length} bilan${history.length > 1 ? 's' : ''})`),
        h('div', { class: 'row' },
          history.length ? btn(iconLabel('download', 'Exporter CSV'), exportAtecCsv, 'ghost') : null,
          history.length ? btn(iconLabel('printer', 'Imprimer'), () => window.print(), 'ghost') : null)),
      atecTrendSvg(history),
      history.length ? h('div', { class: 'stack' }, [...history].reverse().map((e) => h('div', { class: 'abc-history-row' },
        h('div', { class: 'row between' },
          h('strong', {}, `${e.day} · Score total : ${e.total} / 179`),
          btn('🗑️', async () => {
            const next = history.filter((x) => x.id !== e.id);
            await db.setSetting(ATEC_KEY, next);
            render();
          }, 'ghost tiny')),
        h('p', { class: 'note' }, `Parole : ${e.scores.speech}/28 · Sociabilité : ${e.scores.social}/40 · Sensoriel : ${e.scores.sensory}/36 · Santé/Comportement : ${e.scores.behavior}/75`)))) : null);

    const formSections = ATEC_SECTIONS.map((sec) => {
      const scoreBadge = h('span', { class: 'chip', style: { background: `${sec.color}18`, color: sec.color } }, '');
      const refreshBadge = () => {
        const s = answers[sec.id].reduce((a, b) => a + b, 0);
        scoreBadge.textContent = `${s} / ${sec.max}`;
      };
      refreshBadge();
      return h('details', { class: 'card-box', open: sec.id === 'speech' },
        h('summary', { class: 'row between' }, h('strong', {}, sec.title), scoreBadge),
        h('p', { class: 'note' }, sec.hint),
        h('div', { class: 'stack' }, sec.items.map((q, idx) => {
          const row = h('div', { class: 'atec-q' }, h('span', {}, `${idx + 1}. ${q}`));
          const pills = h('div', { class: 'chip-grid' });
          const drawPills = () => pills.replaceChildren(...sec.options.map(([val, label]) => h('button', {
            type: 'button',
            class: `abc-chip${answers[sec.id][idx] === val ? ' on' : ''}`,
            onclick: () => { answers[sec.id][idx] = val; drawPills(); refreshBadge(); },
          }, label)));
          drawPills();
          row.append(pills);
          return row;
        })));
    });

    const saveBtn = btn('💾 Enregistrer ce bilan trimestriel ATEC', async () => {
      const scores = Object.fromEntries(ATEC_SECTIONS.map((sec) => [sec.id, answers[sec.id].reduce((a, b) => a + b, 0)]));
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      const entry = { id: `atec_${Date.now()}`, ts: Date.now(), day: dayKey(), total, scores };
      await db.setSetting(ATEC_KEY, [...history, entry]);
      render();
    }, 'primary wide');

    body.replaceChildren(
      h('p', { class: 'note' }, 'Questionnaire standardisé en 4 sous-échelles (77 questions). Plus le score diminue au fil des trimestres, plus les progrès cliniques sont importants.'),
      historyBlock,
      ...formSections,
      saveBtn);
  }

  render();
  return h('div', { class: 'screen' },
    h('div', { class: 'nav-btns' }, btn('← Retour aux Progrès', () => nav.back(), 'back-btn')),
    h('h2', {}, '📋 Bilan Trimestriel ATEC'),
    body);
}
