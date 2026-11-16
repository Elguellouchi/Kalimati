// 🫧 Pôle Hygiène & Soins du corps (Analyse de tâches ABA / Ergothérapie TSA).
// Couvre dans le détail : Brossage des dents (8 étapes + 4 quadrants), Lavage des mains (7 étapes OMS + 20s bulles),
// Lavage du visage (6 étapes), Douche complète (10 étapes), Shampoing & Cheveux (8 étapes),
// Couper les ongles (8 étapes + compteur 10 doigts / 10 orteils + adaptation sensorielle),
// Se moucher le nez (6 étapes + souffle), Se coiffer (6 étapes), Ablutions / Wudu (9 étapes),
// Hygiène des oreilles & lèvres (5 étapes), Changement de vêtements propres & déodorant (6 étapes).
// Chaque routine propose 3 modes : 🧩 Puzzle d'ordre · 🤔 Étape suivante ? · ✅ En vrai (avec photos personnalisables,
// minuteur sensoriel, conseils d'adaptation sensorielle pour l'adulte et cotation ABA reliée au PEI).
import { h, btn, shuffle } from './util.js';
import { speak, hasArabicVoice } from '../speech.js';
import { playBeep, playClap } from '../media.js';
import { recordTrial, ratingPanel, firstName } from './aba.js';
import { choiceBoard, praise, modeTabs } from './widgets.js';
import { draggable, hitTest } from './drag.js';
import { levelOf } from './levels.js';
import { renderVisual } from './visuals.js';

const stepItem = (prefix, [id, emoji, fr, dr, ar, timerSec = 0]) => ({
  id, emoji, fr, dr, ar, timerSec, vkey: `hyg:${prefix}:${id}`,
});

