import * as core from './lexique-core.js';
import { CATEGORIES as baseCategories } from '../data.js';
import { LEXIQUE } from './lexique-data.js';

export { LEXIQUE };
export const allCategories = [...baseCategories, ...LEXIQUE.categories.filter((category) => !baseCategories.some((base) => base.id === category.id))];
export const planLexiqueApplication = core.planLexiqueApplication;
export const isLexicallyCustomized = core.isLexicallyCustomized;
export const matchesHistoricalCard = core.matchesHistoricalCard;
export const cardPassesReviewFilter = core.cardPassesReviewFilter;
export const computeLexiqueStats = core.computeLexiqueStats;
export const computeReviewStatus = core.computeReviewStatus;
