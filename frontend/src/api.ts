// Client REST du module Pages (sites web) — session ENT, même origine.
// Mêmes endpoints que la version AngularJS (backend Java inchangé). XSRF sur mutations.

/** Une page d'un site (contenu HTML embarqué dans le document du site). */
export interface Page {
  title: string;
  content?: string;
  /** Lien (slug) de la page, utilisé par la navigation et le site public. */
  titleLink?: string;
  /** Grille de mise en page créée par l'éditeur AngularJS : le React ne sait pas la modifier. */
  rows?: unknown[];
  published?: boolean;
  index?: number;
  [extra: string]: unknown;
}

/** Un site web : métadonnées + tableau de pages embarquées. */
export interface Website {
  _id: string;
  title: string;
  description?: string;
  pages?: Page[];
  owner?: { userId: string; displayName: string };
  /** Dates Mongo au format {$date: ISO}. */
  modified?: { $date: string };
  created?: { $date: string };
  /** Corbeille : site mis de côté (restaurable), cf. modèle Angular. */
  trashed?: boolean;
  /** `PUBLIC` : site ouvert à tous (adresse `/pages/p/website`). */
  visibility?: string;
  /** Lien (`titleLink`) de la page d'accueil du site. */
  landingPage?: string;
  /** Partages : une entrée par utilisateur ou groupe, avec les droits accordés (clés `...|update`, `...|manager`). */
  shared?: Array<Record<string, unknown>>;
  /** Publication dans les applications, par structure (un administrateur local choisit les groupes qui voient le site). */
  published?: Record<string, PublishedEntry>;
}

/** Publication d'un site dans une structure : application externe, rôle associé et groupes autorisés. */
export interface PublishedEntry {
  application: { id: string };
  role: { id: string };
  groups: Array<{ id: string; name: string }>;
}

/** Groupe d'une structure et rôles qu'il porte (annuaire d'applications). */
export interface RoleGroup {
  id: string;
  name: string;
  roles?: string[];
}

/** Dossier de rangement des sites (collection pagesFolders). */
export interface Folder {
  _id: string;
  name: string;
  /** 'root' ou _id du dossier parent. */
  parentId?: string;
  trashed?: boolean;
  /** Sites rangés dans ce dossier. */
  websitesIds?: string[];
  owner?: { userId: string; displayName: string };
}

// ── Partage (modèle entcore batch) ───────────────────────────────────────────
export interface ShareAction {
  name: string[];
  displayName: string;
  type: string;
}
export interface ShareVisible {
  id: string;
  name?: string;
  username?: string;
}
export interface ShareJson {
  actions: ShareAction[];
  groups: { visibles: ShareVisible[]; checked: Record<string, string[]> };
  users: { visibles: ShareVisible[]; checked: Record<string, string[]> };
}
export interface ShareBatch {
  users: Record<string, string[]>;
  groups: Record<string, string[]>;
  bookmarks: Record<string, string[]>;
}