export const HYGIENE_ROUTINES = [
  {
    id: 'dents',
    goalId: 'W.3',
    emoji: '🪥',
    title: 'Se brosser les dents',
    drTitle: 'Nghsel snani',
    arTitle: 'نغسل سناني',
    sub: '8 étapes détaillées + minuteur des 4 coins de la bouche',
    sensoryTip: 'Adaptation sensorielle : dentifrice au goût doux ou sans menthe forte, brosse souple, eau tiède et miroir à hauteur d’enfant.',
    steps: [
      ['prendre', '🪥', 'Prendre ma brosse à dents et la mouiller', 'Nakhoud chita d snan w nfezzegha', 'ناخد الشيتة د السنان ونفزكها'],
      ['dentifrice', '🧴', 'Mettre un petit pois de dentifrice', 'Ndir chwiya d dentifrice', 'ندير شوية د معجون الأسنان'],
      ['haut', '🦷', 'Brosser les dents du haut (gauche et droite)', 'N7okk snan lfou9', 'نحك السنان د الفوق', 20],
      ['bas', '😁', 'Brosser les dents du bas (gauche et droite)', 'N7okk snan lte7t', 'نحك السنان د التحت', 20],
      ['devant', '👄', 'Brosser les dents de devant et la langue', 'N7okk snan l9oddam w lsani', 'نحك السنان د القدام ولساني', 15],
      ['cracher', '💦', 'Cracher la mousse dans le lavabo', 'Nbze9 rghwa f lavabo', 'نبزق الرغوة فلافابو'],
      ['rincer', '🥛', 'Rincer la bouche avec de l’eau et cracher', 'Nchellel fommi b l ma', 'نشلل فمي بالما'],
      ['ranger', '✨', 'Rincer la brosse, la ranger et essuyer ma bouche', 'Nchellel chita w nmse7 fommi', 'نشلل الشيتة ونمسح فمي'],
    ].map((s) => stepItem('dents', s)),
  },
  {
    id: 'douche',
    goalId: 'W.4',
    emoji: '🚿',
    title: 'Prendre sa douche',
    drTitle: 'Ndouwech',
    arTitle: 'ندوش',
    sub: '10 étapes complètes du déshabillage au séchage',
    sensoryTip: 'Adaptation sensorielle : vérifier la température de l’eau sur la main avant d’entrer, lumière douce, gant doux et serviette chaude.',
    steps: [
      ['preparer', '🧺', 'Préparer ma serviette et mes habits propres', 'Nwejjed l fouta w 7wayji n9iyin', 'نوجد الفوطة وحوايجي نقيين'],
      ['deshabiller', '👕', 'Enlever mes vêtements sales et les mettre au panier', 'N7eyyed 7wayji', 'نحيد حوايجي'],
      ['temperature', '🌡️', 'Ouvrir l’eau et toucher avec la main (eau tiède)', 'N9elleb l ma wach dafi', 'نقلب الما واش دافي'],
      ['mouiller', '🚿', 'Mouiller tout mon corps sous la douche', 'Nfezzeg jismi kamel', 'نفزك جسمي كامل'],
      ['savon', '🧴', 'Mettre le gel douche sur le gant ou mes mains', 'Ndir s-sabon f l gant', 'ندير الصابون فالكيس'],
      ['haut_corps', '💪', 'Laver le cou, les bras, les aisselles et le ventre', 'Nghsel 3on9i w idiya w kerchi', 'نغسل عنقي ويديا وكرشي', 20],
      ['bas_corps', '🦵', 'Laver les parties intimes, les jambes et les pieds', 'Nghsel rejliya w rkabya', 'نغسل رجليا وركابيا', 20],
      ['rincer_corps', '💦', 'Rincer toute la mousse avec l’eau', 'Nchellel s-sabon kamel', 'نشلل الصابون كامل'],
      ['fermer_eau', '🚰', 'Fermer le robinet et sortir doucement', 'Nsedd robini w nkhrej b chwiya', 'نسد الروبيني ونخرج بشوية'],
      ['secher', '🧖‍♀️', 'Bien me sécher partout avec ma serviette', 'Nnechef mzyan b l fouta', 'ننشف مزيان بالفوطة'],
    ].map((s) => stepItem('douche', s)),
  },
  {
    id: 'cheveux',
    goalId: 'W.4',
    emoji: '🧴',
    title: 'Laver les cheveux (Shampoing)',
    drTitle: 'Nghsel cha3ri',
    arTitle: 'نغسل شعري',
    sub: '8 étapes rassurantes pour protéger les yeux et rincer',
    sensoryTip: 'Adaptation sensorielle : gant sec ou visière sur les yeux, regarder le plafond pendant le rinçage, shampoing doux qui ne pique pas.',
    steps: [
      ['gant_yeux', '🙈', 'Prendre un petit gant sec pour protéger mes yeux', 'Ndir fouta sghira 3la 3iniya', 'ندير فوطة صغيرة على عينيا'],
      ['tete_arriere', '🙆‍♀️', 'Pencher un peu la tête en arrière', 'Nrejje3 rasi l lor', 'نرجع راسي للور'],
      ['mouiller_ch', '🚿', 'Mouiller mes cheveux avec l’eau tiède', 'Nfezzeg cha3ri b l ma dafi', 'نفزك شعري بالما دافي'],
      ['noisette', '🧴', 'Mettre un peu de shampoing dans mes mains', 'Ndir chwiya d shampoing f idiya', 'ندير شوية د الشامبوان فيديا'],
      ['masser', '💆‍♀️', 'Frotter et masser doucement toute la tête', 'N7okk rasi b chwiya', 'نحك راسي بشوية', 20],
      ['rincer_ch', '💦', 'Pencher la tête et rincer toute la mousse', 'Nchellel cha3ri mzyan', 'نشلل شعري مزيان', 20],
      ['essorer', '🤲', 'Presser doucement mes cheveux avec les mains', 'N3sser cha3ri b idiya', 'نعصر شعري بيديا'],
      ['serviette_ch', '🧖‍♀️', 'Enrouler et tamponner mes cheveux dans la serviette', 'Nleff cha3ri f l fouta', 'نلف شعري فالفوطة'],
    ].map((s) => stepItem('cheveux', s)),
  },
  {
    id: 'ongles',
    goalId: 'W.4',
    emoji: '💅',
    title: 'Couper ses ongles',
    drTitle: 'Nqette3 dfari',
    arTitle: 'نقطع ضفاري',
    sub: '8 étapes calmes + compteur interactif des 10 doigts / 10 orteils',
    sensoryTip: 'Adaptation sensorielle : couper après le bain (ongles souples), exercer une pression douce sur le bout du doigt avant de couper, compter 1 doigt = 1 étoile.',
    hasNailCounter: true,
    steps: [
      ['apres_bain', '🛁', 'Choisir un moment calme (après la douche ou le bain)', 'Ngles hadya men b3d douch', 'نجلس هادية من بعد الدوش'],
      ['outil', '✂️', 'Prendre le coupe-ongles (ou la lime douce) et un mouchoir', 'Nwejjed m9ess dfar', 'نوجد مقص الضفار'],
      ['asseoir', '🪑', 'S’asseoir confortablement et respirer calmement', 'Ngles mrta7a w ntneffes', 'نجلس مرتاحة ونتنفس'],
      ['main_gauche', '🖐️', 'Donner la première main et couper les 5 ongles un par un (1 à 5)', 'N9ette3 khamsa d sbe3 d lyedd lowla', 'نقطع خمسة د الصباع د اليد اللولة'],
      ['main_droite', '✋', 'Donner l’autre main et couper les 5 ongles un par un (6 à 10)', 'N9ette3 khamsa d sbe3 d lyedd tanya', 'نقطع خمسة د الصباع د اليد التانية'],
      ['pieds', '🦶', 'Couper les ongles des pieds si besoin', 'N9ette3 dfar rejliya', 'نقطع ضفار رجليا'],
      ['limer', '✨', 'Passer la lime douce pour que ça ne gratte pas', 'Nbred dfari b chwiya', 'نبرد ضفاري بشوية'],
      ['jeter_laver', '🗑️', 'Jeter les petits bouts à la poubelle et laver mes mains', 'Nlou7 f zbel w nghsel idiya', 'نلوح فالزبل ونغسل يديا'],
    ].map((s) => stepItem('ongles', s)),
  },
  {
    id: 'mains',
    goalId: 'W.1',
    emoji: '🧼',
    title: 'Se laver les mains (complet)',
    drTitle: 'Nghsel idiya',
    arTitle: 'نغسل يديا',
    sub: '7 étapes OMS : paumes, dos des mains, entre les doigts et séchage',
    sensoryTip: 'Adaptation sensorielle : savon mousse doux sans parfum fort, marchepied stable devant le lavabo.',
    steps: [
      ['ouvrir_eau', '🚰', 'Ouvrir le robinet et mouiller mes deux mains', 'N7ell robini w nfezzeg idiya', 'نحل الروبيني ونفزك يديا'],
      ['mettre_savon', '🧴', 'Mettre une pression de savon dans ma main', 'Ndir s-sabon f idi', 'ندير الصابون فيدي'],
      ['paumes', '👐', 'Frotter les paumes ensemble pour faire de la mousse', 'N7okk kfoufi bjouj', 'نحك كفوفي بجوج', 10],
      ['doigts_dos', '🙌', 'Frotter le dessus des mains, entre les doigts et les pouces', 'N7okk bin sbe3 w lfou9 d yeddi', 'نحك بين الصباع والفوق د يدي', 15],
      ['rincer_m', '💦', 'Rincer toute la mousse sous l’eau', 'Nchellel idiya b l ma', 'نشلل يديا بالما'],
      ['fermer_m', '🛑', 'Fermer le robinet sans gaspiller l’eau', 'Nsedd robini', 'نسد الروبيني'],
      ['essuyer_m', '🧻', 'Bien sécher mes mains avec la serviette propre', 'Nenchep idiya b l fouta', 'ننشف يديا بالفوطة'],
    ].map((s) => stepItem('mains', s)),
  },
  {
    id: 'visage',
    goalId: 'W.2',
    emoji: '😊',
    title: 'Se laver le visage',
    drTitle: 'Nghsel wejhi',
    arTitle: 'نغسل وجهي',
    sub: '6 étapes douces : yeux, joues, front, bouche et séchage',
    sensoryTip: 'Adaptation sensorielle : utiliser un gant tiède essoré plutôt que de jeter de l’eau directement sur le visage si l’enfant craint les éclaboussures.',
    steps: [
      ['eau_tiede', '💧', 'Ouvrir l’eau tiède et mouiller mes mains ou mon gant', 'Nfezzeg idiya wla l fouta b ma dafi', 'نفزك يديا ولا الفوطة بما دافي'],
      ['yeux', '😌', 'Fermer les yeux et laver doucement le coin des yeux', 'Nsedd 3iniya w nmse7hom b chwiya', 'نسد عينيا ونمسحهم بشوية'],
      ['front_joues', '😊', 'Passer l’eau sur le front, les joues et le menton', 'Nghsel jbehti w 7naki', 'نغسل جبهتي وحناكي'],
      ['bouche_nez', '👄', 'Nettoyer autour de la bouche et du nez', 'Nغسل داير بفمي و نيفي', 'نغسل داير بفمي ونيفي'],
      ['fermer_v', '🚰', 'Fermer le robinet', 'Nsedd robini', 'نسد الروبيني'],
      ['tamponner', '🧖‍♀️', 'Tamponner mon visage avec ma serviette douce', 'Nnechef wejhi b l fouta rteba', 'ننشف وجهي بالفوطة رطبة'],
    ].map((s) => stepItem('visage', s)),
  },
  {
    id: 'nez',
    goalId: 'W.2',
    emoji: '🤧',
    title: 'Se moucher le nez',
    drTitle: 'Nمسح نيفي',
    arTitle: 'نمسح نيفي',
    sub: '6 étapes pour apprendre à souffler par le nez et se laver les mains',
    sensoryTip: 'Adaptation sensorielle : mouchoirs extra-doux (boîte illustrée), s’entraîner à souffler une plume avec le nez bouche fermée.',
    steps: [
      ['mouchoir', '🧻', 'Prendre un mouchoir propre dans la boîte', 'Nakhoud kleenex n9i', 'ناخد كلينيكس نقي'],
      ['poser_nez', '👃', 'Plier et poser le mouchoir sur mon nez', 'N7ett kleenex 3la nifi', 'نحط كلينيكس على نيفي'],
      ['souffler', '💨', 'Fermer la bouche et souffler fort par le nez (comme un petit train)', 'Nsedd fommi w nsewwet b nifi', 'نسد فمي ونصوت بنيفي'],
      ['essuyer_nez', '🤏', 'Pincer et essuyer doucement sous le nez', 'Nmse7 nifi b chwiya', 'نمسح نيفي بشوية'],
      ['poubelle', '🗑️', 'Jeter le mouchoir sale dans la poubelle', 'Nlou7 kleenex f zbel', 'نلوح كلينيكس فالزبل'],
      ['laver_apres', '🧼', 'Me laver les mains à l’eau et au savon', 'Nghsel idiya b s-sabon', 'نغسل يديا بالصابون'],
    ].map((s) => stepItem('nez', s)),
  },
  {
    id: 'coiffer',
    goalId: 'W.4',
    emoji: '💇‍♀️',
    title: 'Se coiffer et démêler',
    drTitle: 'Nmchet cha3ri',
    arTitle: 'نمشط شعري',
    sub: '6 étapes sans douleur : spray démêlant, pointes puis racines',
    sensoryTip: 'Adaptation sensorielle : tenir la mèche dans la main pour ne pas tirer sur le cuir chevelu, commencer par le bas des cheveux avec une brosse souple.',
    steps: [
      ['brosse', '🪮', 'Prendre ma brosse douce et mes élastiques / barrettes', 'Nakhoud lmechta w lbandat', 'ناخد المشطة والباندات'],
      ['spray', '💦', 'Mettre un peu d’eau ou de spray démêlant si c’est emmêlé', 'Ndir rchicha d lma 3la cha3ri', 'ندير رشيشة د الما على شعري'],
      ['pointes', '💇‍♀️', 'Tenir la mèche et brosser d’abord le bas des cheveux', 'Nmchet lte7t d cha3ri b chwiya', 'نمشط التحت د شعري بشوية'],
      ['haut_bas', '🙆‍♀️', 'Brosser doucement du haut vers le bas des deux côtés', 'Nmchet men lfou9 l te7t', 'نمشط من الفوق للتحت'],
      ['attacher', '🎀', 'Mettre mon élastique, mon bandeau ou mes barrettes', 'Ndir lbanda wla lfilali', 'ندير الباندة ولا الفيلالي'],
      ['miroir', '🪞', 'Me regarder dans le miroir et ranger la brosse', 'Nchouf rasi f lmraya', 'نشوف راسي فالمراية'],
    ].map((s) => stepItem('coiffer', s)),
  },
  {
    id: 'ablutions',
    goalId: 'W.4',
    emoji: '🤲',
    title: 'Faire les ablutions (Wudu)',
    drTitle: 'Ndir l wudu',
    arTitle: 'ندير الوضوء',
    sub: '9 étapes complètes avant la prière (fidèle au tableau quotidien)',
    sensoryTip: 'Adaptation sensorielle : eau tiède, petite affiche plastifiée près du lavabo, féliciter chaque étape dans l’ordre.',
    steps: [
      ['bismillah', '🤲', 'Dire « Bismillah » et se laver les mains (3 fois)', 'Ngoul bismillah w nghsel idiya 3 mrat', 'نقول بسم الله ونغسل يديا 3 مرات'],
      ['bouche_w', '👄', 'Se rincer la bouche avec de l’eau (3 fois)', 'Nmedmed fommi 3 mrat', 'نمضمض فمي 3 مرات'],
      ['nez_w', '👃', 'Mettre un peu d’eau au bout du nez et souffler (3 fois)', 'Nستنشق الماء 3 مرات', 'نستنشق الما 3 مرات'],
      ['visage_w', '😊', 'Se laver tout le visage (3 fois)', 'Nghsel wejhi 3 mrat', 'نغسل وجهي 3 مرات'],
      ['bras_w', '💪', 'Laver le bras droit puis le bras gauche jusqu’au coude (3 fois)', 'Nghsel yeddi limna w lisra 7tta l lmerfe9', 'نغسل يدي اليمنى واليسرى حتى للمرفق'],
      ['tete_w', '🙆‍♀️', 'Passer les mains mouillées sur la tête (1 fois)', 'Nمسح على راسي', 'نمسح على راسي'],
      ['oreilles_w', '👂', 'Nettoyer doucement les deux oreilles avec les doigts mouillés', 'Nمسح ودنيا بجوج', 'نمسح ودنيا بجوج'],
      ['pieds_w', '🦶', 'Laver le pied droit puis le pied gauche jusqu’aux chevilles (3 fois)', 'Nghsel rejli limna w lisra', 'نغسل رجلي اليمنى واليسرى'],
      ['tapis_w', '🧎‍♀️', 'S’essuyer et aller prier calme sur le tapis', 'Nnechef w nmchi nsalli 3la zerbiya', 'ننشف ونمشي نصلي على الزربية'],
    ].map((s) => stepItem('ablutions', s)),
  },
  {
    id: 'soins',
    goalId: 'W.4',
    emoji: '👂',
    title: 'Oreilles, lèvres & corps propre',
    drTitle: 'ودنيا و حوايجي نقيين',
    arTitle: 'ودنيا وحوايجي نقيين',
    sub: '6 étapes d’hygiène fine : pavillon des oreilles, baume à lèvres, habits propres',
    sensoryTip: 'Adaptation sensorielle : nettoyer uniquement l’extérieur de l’oreille avec le coin d’une serviette humide (jamais de coton-tige profond).',
    steps: [
      ['oreilles_ext', '👂', 'Essuyer doucement le bord et derrière les oreilles avec la serviette', 'Nمسح ودنيا و مورا ودنيا بالفوطة', 'نمسح ودنيا ومورا ودنيا بالفوطة'],
      ['yeux_coins', '👀', 'Vérifier que les yeux et le cou sont bien propres', 'Nمسح عينيا و عنقي', 'نمسح عينيا وعنقي'],
      ['levres', '💄', 'Mettre un peu de baume si mes lèvres sont sèches', 'Ndir mrteb chfayef ila kanou nachfin', 'ندير مرطب الشفاه إلى كانو ناشفين'],
      ['creme', '🧴', 'Mettre un peu de crème douce sur mes mains ou mes joues', 'Ndir crème f idiya w 7naki', 'ندير كريم رطب فيديا وحناكي'],
      ['sous_vet', '🩲', 'Mettre une culotte et des chaussettes propres chaque jour', 'Nlbes t9acher w 7wayej dakhliya n9iya', 'نلبس تقاشر وملابس داخلية نقية'],
      ['sentir_bon', '🌸', 'Vérifier que mes vêtements sont propres et sentir bon', 'Nلبس حوايج نقيين و زوينين', 'نلبس حوايج نقيين وزوينين'],
    ].map((s) => stepItem('soins', s)),
  },
];

