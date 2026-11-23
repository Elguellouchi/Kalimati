// Glisser-déposer au doigt (pointer events), utilisé par le PECS, le tri, le puzzle et les syllabes.

export function hitTest(x, y, elements) {
  return elements.find((el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }) || null;
}

// Rend un élément déplaçable. onDrop({ x, y }) renvoie true pour garder la position, sinon retour doux.
export function draggable(el, { onStart, onMove, onDrop } = {}) {
  let start = null;
  el.style.touchAction = 'none';

  const down = (event) => {
    if (start) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    el.setPointerCapture(event.pointerId);
    el.classList.add('dragging');
    el.style.transition = 'none';
    if (onStart) onStart(event);
  };
  const move = (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    if (onMove) onMove({ x: event.clientX, y: event.clientY, dx, dy });
  };
  const up = (event) => {
    if (!start || event.pointerId !== start.id) return;
    start = null;
    el.classList.remove('dragging');
    const keep = onDrop ? onDrop({ x: event.clientX, y: event.clientY }) : false;
    el.style.transition = 'transform .35s ease';
    if (!keep) el.style.transform = '';
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}
