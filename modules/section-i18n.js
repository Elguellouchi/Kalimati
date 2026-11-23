// v10.14 : textes des espaces Jeux, Ma journée et Émotions.
// Français et darija (les deux langues de l'enfant) ; les autres langues gardent le français
// sur ces écrans, comme le reste des réglages adultes. Aucun texte n'est envoyé au serveur.
// La darija est générée hors ligne par tools/gen-darija-i18n.mjs (OpenAI) et rangée dans section-i18n-dr.js.
// v10.26 : l'arabe standard rejoint la darija sur ces écrans (traductions déjà faites dans le Drive,
// tools/gen-darija-i18n.mjs --langue ar → section-i18n-ar.js). Les autres langues étrangères gardent
// le français ici tant qu'aucune traduction n'a été préparée pour elles.
import * as DR_LATIN from './section-i18n-dr.js';
import * as ARABE from './section-i18n-ar.js';

const TX = {
  fr: {
    home: '🏠 Accueil',
    back: '← Retour',
    starsOfFive: '{n} étoile{s} sur 5',
    loading: 'Chargement…',
    adultLocked: '🔒 Avec un adulte',
    gamesTitle: '🎮 Les jeux pour {name}',
    gamesParentHint: 'Pour l’adulte : choisissez l’intervenant et le lieu, puis un jeu.',
    gamesKidHint: 'Choisis un jeu !',
    orthoTitle: 'Atelier Orthophonie',
    orthoSub: 'Articulation, phrases, situations, sons',
    orthoKid: '🔒 Avec un adulte',
    hygieneTitle: 'Pôle Hygiène & Soins (10 routines)',
    hygieneSub: 'Douche, ongles, shampoing, dents, mains, visage, nez, coiffure, wudu',
    peiHeading: '🎯 PEI 3 mois (objectifs prioritaires)',
    nextHeading: '🚀 Prochains niveaux ABA (ABLLS-R complet)',
    noGames: 'Aucun jeu en cours ici. Touchez « Voir tous les jeux ».',
    onlyInProgress: '🔄 Voir seulement les jeux en cours',
    allGames: '📋 Voir tous les jeux',
    levelBadge: 'Niv. {n}/1000',
    criterion: 'Critère : {text}',
    statusDone: '✅ Atteint',
    statusProgress: '🔄 En cours',
    statusTodo: '○ À commencer',
    exerciseUnavailable: 'Exercice indisponible : {msg}',
    dayTitle: '📅 Ma journée · {name}',
    daySub: 'Ma routine quotidienne : je coche chaque étape.',
    modeSteps: '📋 Pas à pas',
    modeFirstThen: '➡️ Maintenant / Ensuite',
    modeWait: '⏳ J’attends / Calme',
    starsTodayTitle: 'Étoiles gagnées aujourd’hui',
    waitFor: '⏳ J’attends :',
    waitedCalm: '🌟 J’ai bien attendu calme !',
    waitingChoose: '🧘 Pendant que j’attends, je peux choisir :',
    breathText: 'J’inspire doucement… je souffle doucement…',
    countHint: 'Touche chaque chiffre en comptant calme :',
    now: 'Maintenant',
    then: 'Ensuite',
    finished: '✅ J’ai fini !',
    allDone: 'Bravo, tout est fini !',
    noSteps: 'Aucune étape : ajoutez-en dans « ✏️ Modifier les routines ».',
    nextCheck: 'Prochaine coche :',
    alone: '✅ Seule',
    withPrompt: '👉 Avec rappel',
    adultChoice: '🔓 Pour l’adulte (adaptation sans frustration)',
    chipChange: '🔀 Changement',
    insteadOf: '🔄 Au lieu de : {text}',
    smallSteps: '👆 petites étapes',
    replace: '🔄 Remplacer',
    notToday: '🙈 Pas aujourd’hui',
    annulled: 'Annulé ❌',
    restoreStep: '↩ Rétablir',
    launchTimer: '▶ Lancer le sablier',
    timeNext: '🌟 C’est l’heure de passer à la suite',
    touchSub: 'Touche chaque petite étape quand elle est faite.',
    otherActivities: '⏳ Autres activités de la journée (sablier, repas, classe, toilettes)',
    tip: '💡 Astuce : sur chaque ligne ci-dessus, touchez « 🔄 Remplacer » (ex. remplacer la plage par le parc ou un jeu à la maison) ou « 🙈 Pas aujourd’hui » avant de montrer le planning à l’enfant.',
    addSurprise: '🔀 Ajouter un imprévu / Surprise',
    editRoutine: '✏️ Modifier toute la routine',
    printBoard: '🖨️ Imprimer le tableau MATIN / SOIR',
    alreadyRead: '📖 Je sais déjà lire :',
    imageText: '🖼️ Image + texte',
    imageFaded: '🌫️ Image estompée',
    textOnly: '🔤 Texte seul',
    loadingPlanning: 'Chargement du planning…',
    planningUnavailable: 'Planning indisponible : {msg}',
    routineMorning: 'Matin',
    routineEvening: 'Soir',
    routineSchool: 'Journée d’école',
    routineWeekend: 'Week-end en famille',
    emotionsTitle: '😊 Mes émotions et ma famille',
    studioTitle: 'Studio des émotions',
    storiesTitle: 'Mes histoires',
    photosTitle: 'Nos vraies photos',
    adultsOnly: '🔒 adultes',
    studioShow: '👉 Montre l’émotion',
    studioLife: '🏠 Dans la vie',
    studioMirror: '🪞 Miroir magique',
    showMe: 'Montre-moi : {word}',
    howFeels: 'Comment se sent-elle ?',
    adultText: 'Texte pour l’adulte',
    again: '➜ Encore',
    photosStay: 'Les photos restent dans ce téléphone.',
    cameraDenied: 'Caméra refusée ou absente. Autorisez-la dans les réglages du téléphone.',
    openMirror: '🪞 Ouvrir le miroir',
    takePhoto: '📸 Prendre la photo',
    backToDrawing: '↺ Revenir au dessin',
    mirrorPhoto: 'C’est la photo de « {word} » !',
    storiesIntro: 'Des petites histoires pour préparer {name} à ce qui va se passer.',
    allStories: '← Toutes les histoires',
    nextPage: '▶ Page suivante',
    storyFinished: '🌟 Fini !',
    storyFinishedPraise: 'Bravo ! Tu as lu toute l’histoire.',
    photoHint: '📸 Mode parent : touchez le petit 📷 d’une image pour mettre une vraie photo.',
    restoreToday: '↺ Rétablir les étapes d’aujourd’hui',
    doneAria: 'Fait',
    checkAria: 'Cocher',
    pickSay: 'Choisis un autocollant.',
    stickerGoes: 'Il va dans ton jardin !',
    gardenSee: 'Voir mon jardin',
    continue: 'Continuer',
    fiveStars: 'Bravo ! 5 étoiles',
    friendOffer: '{name} t’offre un autocollant.',
    gardenTitle: 'Mon jardin',
    close: 'Fermer',
    gardenEmpty: 'Gagne 5 étoiles pour ton premier autocollant.',
    gardenStats: '{total} étoile{s} gagnée{s} en tout.',
    friendListen: '🔊 Touche {name} pour écouter',
    friendWon: '🌟 Bravo ! Tu as gagné l’autocollant de {name} {species}',
    listenName: '🔊 Écouter {name}',
    openAlbum: '📒 Ouvrir mon Album des Amis',
    albumTitle: '📒 L’Album des Amis ({n} / {total})',
    albumLocked: 'Fais une activité dans cet espace pour réveiller cet ami !',
    albumNote: 'Touchez un ami débloqué pour l’écouter parler en français ou en darija. Aucun point, aucun chrono : chaque mission complétée réveille un ami !',
    startTimer: '▶ Commencer',
    pauseTimer: '⏸ Pause',
    resumeTimer: '▶ Reprendre',
    giveStar: '⭐ Donner une étoile',
    won: 'Bravo, tu as gagné !',
    sessionStartFirst: 'Lancez le timer avant de terminer la séance.',
    sessionValidSpeak: 'Bravo, belle séance !',
    sessionDoneSpeak: 'Merci, la séance est finie.',
    sessionValidText: 'Séance valide enregistrée : {min} min sans rupture. ✅',
    sessionDoneText: 'Séance enregistrée : {min} min, {ruptures} rupture(s). Il faut 10 min sans rupture pour la valider.',
    ruptureBtn: '⚠️ Rupture / opposition',
    rupturesLabel: 'Ruptures : ',
    finishSession: '✔ Terminer et enregistrer la séance',
    // v10.23 (pépites 6 et 4) : quadrillage des émotions 2×2 et moyens pour se sentir mieux.
    moodTitle: '🧭 Mon énergie et mon cœur',
    moodAsk: 'Ça va comment en toi, là, maintenant ?',
    moodAxes: 'En haut mon corps est réveillé, en bas mon corps est posé. À gauche c’est difficile, à droite c’est agréable.',
    moodYellow: '☀️ Réveillé et bien',
    moodRed: '🌋 Réveillé et difficile',
    moodGreen: '🌿 Posé et bien',
    moodBlue: '🌧️ Posé et difficile',
    moodCoping: 'Quand je suis {word}, je peux :',
    moodChosen: 'On le fait ensemble 🤝',
    moodBack: '← Choisir autre chose',
    moodNote: 'Aucun point, aucun chrono : c’est toi qui sens. Rien ne quitte ce téléphone.',
  },
};