export const getHygieneRoutine = (id) => HYGIENE_ROUTINES.find((r) => r.id === id) || HYGIENE_ROUTINES[0];

const arabicVoice = (lang) => lang === 'dr' && hasArabicVoice();
const stepLabel = (step, lang) => (lang === 'dr' ? step.dr : step.fr);
const sayStep = (step, lang) => (arabicVoice(lang) && step.ar ? speak(step.ar, { lang: 'ar' }) : speak(step.fr));
const stepVisual = (step, button = false) => renderVisual({ vkey: step.vkey, emoji: step.emoji, label: step.fr }, { button });
function shake(el) { el.classList.remove('shake-soft'); void el.offsetWidth; el.classList.add('shake-soft'); }

// Filtrage progressif selon le niveau ABLLS-R (1–150 : 4 étapes clés ; 151–500 : 6 étapes ; 501+ : toutes les étapes).
function activeStepsFor(routine) {
  const lvl = levelOf(routine.goalId || 'W.4').currentLevel;
  const all = routine.steps;
  if (lvl <= 150 && all.length > 4) {
    const idx = [0, Math.floor(all.length / 3), Math.floor((2 * all.length) / 3), all.length - 1];
    return [...new Set(idx)].map((i) => all[i]);
  }
  if (lvl <= 500 && all.length > 6) {
    return all.slice(0, 6);
  }
  return all;
}

