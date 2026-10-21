/**
 * Gestion des pages d'un site : ordre, renommage, page d'accueil, duplication, suppression, droits par page (CCTP 58B).
 * Fonctions pures sur le tableau `pages` du site ; port de `model/page.ts` et `controllers/edit.ts` (AngularJS).
 */
export interface AdminPage {
  title: string;
  titleLink: string;
  index?: number;
  published?: boolean;
  contrib?: string[];
  [extra: string]: unknown;
}

/** Position de chaque page dans l'ordre du tableau (`index` = rang). */
export const reindexPages = <P extends AdminPage>(pages: P[]): Array<P & { index: number }> => pages.map((p, i) => ({ ...p, index: i }));

/**
 * Lien d'une page à partir de son titre, comme l'éditeur historique : sans espaces ni ponctuation, sans accents, en
 * minuscules, suffixe `-1`, `-2`… si le lien existe déjà. Ex. « Ma page été » → `mapageete`.
 */
export function pageLink(title: string, taken: string[]): string {
  const base = encodeURIComponent(
    title
      .replace(/ |:|\?|#|%|\$|£|\^|\*|€|°|\(|\)|\[|\]|§|'|"|&|ç|ù|`|=|\+|<|@/g, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase(),
  );
  if (!taken.includes(base)) return base;
  let i = 1;
  while (taken.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Monte (-1) ou descend (+1) une page ; sans effet en butée. */
export function movePage<P extends AdminPage>(pages: P[], i: number, dir: -1 | 1): P[] {
  const to = i + dir;
  if (i < 0 || i >= pages.length || to < 0 || to >= pages.length) return pages;
  const next = [...pages];
  [next[i], next[to]] = [next[to], next[i]];
  return reindexPages(next) as P[];
}

/** Renomme une page ; son lien ne change pas (les adresses déjà diffusées restent valables). Titre vide : sans effet. */
export function renamePage<P extends AdminPage>(pages: P[], i: number, title: string): P[] {
  const clean = title.trim();
  if (!clean || !pages[i]) return pages;
  return pages.map((p, j) => (j === i ? { ...p, title: clean } : p));
}

/** Copie d'une page en fin de liste : titre « … (copie) », lien unique, même contenu. */
export function duplicatePage<P extends AdminPage>(pages: P[], i: number, copyLabel: string): P[] {
  const src = pages[i];
  if (!src) return pages;
  const title = `${src.title} (${copyLabel})`;
  const copy = JSON.parse(JSON.stringify(src)) as P;
  copy.title = title;
  copy.titleLink = pageLink(title, pages.map((p) => p.titleLink));
  return reindexPages([...pages, copy]) as P[];
}

/** Supprime une page ; si c'était la page d'accueil, l'accueil devient la première page restante (ou aucune). */
export function removePage<P extends AdminPage>(pages: P[], i: number, landingPage: string | undefined): { pages: P[]; landingPage: string | undefined } {
  const removed = pages[i];
  if (!removed) return { pages, landingPage };
  const next = reindexPages(pages.filter((_, j) => j !== i)) as P[];
  return { pages: next, landingPage: landingPage === removed.titleLink ? next[0]?.titleLink : landingPage };
}

/** Une page peut-elle être supprimée / ses droits gérés par cet utilisateur : propriétaire du site ou de la page, ou gestionnaire. */
export function canManageSite(
  site: { owner?: { userId: string }; shared?: Array<Record<string, unknown>> },
  page: { owner?: unknown } | undefined,
  userId: string | undefined,
  groupIds: string[] = [],
): boolean {
  if (!userId) return false;
  if (site.owner?.userId === userId || page?.owner === userId) return true;
  return (site.shared ?? []).some((s) => {
    const mine = s.userId === userId || (typeof s.groupId === 'string' && groupIds.includes(s.groupId));
    return mine && Object.keys(s).some((k) => /\|manager$/.test(k) && s[k] === true);
  });
}

export interface RightsEntry {
  id: string;
  name: string;
  type: 'group' | 'user';
  checked: boolean;
}

/**
 * Lignes de la fenêtre des droits d'une page : les groupes et utilisateurs avec qui le site est partagé, cochés quand ils
 * font partie des `contrib` de la page. Liste vide de coches = tous les contributeurs du site (comportement historique).
 */
export function rightsEntries(
  share: { groups?: { visibles?: Array<{ id: string; name?: string }>; checked?: Record<string, unknown> }; users?: { visibles?: Array<{ id: string; username?: string; firstName?: string; lastName?: string }>; checked?: Record<string, unknown> } },
  selected: string[] = [],
): RightsEntry[] {
  const groups = (share.groups?.visibles ?? []).filter((g) => share.groups?.checked?.[g.id]).map((g) => ({ id: g.id, name: g.name ?? g.id, type: 'group' as const, checked: selected.includes(g.id) }));
  const users = (share.users?.visibles ?? []).filter((u) => share.users?.checked?.[u.id]).map((u) => ({ id: u.id, name: u.username || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.id, type: 'user' as const, checked: selected.includes(u.id) }));
  return [...groups, ...users];
}
