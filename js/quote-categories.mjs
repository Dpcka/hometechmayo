import {CATEGORIES} from './pricing-catalogue.mjs';
// Stable public category links; rates and rules remain in pricing-catalogue.mjs.
const ids = ['furniture', 'tv-mounting', 'handyman', 'outdoor', 'computer', 'wifi', 'smart-home', 'property', 'flooring', 'kitchen', 'shelving', 'doors', 'bathroom', 'ventilation', 'blinds', 'furniture-fitting', 'wall-panels'];
export const QUOTE_CATEGORIES = ids.map((id, index) => ({id, name: CATEGORIES[index]}));
export const categoryById = id => QUOTE_CATEGORIES.find(category => category.id === id);
export const quoteLink = id => `quote.html?category=${encodeURIComponent(id)}`;