// Compteur sensoriel spécial « 10 ongles » (1 étoile par doigt coupé calmement).
function nailCounterWidget(lang) {
  let mode = 'mains';
  const done = new Set();
  const grid = h('div', { class: 'order-slots' });
  const msg = h('p', { class: 'note' }, 'Touche chaque doigt dès que son ongle est coupé calmement :');
  const draw = () => {
    grid.replaceChildren(...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      const isOn = done.has(n);
      return h('button', {
        type: 'button',
        class: `order-slot${isOn ? ' on' : ''}`,
        onclick: () => {
          if (isOn) done.delete(n); else { done.add(n); playBeep(); speak(String(n), { lang: arabicVoice(lang) ? 'ar' : 'fr' }); }
          if (done.size === 10) { playClap(); speak(arabicVoice(lang) ? 'برافو، سالينا العشرة كاملين!' : 'Bravo, les 10 ongles sont coupés !'); }
          draw();
        },
      }, isOn ? '⭐' : `${mode === 'mains' ? '🖐️' : '🦶'} ${n}`);
    }));
  };
  draw();
  return h('div', { class: 'card-box stack' },
    h('div', { class: 'row between' },
      h('strong', {}, '💅 Compteur calme : 1 ongle coupé = 1 ⭐'),
      h('div', { class: 'row' },
        btn('🖐️ 10 doigts', () => { mode = 'mains'; done.clear(); draw(); }, 'ghost tiny'),
        btn('🦶 10 orteils', () => { mode = 'pieds'; done.clear(); draw(); }, 'ghost tiny'))),
    msg, grid);
}