function xsrfHeader(): Record<string, string> {
  const m = typeof document !== 'undefined' ? document.cookie.match(/XSRF-TOKEN=([^;]+)/) : null;
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const base = { credentials: 'include' as const };
const jsonHeaders = { 'Content-Type': 'application/json' };
const mutHeaders = () => ({ ...jsonHeaders, ...xsrfHeader() });

// ── Sites ─────────────────────────────────────────────────────────────────────
export const getWebsites = async (): Promise<Website[]> =>
  json<Website[]>(await fetch('/pages/list/all', base));

export const getWebsite = async (id: string): Promise<Website> =>
  json<Website>(await fetch(`/pages/${id}`, base));

/**
 * Crée un site. Route selon la visibilité, comme l'AngularJS : un site PRIVÉ passe par `POST /pages` (droit
 * `pages.add`), un site PUBLIC par `POST /pages/p` (droit `pages.add.public`) — tout envoyer sur `/pages/p`
 * refusait la création aux utilisateurs qui n'ont que `pages.add`.
 */
export const createWebsite = async (data: { title: string; description?: string; visibility?: 'PRIVATE' | 'PUBLIC' }): Promise<Website> =>
  json<Website>(
    await fetch(data.visibility === 'PUBLIC' ? '/pages/p' : '/pages', {
      ...base,
      method: 'POST',
      headers: mutHeaders(),
      body: JSON.stringify(data),
    }),
  );

/** Met à jour un site (métadonnées et/ou tableau de pages embarquées). */
export const updateWebsite = async (
  id: string,
  data: { title?: string; description?: string; pages?: Page[]; trashed?: boolean; published?: Record<string, PublishedEntry> },
): Promise<unknown> =>
  json<unknown>(await fetch(`/pages/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(data) }));

/** Corbeille : bascule le drapeau `trashed` du site (PUT partiel, $set Mongo). */
export const setWebsiteTrashed = async (id: string, trashed: boolean): Promise<void> => {
  await updateWebsite(id, { trashed });
};

// ── Publication dans les applications (annuaire d'applications) ──────────────────────────────────
/** Droits d'administrateur local de l'utilisateur : identifiants des structures qu'il administre (vide sinon). */
export const getLocalAdminStructures = async (): Promise<string[]> => {
  const me = await json<{ functions?: { ADMIN_LOCAL?: { scope?: string[] } } }>(await fetch('/auth/oauth2/userinfo', base));
  return me?.functions?.ADMIN_LOCAL?.scope ?? [];
};

/** Groupes d'une structure avec leurs rôles. */
export const getGroupsRoles = async (structureId: string): Promise<RoleGroup[]> =>
  json<RoleGroup[]>(await fetch(`/appregistry/groups/roles?structureId=${encodeURIComponent(structureId)}`, base));

/** Crée l'application externe qui représente le site dans une structure ; renvoie l'application et son rôle. */
export const createExternalApplication = async (
  structureId: string,
  app: { displayName: string; name: string; address: string; icon: string },
): Promise<{ id: string; roleId: string }> =>
  json<{ id: string; roleId: string }>(
    await fetch(`/appregistry/application/external?structureId=${encodeURIComponent(structureId)}`, {
      ...base,
      method: 'POST',
      headers: mutHeaders(),
      body: JSON.stringify({ grantType: 'authorization_code', secret: '', target: '', appLocked: true, scope: '', ...app }),
    }),
  );

export const deleteExternalApplication = async (applicationId: string): Promise<void> => {
  const res = await fetch(`/appregistry/application/external/${applicationId}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 404) throw new Error(String(res.status));
};

export const authorizeGroup = async (groupId: string, roleId: string): Promise<void> => {
  const res = await fetch(`/appregistry/authorize/group/${groupId}/role/${roleId}`, { ...base, method: 'PUT', headers: xsrfHeader() });
  if (!res.ok) throw new Error(String(res.status));
};

export const unauthorizeGroup = async (groupId: string, roleId: string): Promise<void> => {
  const res = await fetch(`/appregistry/authorize/group/${groupId}/role/${roleId}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 404) throw new Error(String(res.status));
};

// ── Dossiers (rangement des sites) ────────────────────────────────────────────
export const getFolders = async (): Promise<Folder[]> =>
  json<Folder[]>(await fetch('/pages/folder/list/all', base));

export const createFolder = async (name: string, parentId = 'root'): Promise<void> => {
  const body = { name, parentId, trashed: false, websitesIds: [] };
  const res = await fetch('/pages/folder', { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
};

export const updateFolder = async (id: string, data: Partial<Folder>): Promise<void> => {
  const res = await fetch(`/pages/folder/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(String(res.status));
};

export const deleteFolder = async (id: string): Promise<void> => {
  const res = await fetch(`/pages/folder/${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

export const deleteWebsite = async (id: string): Promise<void> => {
  const res = await fetch(`/pages/${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

// ── Partage d'un site ─────────────────────────────────────────────────────────
export const getWebsiteShare = async (id: string): Promise<ShareJson> =>
  json<ShareJson>(await fetch(`/pages/share/json/${id}`, base));

export const shareWebsiteBatch = async (id: string, batch: ShareBatch): Promise<void> => {
  const res = await fetch(`/pages/share/resource/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(batch) });
  if (!res.ok) throw new Error(String(res.status));
};

export const api = {
  getWebsites,
  getWebsite,
  getWebsiteShare,
  shareWebsiteBatch,
  createWebsite,
  updateWebsite,
  setWebsiteTrashed,
  getLocalAdminStructures,
  getGroupsRoles,
  createExternalApplication,
  deleteExternalApplication,
  authorizeGroup,
  unauthorizeGroup,
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  deleteWebsite,
};
