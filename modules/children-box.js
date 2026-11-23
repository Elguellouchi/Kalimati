// v10.36 : encadré « Enfants sur ce téléphone » (Progrès, mode parent).
// Passer d'un enfant à l'autre rouvre Kalimati sur la mémoire de cet enfant (touche voulue par l'adulte).
import { h, btn } from './util.js';
import { listChildren, activeChildId, setActiveChild, addChild, renameChild, removeChild, recoverChildren, MAIN_ID } from './child-profiles.js';
import { firstName } from './aba.js';

const EMOJIS = ['🙂', '👧', '👦', '🧒', '🐻', '🦊', '🐱', '🦁', '🐢', '⭐'];

export function childrenBox() {
  const body = h('div', { class: 'stack' });
  const msg = h('p', { class: 'note', 'aria-live': 'polite' }, '');
  const draw = () => {
    const active = activeChildId();
    const rows = listChildren().map((c) => {
      const shown = c.name || (c.id === active ? firstName() : '') || (c.id === MAIN_ID ? 'Premier enfant' : 'Enfant');
      const isActive = c.id === active;
      let armed = false;
      const del = c.id === MAIN_ID || isActive ? null : btn('🗑️', async () => {
        if (!armed) { armed = true; del.textContent = `Effacer tout ${shown} ?`; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 4000); return; }
        const ok = await removeChild(c.id);
        msg.textContent = ok ? `${shown} et toutes ses données sont effacés de ce téléphone.` : 'Effacement impossible pour le moment. Réessayez.';
        draw();
      }, 'ghost tiny');
      if (del) del.setAttribute('aria-label', `Effacer ${shown} et toutes ses données`);
      const nameInput = h('input', { type: 'text', maxlength: 30, value: c.name, placeholder: shown, 'aria-label': `Prénom affiché pour ${shown}` });
      nameInput.addEventListener('change', () => { renameChild(c.id, nameInput.value, c.emoji); msg.textContent = 'Prénom enregistré ✔'; });
      return h('li', { class: `child-row${isActive ? ' active' : ''}` },
        h('span', { class: 'child-emoji', 'aria-hidden': 'true' }, c.emoji), nameInput,
        isActive ? h('strong', { class: 'child-here' }, '✔ ouvert') : btn('Ouvrir', () => { if (setActiveChild(c.id)) location.reload(); }, 'primary tiny'),
        del);
    });
    const newName = h('input', { type: 'text', maxlength: 30, placeholder: 'Prénom', 'aria-label': 'Prénom du nouvel enfant' });
    const newEmoji = h('select', { 'aria-label': 'Dessin du nouvel enfant' }, EMOJIS.map((e) => h('option', { value: e }, e)));
    const add = btn('➕ Ajouter un enfant', () => {
      if (!newName.value.trim()) { msg.textContent = 'Écrivez un prénom.'; return; }
      const id = addChild(newName.value, newEmoji.value);
      msg.textContent = id ? `${newName.value.trim()} est ajouté. Touchez « Ouvrir » pour préparer ses cartes.` : '8 enfants au maximum.';
      draw();
    }, 'ghost tiny');
    body.replaceChildren(
      h('p', { class: 'note' }, 'Chaque enfant a ses propres cartes, photos, voix, progrès et sauvegarde. Rien n’est mélangé et rien ne part du téléphone. Gratuit, sans abonnement.'),
      h('ul', { class: 'child-list' }, rows),
      h('div', { class: 'row wrap' }, newEmoji, newName, add), msg);
  };
  draw();
  recoverChildren().then(() => draw()).catch(() => {});
  return h('details', { class: 'card-box children-box' }, h('summary', {}, '👧👦 Enfants sur ce téléphone'), body);
}
