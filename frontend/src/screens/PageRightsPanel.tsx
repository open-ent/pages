import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { RightsEntry, rightsEntries } from '../pagesAdmin';

/** Droits de modification d'une page (CCTP 58B) : on coche les groupes/utilisateurs du partage qui peuvent la modifier. */
export function PageRightsPanel({ siteId, page, onClose, onSaved }: { siteId: string; page: { title: string; titleLink: string; contrib?: string[] }; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(['pages', 'common']);
  const share = useQuery({ queryKey: ['pages', 'share', siteId], queryFn: () => api.getWebsiteShare(siteId), retry: false });
  const [entries, setEntries] = useState<RightsEntry[] | null>(null);
  useEffect(() => {
    if (share.data && entries === null) setEntries(rightsEntries(share.data, page.contrib ?? []));
  }, [share.data, entries, page.contrib]);
  const save = useMutation({
    mutationFn: () => api.setPageRights(siteId, page.titleLink, (entries ?? []).filter((e) => e.checked).map((e) => e.id)),
    onSuccess: onSaved,
  });

  return (
    <div className="card p-12 mt-12" data-page-rights>
      <h3 style={{ fontSize: 16 }} className="mb-8">{t('pages.rights.manage', { defaultValue: 'Droits de modification de la page' })} « {page.title} »</h3>
      <p className="text-muted mb-8" style={{ fontSize: 13 }}>{t('pages.rights.help', { defaultValue: 'Choisissez qui peut modifier cette page' })}</p>
      {share.isError && <div className="alert alert-warning" role="alert">{t('pages.rights.load.error', { defaultValue: 'Impossible de charger les partages du site.' })}</div>}
      {share.isLoading && <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>}
      {entries && entries.length === 0 && <p className="text-muted" data-rights-noshare>{t('pages.rights.noshare', { defaultValue: "Le site n'est partagé avec personne." })}</p>}
      {entries && entries.length > 0 && (
        <ul className="list-unstyled mb-8">
          {entries.map((e, i) => (
            <li key={e.id}>
              <label className="d-flex align-items-center gap-8">
                <input type="checkbox" checked={e.checked} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, checked: ev.target.checked } : x)))} data-rights-entry />
                {e.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted" style={{ fontSize: 13 }}>{t('pages.rights.empty.means.all', { defaultValue: 'Aucune case cochée : tous les contributeurs du site peuvent modifier la page.' })}</p>
      {save.isError && <div className="alert alert-warning" role="alert" data-rights-error>{t('pages.rights.save.error', { defaultValue: "L'enregistrement des droits a échoué." })}</div>}
      <div className="d-flex gap-8">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={save.isPending || entries === null} data-rights-save>{t('pages.save', { defaultValue: 'Enregistrer' })}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{t('pages.cancel', { defaultValue: 'Annuler' })}</button>
      </div>
    </div>
  );
}

export default PageRightsPanel;
