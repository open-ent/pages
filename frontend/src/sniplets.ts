/**
 * Contenus interactifs d'une cellule (« sniplets ») : affichage d'une ressource d'une autre application dans la page.
 * Quatre sont reconnus : articles d'un blog, cours/wiki, forum, message libre. Les routes REST sont celles des
 * applications voisines ; un sniplet inconnu est conservé tel quel par l'éditeur sans être affiché.
 */
export type SnipletKind = 'articles' | 'wiki' | 'forum' | 'message' | 'navigation';

export interface SnipletSource {
  application: string;
  template: string;
  source?: { _id?: string; content?: string; links?: Array<{ text?: string; title?: string; href?: string; external?: boolean; index?: number }> } & Record<string, unknown>;
}

export const SNIPLET_KINDS: Array<{ kind: SnipletKind; application: string; template: string; labelKey: string; defaultLabel: string }> = [
  { kind: 'articles', application: 'blog', template: 'articles', labelKey: 'pages.sniplet.articles', defaultLabel: "Articles d'un blog" },
  { kind: 'wiki', application: 'wiki', template: 'wiki', labelKey: 'pages.sniplet.wiki', defaultLabel: 'Un cours (wiki)' },
  { kind: 'forum', application: 'forum', template: 'forum', labelKey: 'pages.sniplet.forum', defaultLabel: 'Un forum' },
];

/** Nature d'un sniplet à partir de son application et de son modèle ; `undefined` si non reconnu. */
export function kindOf(src: Partial<SnipletSource> | undefined): SnipletKind | undefined {
  if (!src) return undefined;
  if (src.application === 'community' && src.template === 'message') return 'message';
  if (src.application === 'pages' && src.template === 'navigation') return 'navigation';
  return SNIPLET_KINDS.find((k) => k.application === src.application && k.template === src.template)?.kind;
}

/** Source à enregistrer dans la cellule pour une ressource choisie. Ex. blog « b1 » → `{ application: 'blog', template: 'articles', source: { _id: 'b1' } }`. */
export function toSource(kind: Exclude<SnipletKind, 'message' | 'navigation'>, resourceId: string): SnipletSource {
  const def = SNIPLET_KINDS.find((k) => k.kind === kind)!;
  return { application: def.application, template: def.template, source: { _id: resourceId } };
}

export interface Choice {
  id: string;
  label: string;
}
export interface Article { id: string; title: string; content: string }
export interface WikiView { title: string; index?: { title: string; content: string }; others: string[] }
export interface ForumView { subjects: string[] }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} : ${res.status}`);
  return (await res.json()) as T;
}

/** Ressources que l'utilisateur peut choisir pour un type de sniplet. */
export async function listChoices(kind: Exclude<SnipletKind, 'message' | 'navigation'>): Promise<Choice[]> {
  if (kind === 'articles') return (await getJson<Array<{ _id: string; title: string }>>('/blog/list/all')).map((b) => ({ id: b._id, label: b.title }));
  if (kind === 'wiki') return (await getJson<Array<{ _id: string; title: string }>>('/wiki/list')).map((w) => ({ id: w._id, label: w.title }));
  return (await getJson<Array<{ _id: string; name: string }>>('/forum/categories')).map((c) => ({ id: c._id, label: c.name }));
}

/** Articles publiés d'un blog, du plus récent au plus ancien (5 au plus). */
export async function loadArticles(blogId: string): Promise<Article[]> {
  const posts = await getJson<Array<{ _id: string; title: string; content?: string; state?: string; modified?: { $date: string } }>>(
    `/blog/post/list/all/${blogId}?content=true&comments=false&nbComments=0`,
  );
  return posts
    .filter((p) => p.state === 'PUBLISHED')
    .sort((a, b) => (b.modified?.$date ?? '').localeCompare(a.modified?.$date ?? ''))
    .slice(0, 5)
    .map((p) => ({ id: p._id, title: p.title, content: p.content ?? '' }));
}

/** Cours/wiki : la page d'accueil (contenu) et les titres des autres pages visibles. */
export async function loadWiki(wikiId: string): Promise<WikiView> {
  const data = await getJson<{ pages?: Array<{ title: string; content?: string; isIndex?: boolean; isVisible?: boolean }> }>(`/wiki/${wikiId}/pages?content=true`);
  const pages = (data.pages ?? []).filter((p) => p.isVisible !== false);
  const index = pages.find((p) => p.isIndex) ?? pages[0];
  return {
    title: index?.title ?? '',
    index: index ? { title: index.title, content: index.content ?? '' } : undefined,
    others: pages.filter((p) => p !== index).map((p) => p.title),
  };
}

/** Forum : les sujets de la catégorie. */
export async function loadForum(categoryId: string): Promise<ForumView> {
  const subjects = await getJson<Array<{ title: string }>>(`/forum/category/${categoryId}/subjects`);
  return { subjects: subjects.map((s) => s.title) };
}