// Le pluriel darija et arabe ne prennent pas de « s » latin : les appelants passent s = '' pour elles.

// Les fichiers générés nomment leurs tables d'après la langue : *_DR (darija), *_AR (arabe standard).
// Une table qui manque laisse le français, sans casser l'ouverture de l'application.
const LANGUES = { dr: { mod: DR_LATIN, suf: 'DR' }, ar: { mod: ARABE, suf: 'AR' } };
const LOTS = new Map();
function tablesFor(lang) {
  if (!LANGUES[lang]) return null;
  if (!LOTS.has(lang)) {
    const { mod, suf } = LANGUES[lang];
    LOTS.set(lang, {
      ui: mod[`TX_${suf}`] || {},
      goal: mod[`GOAL_${suf}`] || {},
      section: mod[`SECTION_${suf}`] || {},
      emotion: mod[`EMOTION_${suf}`] || {},
      situation: mod[`SITUATION_${suf}`] || {},
      story: mod[`STORY_${suf}`] || {},
      routine: mod[`ROUTINE_TEXT_${suf}`] || {},
      theme: mod[`THEME_${suf}`] || {},
    });
  }
  return LOTS.get(lang);
}
// La darija garde en priorité ce que la famille a écrit elle-même sur ses cartes.
const ecritDarija = (lang) => lang === 'dr';

