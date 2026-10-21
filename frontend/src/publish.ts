/**
 * Publication d'un site dans les applications : un administrateur local choisit les groupes qui voient le site dans
 * leur liste d'applications. Port de `model/publish.ts` (AngularJS). Fonctions pures + appels injectés pour les tester.
 */
import type { PublishedEntry, Website } from './api';

/** Adresse du site dans l'ENT (relative) : `/pages#/website/<id>`, ou `/pages/p/website#/website/<id>` pour un site public. */
export function siteAddress(site: Pick<Website, '_id' | 'visibility'>): string {
  return `${site.visibility === 'PUBLIC' ? '/pages/p/website' : '/pages'}#/website/${site._id}`;
}

/** Groupes proposés à la publication : ceux de la structure qui ne l'ont pas déjà, filtrés par la recherche (sans accents ni casse). */
export function candidateGroups<G extends { id: string; name: string }>(groups: G[], published: PublishedEntry | undefined, search: string): G[] {
  const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const already = new Set((published?.groups ?? []).map((g) => g.id));
  const q = norm(search.trim());
  return groups.filter((g) => !already.has(g.id) && (!q || norm(g.name).includes(q))).sort((a, b) => a.name.localeCompare(b.name));
}

export interface PublishDeps {
  createApplication: (structureId: string, app: { displayName: string; name: string; address: string; icon: string }) => Promise<{ id: string; roleId: string }>;
  authorize: (groupId: string, roleId: string) => Promise<void>;
  unauthorize: (groupId: string, roleId: string) => Promise<void>;
}

/**
 * Publie le site pour un groupe : crée l'application de la structure au premier groupe, puis autorise le groupe sur son rôle.
 * Renvoie la nouvelle table `published` (à enregistrer sur le site).
 */
export async function publishForGroup(
  site: Pick<Website, '_id' | 'title' | 'visibility' | 'published'>,
  structureId: string,
  group: { id: string; name: string },
  deps: PublishDeps,
): Promise<Record<string, PublishedEntry>> {
  const published = { ...(site.published ?? {}) };
  let entry = published[structureId];
  if (!entry) {
    const app = await deps.createApplication(structureId, {
      displayName: site.title,
      name: `${site.title} - ${structureId}`,
      address: siteAddress(site),
      icon: '/img/illustrations/pages.svg',
    });
    entry = { application: { id: app.id }, role: { id: app.roleId }, groups: [] };
  }
  await deps.authorize(group.id, entry.role.id);
  published[structureId] = { ...entry, groups: [...entry.groups.filter((g) => g.id !== group.id), { id: group.id, name: group.name }] };
  return published;
}

/** Retire le groupe de la publication. Renvoie la nouvelle table `published`. */
export async function unpublishForGroup(
  site: Pick<Website, 'published'>,
  structureId: string,
  groupId: string,
  deps: PublishDeps,
): Promise<Record<string, PublishedEntry>> {
  const published = { ...(site.published ?? {}) };
  const entry = published[structureId];
  if (!entry) return published;
  await deps.unauthorize(groupId, entry.role.id);
  published[structureId] = { ...entry, groups: entry.groups.filter((g) => g.id !== groupId) };
  return published;
}
