// v10.35 (pépite « Boussole pour l'aidant », Caregiver Compass) : un seul conseil par jour pour l'adulte.
// Le conseil dépend seulement de réglages simples (tableau express créé ? scène créée ?) et du jour :
// aucune phrase de l'enfant n'est lue ni analysée, rien ne part sur internet.

// [texte, condition facultative sur le contexte]
const TIPS = [
  ['Montrez avant de demander : touchez vous-même 2 ou 3 cartes en parlant (bouton « Je montre »). L’enfant apprend en vous voyant faire.'],
  ['Attendez 5 secondes en silence après une question. Ce temps aide l’enfant à chercher sa carte.'],
  ['Répondez à chaque message, même à une seule carte : « Tu veux de l’eau ! Voilà l’eau. »'],
  ['Ajoutez un mot à la phrase de l’enfant : s’il touche « Eau », dites « Je veux de l’eau ».'],
  ['Laissez la tablette ou le téléphone toujours à portée de main, même pendant le repas et le jeu.'],
  ['Utilisez les mots de base (Je veux, Encore, Fini, Aide-moi) plusieurs fois par jour, dans des moments différents.'],
  ['Ne cachez pas les cartes « Non » et « Fini » : dire non avec une carte est une vraie réussite.'],
  ['Préparez la prochaine sortie : touchez 📍 Lieux, choisissez le lieu et regardez les images ensemble avant de partir.', (c) => !c.hasPlaceBoards],
  ['Écrivez la journée de demain dans « Écrire une phrase en images » et montrez-la le soir.'],
  ['Prenez une photo de votre cuisine ou du salon et faites-en une scène : l’enfant touche les vrais objets de sa maison.', (c) => !c.hasScenes],
  ['Félicitez l’effort, pas seulement le bon mot : « Tu m’as parlé avec tes images, bravo ! »'],
  ['Si l’enfant s’énerve, proposez le coin calme 🌈 avant de parler. On reprend quand il est apaisé.'],
  ['Jouez à « Encore » : arrêtez un jeu qu’il aime et attendez qu’il touche « Encore ».'],
  ['Placez un objet aimé hors de portée mais visible : c’est une bonne occasion de dire « Je veux ».'],
  ['Parlez avec les mêmes mots que les cartes : l’enfant reconnaît plus vite les images.'],
  ['Une seule langue à la fois quand vous montrez une carte, puis l’autre langue juste après : les deux sont utiles.'],
  ['Le soir, regardez ensemble 3 images de la journée et nommez ce qui s’est passé.'],
  ['Les erreurs de toucher ne sont pas graves : laissez l’enfant effacer lui-même avec ⌫.'],
  ['Changez un peu la grille chaque semaine, mais gardez les mots de base toujours à la même place.'],
  ['Le matin, montrez « Ma journée » avant de sortir : savoir ce qui arrive rassure.'],
  ['Si un mot manque, créez la carte tout de suite en mode parent (＋ Ajouter), avec une vraie photo.'],
  ['Enregistrez votre voix sur les cartes importantes : votre voix rassure plus que celle du téléphone.'],
  ['Prenez soin de vous aussi : 5 minutes de pause comptent. Un aidant reposé aide mieux.'],
  ['Partagez la page Progrès avec l’orthophoniste ou la psychologue : elles verront ce qui avance.'],
];

const dayNumber = (date) => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);

// Le même conseil toute la journée, un autre le lendemain.
export function tipOfDay(date = new Date(), context = {}) {
  const eligible = TIPS.filter(([, cond]) => !cond || cond(context));
  const list = eligible.length ? eligible : TIPS;
  return list[dayNumber(date) % list.length][0];
}

export const TIP_COUNT = TIPS.length;
