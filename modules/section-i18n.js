// v10.14 : textes des espaces Jeux, Ma journée et Émotions.
// Français et darija (les deux langues de l'enfant) ; les autres langues gardent le français
// sur ces écrans, comme le reste des réglages adultes. Aucun texte n'est envoyé au serveur.
// La darija est générée hors ligne par tools/gen-darija-i18n.mjs (OpenAI) et rangée dans section-i18n-dr.js.
import { TX_DR, GOAL_DR, SECTION_DR, EMOTION_DR, SITUATION_DR, STORY_DR } from './section-i18n-dr.js';

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
  },
};

// Le pluriel darija ne prend pas de « s » : les appelants passent s = '' pour la darija.

// Titre d'un objectif : darija si elle existe, sinon le titre français (référence clinique du PEI).
export function goalTitle(goal, lang) {
  return lang === 'dr' ? (GOAL_DR[goal.id] || goal.title) : goal.title;
}

const ROUTINE_DR = { matin: 'routineMorning', soir: 'routineEvening', ecole: 'routineSchool' };

// Langue active : miroir global pour les widgets partagés qui ne reçoivent pas ctx.lang.
let activeLang = 'fr';
export const setActiveLang = (code) => { activeLang = code || 'fr'; };
export const getActiveLang = () => activeLang;

export function tx(key, lang, vars) {
  const table = lang === 'dr' ? TX_DR : TX.fr;
  const raw = table[key] ?? TX.fr[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name]))) : raw;
}

export function sectionLabel(section, lang) {
  return lang === 'dr' ? (SECTION_DR[section.id] || section.name) : section.name;
}

export function routineLabel(routine, lang) {
  if (lang !== 'dr') return routine.title;
  if (routine.id === 'weekend') {
    const city = /^Week-end à (.+)$/.exec(routine.title || '');
    return city ? `Week-end f ${city[1]}` : tx('routineWeekend', lang);
  }
  return tx(ROUTINE_DR[routine.id] || 'routineMorning', lang);
}

export function emotionLabel(emotion, lang) {
  return lang === 'dr' ? (emotion.dr || EMOTION_DR[emotion.id] || emotion.fr) : emotion.fr;
}

export function situationLabel(situation, lang) {
  return lang === 'dr' ? (situation.dr || SITUATION_DR[situation.id] || situation.text) : situation.text;
}

export function storyLabel(story, lang) {
  return lang === 'dr' ? (story.drTitle || STORY_DR[story.id] || story.title) : story.title;
}