// Mode 1 : 🧩 Puzzle séquentiel (remettre les étapes de la routine dans l'ordre)
function hygienePuzzle(routine, ctx) {
  const root = h('div', { class: 'stack' });
  const start = () => {
    const steps = activeStepsFor(routine);
    let next = 0;
    let errors = 0;
    const slots = steps.map((_, i) => h('div', { class: 'puzzle-slot' }, h('span', { class: 'slot-num' }, String(i + 1))));
    const after = h('div', { class: 'stack' });
    const place = (card, step, i) => {
      if (i !== next) { errors += 1; shake(card); return false; }
      slots[i].replaceChildren(stepVisual(step), h('span', { class: 'label' }, stepLabel(step, ctx.lang)));
      slots[i].classList.add('filled');
      card.remove();
      next += 1;
      sayStep(step, ctx.lang);
      if (next === steps.length) {
        playClap();
        recordTrial(routine.goalId, errors ? 'prompt' : 'plus', { item: `${routine.id}-puzzle-${steps.length}`, meta: { routine: routine.id, game: 'puzzle', errors } });
        after.replaceChildren(praise(errors ? 'Bravo, toutes les étapes sont dans l’ordre !' : 'Parfait, sans aucune erreur !'), btn('🔄 Rejouer', start, 'primary'));
      }
      return true;
    };
    let order = shuffle(steps.map((_, i) => i));
    for (let k = 0; k < 5 && order.every((v, i) => v === i); k += 1) order = shuffle(order);
    const tray = h('div', { class: 'puzzle-tray' }, order.map((i) => {
      const step = steps[i];
      const card = h('button', { type: 'button', class: 'choice toilet-card' }, stepVisual(step), h('span', { class: 'label' }, stepLabel(step, ctx.lang)));
      let moved = false;
      card.onclick = () => { if (!moved) place(card, step, i); moved = false; };
      draggable(card, {
        onStart: () => { moved = false; },
        onMove: ({ dx, dy }) => { if (Math.hypot(dx, dy) > 10) moved = true; },
        onDrop: ({ x, y }) => {
          if (!moved) return false;
          const target = hitTest(x, y, slots);
          if (!target) return false;
          if (slots.indexOf(target) !== next) { errors += 1; shake(card); return false; }
          return place(card, step, i);
        },
      });
      return card;
    }));
    root.replaceChildren(
      h('p', { class: 'ask' }, `Remets les étapes de « ${routine.title} » dans l’ordre`, btn('🔊', () => speak(`Remets les étapes dans l’ordre`), 'ghost tiny')),
      h('div', { class: 'puzzle-slots', style: { '--cols': Math.min(steps.length, 3) } }, slots),
      tray,
      after);
  };
  start();
  return root;
}

