/** Fonctions pures du module Pages (testables). */

/** Page créée par l'éditeur de mise en page AngularJS (grille de cellules) : non modifiable ici. */
export function isGridPage(page: { rows?: unknown[] }): boolean {
  return Array.isArray(page.rows) && page.rows.length > 0;
}

/** Lien (slug) d'une page à partir de son titre : « Ma page été » → « ma-page-ete ». */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
