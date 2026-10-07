/** Fonctions pures du module Pages (testables). */

/** Extrait un aperçu texte (sans HTML) d'un contenu de page, tronqué à `max` caractères. */
export function pagePreview(html?: string, max = 120): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