// Mode 2 : 🤔 Quelle est l'étape suivante ?
function hygieneNextStep(routine, ctx) {
  const root = h('div', { class: 'stack' });
  const round = () => {
    const steps = activeStepsFor(routine);
    const n = Math.floor(Math.random() * (steps.length - 1));
    const [current, answer] = [steps[n], steps[n + 1]];
    const near = [steps[n - 1], steps[n + 2]].filter(Boolean);
    const far = shuffle(steps.filter((s) => ![current, answer, ...near].includes(s)));
    const distractors = [...near, ...far].slice(0, steps.length >= 6 ? 3 : 2);
    const question = `Je viens de : ${current.fr.toLowerCase()}. Qu’est-ce que je fais ensuite ?`;
    const darija = `كملت: ${current.ar}. شنو ندير من بعد؟`;
    const ask = () => (arabicVoice(ctx.lang) ? speak(darija, { lang: 'ar' }) : speak(question));
    const after = h('div', { class: 'row center' });
    ask();
    root.replaceChildren(
      h('p', { class: 'ask' }, question, btn('🔊', ask, 'ghost tiny')),
      ctx.lang === 'dr' ? h('p', { class: 'note', dir: 'rtl' }, darija) : null,
      h('div', { class: 'big-card model-card' }, stepVisual(current), h('span', { class: 'label' }, stepLabel(current, ctx.lang))),
      choiceBoard({
        cols: 2,
        praise: 'Bravo !',
        choices: [answer, ...distractors].map((s) => ({
          correct: s === answer,
          label: stepLabel(s, ctx.lang),
          render: () => stepVisual(s),
        })),
        onAnswer: (ok) => {
          recordTrial(routine.goalId, ok ? 'plus' : 'prompt', { item: `${routine.id}-next-${answer.id}`, meta: { routine: routine.id, game: 'next' } });
          after.replaceChildren(btn('➜ Question suivante', round, 'primary'));
        },
      }),
      after);
  };
  round();
  return root;
}

