// Client REST du module Pages (sites web) — session ENT, même origine.
// Mêmes endpoints que la version AngularJS (backend Java inchangé). XSRF sur mutations.

/** Une page d'un site (contenu HTML embarqué dans le document du site). */
export interface Page {
  title: string;
  content: string;
}

/** Un site web : métadonnées + tableau de pages embarquées. */
export interface Website {
  _id: string;
  title: string;
  description?: string;
  pages?: Page[];
  owner?: { userId: string; displayName: string };
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

export const createWebsite = async (data: { title: string; description?: string }): Promise<Website> =>
  json<Website>(await fetch('/pages/p', { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(data) }));

/** Met à jour un site (métadonnées et/ou tableau de pages embarquées). */
export const updateWebsite = async (
  id: string,
  data: { title: string; description?: string; pages?: Page[] },
): Promise<unknown> =>
  json<unknown>(await fetch(`/pages/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(data) }));

export const deleteWebsite = async (id: string): Promise<void> => {
  const res = await fetch(`/pages/${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

export const api = {
  getWebsites,
  getWebsite,
  createWebsite,
  updateWebsite,
  deleteWebsite,
};
