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

/** Une page est publiée sauf si son drapeau vaut explicitement `false` (pages anciennes sans drapeau = publiées). */
export function isPagePublished(page: { published?: boolean }): boolean {
  return page.published !== false;
}

/** Pages visibles : les pages non publiées ne le sont que pour qui peut modifier le site. Ex. visiteur : seulement les publiées. */
export function visiblePages<P extends { published?: boolean }>(pages: P[], editMode: boolean): P[] {
  return pages.filter((p) => isPagePublished(p) || editMode);
}

/** Page d'accueil : celle désignée par `landingPage` si elle est visible, sinon la première page visible. */
export function landingPageOf<P extends { titleLink?: string; published?: boolean }>(pages: P[], landingPage: string | undefined, editMode: boolean): P | undefined {
  const visible = visiblePages(pages, editMode);
  return visible.find((p) => p.titleLink === landingPage) ?? visible[0];
}

/** Page demandée par son lien ; à défaut (lien inconnu ou page non visible), la page d'accueil. */
export function matchingPage<P extends { titleLink?: string; published?: boolean }>(pages: P[], link: string | undefined, landingPage: string | undefined, editMode: boolean): P | undefined {
  if (link) {
    const found = visiblePages(pages, editMode).find((p) => p.titleLink === link);
    if (found) return found;
  }
  return landingPageOf(pages, landingPage, false);
}

/**
 * L'utilisateur peut-il modifier le site ? Propriétaire, ou partage (à lui ou à l'un de ses groupes) portant un droit
 * `…|update` ou `…|manager`. Ex. contributeur via le groupe « Enseignants » du site.
 */
export function canUpdateSite(
  site: { owner?: { userId: string }; shared?: Array<Record<string, unknown>> },
  userId: string | undefined,
  groupIds: string[] = [],
): boolean {
  if (!userId) return false;
  if (site.owner?.userId === userId) return true;
  return (site.shared ?? []).some((s) => {
    const mine = s.userId === userId || (typeof s.groupId === 'string' && groupIds.includes(s.groupId));
    return mine && Object.keys(s).some((k) => /\|(update|manager)$/.test(k) && s[k] === true);
  });
}

/** Poids d'un type de contenu : plus il est élevé, plus la page est longue à charger (mêmes valeurs que l'éditeur historique). */
const CELL_WEIGHTS: Record<string, number> = { sniplet: 5, text: 0.3, image: 1, sound: 1, video: 5, grid: 3 };

/** Au-delà de ce poids, l'éditeur prévient que la page risque d'être longue à télécharger. */
export const HEAVY_PAGE_WEIGHT = 17;

/** Poids d'une page : somme des poids de ses cellules. Ex. 2 vidéos + 1 texte → 10,3. */
export function pageWeight(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  let total = 0;
  for (const row of rows as Array<{ cells?: Array<{ media?: { type?: string } }> }>) {
    for (const cell of row.cells ?? []) total += CELL_WEIGHTS[cell.media?.type ?? ''] ?? 0;
  }
  return Math.round(total * 10) / 10;
}

/** Adresse d'une page à partager, au format de l'éditeur historique (`/pages#/website/<id>/<lien>`, `/pages/p/website#…` pour un site public). */
export function pageUrl(origin: string, site: { _id: string; visibility?: string }, link: string): string {
  return `${origin}${site.visibility === 'PUBLIC' ? '/pages/p/website' : '/pages'}#/website/${site._id}/${link}`;
}