// Mode 3 : ✅ En vrai dans la salle de bain (accompagnement étape par étape + minuteur de bulles + photos personnalisables)
function hygieneReal(routine, ctx) {
  const root = h('div', { class: 'stack' });
  const steps = routine.steps;
  let index = 0;
  let timer = 0;
  if (ctx.onCleanup) ctx.onCleanup(() => clearInterval(timer));

  const go = (i) => {
    index = i;
    show();
    if (steps[index]) sayStep(steps[index], ctx.lang);
    else speak(arabicVoice(ctx.lang) ? 'برافو، كلشي نقي!' : `Bravo ${firstName()}, tout est propre !`);
  };

  const stepBubbles = (seconds, done) => {
    let left = seconds;
    const count = h('strong', {}, String(left));
    const fill = h('span', { class: 'bubble-fill', style: { animationDuration: `${seconds}s` } });
    timer = setInterval(() => {
      if (!root.isConnected) { clearInterval(timer); return; }
      left -= 1;
      count.textContent = String(Math.max(0, left));
      if (left > 0) return;
      clearInterval(timer);
      playBeep();
      done();
    }, 1000);
    return h('div', { class: 'bubble-timer' }, h('p', {}, '🫧 Sablier de mousse — ', count, ' secondes'), h('div', { class: 'bubble-bar' }, fill));
  };

  function show() {
    clearInterval(timer);
    if (index >= steps.length) {
      playClap();
      root.replaceChildren(
        praise(`${routine.emoji} ${routine.title} terminé !`),
        ratingPanel(routine.goalId, {
          item: `hygiene-${routine.id}`,
          meta: { routine: routine.id, mode: 'reel' },
          labels: { plus: '✅ Seule', prompt: '👉 Avec aide / rappel', minus: '❌ Difficile aujourd’hui' },
          onRated: () => { index = 0; show(); },
        }));
      return;
    }
    const step = steps[index];
    root.replaceChildren(
      h('div', { class: 'order-slots' }, steps.map((_, j) => h('button', {
        type: 'button',
        class: `order-slot${j < index ? ' on' : ''}`,
        onclick: () => go(j),
      }, String(j + 1)))),
      h('button', { type: 'button', class: 'big-card toilet-now', onclick: () => sayStep(step, ctx.lang) },
        stepVisual(step, true),
        h('span', { class: 'label' }, stepLabel(step, ctx.lang)),
        ctx.lang === 'dr' ? h('small', { dir: 'rtl' }, step.ar) : h('small', { class: 'note' }, step.dr)),
      step.timerSec ? stepBubbles(step.timerSec, () => go(index + 1)) : null,
      routine.hasNailCounter && (step.id === 'main_gauche' || step.id === 'main_droite' || step.id === 'pieds')
        ? nailCounterWidget(ctx.lang)
        : null,
      btn('✅ C’est fait !', () => go(index + 1), 'primary wide'),
      index > 0 ? btn('↩︎ Étape précédente', () => go(index - 1), 'ghost tiny') : null);
  }

  show();
  return root;
}

