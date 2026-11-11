// Connecteur optionnel de pictogrammes ARASAAC (banque libre, licence CC BY-NC-SA, auteur Sergio Palao).
// Seul le mot cherché est envoyé ; l'image choisie est ensuite gardée dans le téléphone (fonctionne hors ligne).

const API = 'https://api.arasaac.org/v1/pictograms/fr/search/';
const IMAGE = (id) => `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;
const MAX_RESULTS = 12;

export const ARASAAC_CREDIT = 'Pictogrammes : Sergio Palao, ARASAAC (CC BY-NC-SA).';

export async function searchPictograms(word) {
  if (!navigator.onLine) throw new Error('Pas de connexion internet.');
  const query = encodeURIComponent(word.trim().toLowerCase());
  if (!query) return [];
  const response = await fetch(`${API}${query}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('ARASAAC ne répond pas. Réessayez plus tard.');
  const results = await response.json();
  return (Array.isArray(results) ? results : []).slice(0, MAX_RESULTS).map((p) => ({ id: p._id, url: IMAGE(p._id) }));
}

export async function downloadPictogram(id) {
  const response = await fetch(IMAGE(id));
  if (!response.ok) throw new Error('Image introuvable.');
  return response.blob();
}
