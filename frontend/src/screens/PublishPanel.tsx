import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, Website } from '../api';
import { candidateGroups, publishForGroup, unpublishForGroup } from '../publish';

/** « Afficher dans les applications » : l'administrateur local choisit les groupes qui voient le site dans leurs applications. */
export function PublishPanel({ site }: { site: Website }) {
  const { t } = useTranslation(['pages', 'common']);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const structuresQuery = useQuery({ queryKey: ['pages', 'adml-structures'], queryFn: api.getLocalAdminStructures, retry: false });
  const structureIds = structuresQuery.data ?? [];
  const groupQueries = useQueries({
    queries: structureIds.map((id) => ({ queryKey: ['pages', 'groups-roles', id], queryFn: () => api.getGroupsRoles(id), retry: false })),
  });

  const deps = {
    createApplication: api.createExternalApplication,
    authorize: api.authorizeGroup,
    unauthorize: api.unauthorizeGroup,
  };
  const save = async (published: NonNullable<Website['published']>) => {
    await api.updateWebsite(site._id, { published });
    await qc.invalidateQueries({ queryKey: ['pages', 'site', site._id] });
    await qc.invalidateQueries({ queryKey: ['pages', 'groups-roles'] });
  };
  const failure = () => setError(t('pages.publish.error', { defaultValue: 'La publication a échoué (droit insuffisant ou erreur du serveur).' }));
  const addMut = useMutation({
    mutationFn: async (v: { structureId: string; group: { id: string; name: string } }) => save(await publishForGroup(site, v.structureId, v.group, deps)),
    onSuccess: () => setError(''),
    onError: failure,
  });
  const removeMut = useMutation({
    mutationFn: async (v: { structureId: string; groupId: string }) => save(await unpublishForGroup(site, v.structureId, v.groupId, deps)),
    onSuccess: () => setError(''),
    onError: failure,
  });

  if (structuresQuery.isLoading || structureIds.length === 0) return null;
  const publishedGroups = structureIds.flatMap((id) => (site.published?.[id]?.groups ?? []).map((g) => ({ ...g, structureId: id })));

  return (
    <section className="card p-16 mb-16" data-publish-panel>
      <h2 style={{ fontSize: 18 }} className="mb-8">{t('pages.publish.title', { defaultValue: 'Afficher dans les applications' })}</h2>
      {error && <div className="alert alert-warning" role="alert" data-publish-error>{error}</div>}

      <h3 style={{ fontSize: 15 }} className="mb-8">{t('pages.publish.current', { defaultValue: 'Groupes qui voient le site' })}</h3>
      {publishedGroups.length === 0 ? (
        <p className="text-muted" data-publish-empty>{t('pages.publish.none', { defaultValue: 'Aucun groupe pour le moment.' })}</p>
      ) : (
        <ul className="list-unstyled mb-12" data-publish-groups>
          {publishedGroups.map((g) => (
            <li key={`${g.structureId}-${g.id}`} className="py-4 border-bottom d-flex justify-content-between">
              <span>{g.name}</span>
              <button type="button" className="btn btn-link p-0 text-danger" aria-label={`${t('pages.publish.remove', { defaultValue: 'Retirer' })} ${g.name}`} disabled={removeMut.isPending} onClick={() => removeMut.mutate({ structureId: g.structureId, groupId: g.id })}>×</button>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: 15 }} className="mb-8">{t('pages.publish.groups.info', { defaultValue: "Sélectionner les groupes d'utilisateurs qui disposeront de l'application" })}</h3>
      <input type="search" className="form-control mb-8" aria-label={t('pages.publish.search', { defaultValue: 'Rechercher un groupe' })} placeholder={t('pages.publish.search', { defaultValue: 'Rechercher un groupe' })} value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="list-unstyled mb-8" style={{ maxHeight: 220, overflowY: 'auto' }} data-publish-candidates>
        {structureIds.flatMap((id, i) =>
          candidateGroups(groupQueries[i]?.data ?? [], site.published?.[id], search).map((g) => (
            <li key={`${id}-${g.id}`}>
              <button type="button" className="btn btn-link p-0 text-start" disabled={addMut.isPending} onClick={() => addMut.mutate({ structureId: id, group: g })}>{g.name}</button>
            </li>
          )),
        )}
      </ul>
      <p className="text-muted mb-0" style={{ fontSize: 13 }}>{t('pages.publish.reconnexion', { defaultValue: 'Ce changement sera effectif lors de la prochaine connexion des utilisateurs.' })}</p>
    </section>
  );
}

export default PublishPanel;