// Vue complète d'une routine d'hygiène spécifique (avec ses 3 jeux + astuce sensorielle)
export function hygieneRoutineView(routineId, ctx = {}, extraGame = null) {
  const routine = getHygieneRoutine(routineId);
  const c = { lang: 'fr', ...ctx };
  const tabs = [
    ['✅ En vrai (Pas à pas)', () => hygieneReal(routine, c)],
    ['🧩 Puzzle d’ordre', () => hygienePuzzle(routine, c)],
    ['🤔 Étape suivante ?', () => hygieneNextStep(routine, c)],
  ];
  if (extraGame) tabs.unshift([extraGame.label, extraGame.render]);

  return h('div', { class: 'stack' },
    h('div', { class: 'card-box' },
      h('h3', {}, `${routine.emoji} ${c.lang === 'dr' ? `${routine.drTitle} · ${routine.arTitle}` : routine.title}`),
      h('p', { class: 'note' }, routine.sub),
      h('p', { class: 'note' }, `💡 ${routine.sensoryTip}`),
      h('p', { class: 'note' }, '📷 En mode parent, touchez le petit 📷 d’une étape dans « En vrai » pour mettre votre vraie photo.')),
    modeTabs(tabs));
}

// Grand Hub « 🫧 Hygiène & Soins du corps » (regroupe les 10 routines détaillées)
export function hygieneHubScreen(ctx = {}, initialRoutineId = null) {
  const c = { lang: 'fr', ...ctx };
  let activeId = initialRoutineId || null;
  const holder = h('div', { class: 'stack' });

  const render = () => {
    if (!activeId) {
      holder.replaceChildren(
        h('div', { class: 'card-box' },
          h('h3', {}, '🫧 Hygiène & Soins du corps (10 routines détaillées)'),
          h('p', { class: 'note' }, 'Chaque soin est découpé en petites étapes rassurantes (analyse de tâches ABA) avec Puzzle, Quiz de l’étape suivante et accompagnement en salle de bain.')),
        h('div', { class: 'section-grid' }, HYGIENE_ROUTINES.map((r) => h('button', {
          type: 'button',
          class: 'section-tile',
          onclick: () => { activeId = r.id; render(); },
        },
        h('span', { class: 'emoji' }, r.emoji),
        h('strong', {}, c.lang === 'dr' ? r.drTitle : r.title),
        h('small', { class: 'note' }, `${r.steps.length} étapes`)))));
      return;
    }
    holder.replaceChildren(
      h('div', { class: 'row between' },
        btn('← Toutes les routines d’hygiène (10)', () => { activeId = null; render(); }, 'ghost'),
        h('div', { class: 'chip-grid' }, HYGIENE_ROUTINES.map((r) => h('button', {
          type: 'button',
          class: `abc-chip${r.id === activeId ? ' on' : ''}`,
          onclick: () => { activeId = r.id; render(); },
        }, `${r.emoji} ${r.title.split(' ')[0]}`)))),
      hygieneRoutineView(activeId, c));
  };

  render();
  return holder;
}