// Titre d'un objectif : dans la langue de l'enfant si elle existe, sinon le titre français (référence clinique du PEI).
export function goalTitle(goal, lang) {
  const t = tablesFor(lang);
  return (t && t.goal[goal.id]) || goal.title;
}

const ROUTINE_KEYS = { matin: 'routineMorning', soir: 'routineEvening', ecole: 'routineSchool' };

// Langue active : miroir global pour les widgets partagés qui ne reçoivent pas ctx.lang.
let activeLang = 'fr';
export const setActiveLang = (code) => { activeLang = code || 'fr'; };
export const getActiveLang = () => activeLang;

export function tx(key, lang, vars) {
  const t = tablesFor(lang);
  const raw = (t && t.ui[key]) || TX.fr[key] || key;
  return vars ? raw.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name]))) : raw;
}

export function sectionLabel(section, lang) {
  const t = tablesFor(lang);
  return (t && t.section[section.id]) || section.name;
}

export function routineLabel(routine, lang) {
  const t = tablesFor(lang);
  if (!t) return routine.title;
  if (routine.id === 'weekend') {
    const city = /^Week-end à (.+)$/.exec(routine.title || '');
    // Le nom de la ville est tapé par la famille : il reste tel quel, seule la formule change.
    if (city) return ecritDarija(lang) ? `Week-end f ${city[1]}` : `ويكاند ف ${city[1]}`;
    return tx('routineWeekend', lang);
  }
  return tx(ROUTINE_KEYS[routine.id] || 'routineMorning', lang);
}

export function emotionLabel(emotion, lang) {
  const t = tablesFor(lang);
  if (!t) return emotion.fr;
  return (ecritDarija(lang) ? emotion.dr : '') || t.emotion[emotion.id] || emotion.fr;
}

export function situationLabel(situation, lang) {
  const t = tablesFor(lang);
  if (!t) return situation.text;
  return (ecritDarija(lang) ? situation.dr : '') || t.situation[situation.id] || situation.text;
}

export function storyLabel(story, lang) {
  const t = tablesFor(lang);
  if (!t) return story.title;
  return (ecritDarija(lang) ? story.drTitle : '') || t.story[story.id] || story.title;
}

// Lignes des routines de la vraie vie (espace Jeux) et thèmes du jardin d'autocollants : tables indexées
// par la phrase française, avec la darija d'origine en secours pour la darija.
export function routineText(lang, fr, drFallback = '') {
  const t = tablesFor(lang);
  if (!t) return fr;
  return t.routine[fr] || (ecritDarija(lang) ? (drFallback || fr) : fr);
}

export function themeText(lang, fr) {
  const t = tablesFor(lang);
  if (!t) return fr;
  return t.theme[fr] || fr;
}
export const TX_FR_KEYS = Object.keys(TX.fr);
