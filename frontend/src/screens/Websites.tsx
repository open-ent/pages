import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { api, Website } from '../api';
import { ShareDialog } from './ShareDialog';

/** Accueil : liste des sites web + création / dossiers / corbeille / partage. */
export function Websites() {
  const { t } = useTranslation(['pages', 'common']);
  const qc = useQueryClient();
  const [sharing, setSharing] = useState<{ id: string; name: string } | null>(null);
  const query = useQuery({ queryKey: ['pages', 'list'], queryFn: api.getWebsites });
  const foldersQuery = useQuery({ queryKey: ['pages', 'folders'], queryFn: api.getFolders });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pages', 'list'] });
    qc.invalidateQueries({ queryKey: ['pages', 'folders'] });
  };

  // Navigation : racine, un dossier, ou la corbeille (parité Angular Mes projets / Corbeille).
  const [currentFolderId, setCurrentFolderId] = useState<'root' | 'trash' | string>('root');
  const folders = foldersQuery.data ?? [];
  const currentFolder = folders.find((f) => f._id === currentFolderId);
  const childFolders = folders.filter((f) => !f.trashed && (f.parentId ?? 'root') === (currentFolderId === 'trash' ? '—' : currentFolderId));
  const inSomeFolder = new Set(folders.flatMap((f) => f.websitesIds ?? []));

  const [newFolder, setNewFolder] = useState('');
  const createFolderMut = useMutation({
    mutationFn: () => api.createFolder(newFolder.trim(), currentFolderId === 'root' ? 'root' : currentFolderId),
    onSuccess: () => {
      setNewFolder('');
      invalidate();
    },
  });
  const deleteFolderMut = useMutation({ mutationFn: (id: string) => api.deleteFolder(id), onSuccess: invalidate });
  const trashMut = useMutation({
    mutationFn: ({ id, trashed }: { id: string; trashed: boolean }) => api.setWebsiteTrashed(id, trashed),
    onSuccess: invalidate,
  });
  const moveMut = useMutation({
    mutationFn: async ({ siteId, folderId }: { siteId: string; folderId: string }) => {
      // Retire le site de tous les dossiers puis l'ajoute au dossier cible ('root' = aucun).
      for (const f of folders.filter((x) => (x.websitesIds ?? []).includes(siteId))) {
        await api.updateFolder(f._id, { websitesIds: (f.websitesIds ?? []).filter((x) => x !== siteId) });
      }
      if (folderId !== 'root') {
        const target = folders.find((x) => x._id === folderId);
        if (target) await api.updateFolder(folderId, { websitesIds: [...(target.websitesIds ?? []), siteId] });
      }
    },
    onSuccess: invalidate,
  });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.createWebsite({ title: title.trim(), description: description.trim() }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setCreating(false);
      invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteWebsite(id),
    onSuccess: invalidate,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) createMut.mutate();
  };

  // Recherche (parité Angular) : filtre sur le titre et la description.
  const [search, setSearch] = useState('');
  const norm = (s: string) => s.toLocaleLowerCase('fr-FR');
  const websites = (query.data ?? [])
    .filter((w) => {
      if (currentFolderId === 'trash') return Boolean(w.trashed);
      if (w.trashed) return false;
      if (currentFolderId === 'root') return !inSomeFolder.has(w._id);
      return (currentFolder?.websitesIds ?? []).includes(w._id);
    })
    .filter((w) => !search.trim() || norm(`${w.title} ${w.description ?? ''}`).includes(norm(search.trim())));

  const dateFr = (d?: { $date: string }) => (d?.$date ? new Date(d.$date).toLocaleDateString('fr-FR') : '');

  return (
    <div>
      {sharing && (
        <ShareDialog
          resourceId={sharing.id}
          resourceName={sharing.name}
          title={t('pages.share.title', { defaultValue: 'Partager le site' })}
          getShare={api.getWebsiteShare}
          shareBatch={api.shareWebsiteBatch}
          onClose={() => setSharing(null)}
        />
      )}
      <div className="d-flex align-items-center justify-content-between mb-16">
        <h1 className="m-0">{t('pages.title', { defaultValue: 'Sites web' })}</h1>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('pages.new', { defaultValue: 'Nouveau site' })}
          </button>
        )}
      </div>

      {creating && (
        <form className="card p-16 mb-16" onSubmit={onCreate}>
          <div className="mb-8">
            <label htmlFor="site-title" className="form-label">{t('pages.name', { defaultValue: 'Titre' })}</label>
            <input id="site-title" type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="mb-8">
            <label htmlFor="site-desc" className="form-label">{t('pages.description', { defaultValue: 'Description' })}</label>
            <input id="site-desc" type="text" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="d-flex gap-8">
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || createMut.isPending}>{t('pages.create', { defaultValue: 'Créer' })}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>{t('pages.cancel', { defaultValue: 'Annuler' })}</button>
          </div>
        </form>
      )}

      {/* Navigation : Mes projets / Corbeille + création de dossier (parité Angular) */}
      <div className="d-flex gap-8 align-items-center flex-wrap mb-12">
        <div className="btn-group" role="group" aria-label={t('pages.nav', { defaultValue: 'Navigation' })}>
          <button type="button" className={`btn btn-sm ${currentFolderId !== 'trash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentFolderId('root')}>
            {t('pages.myprojects', { defaultValue: 'Mes projets' })}
          </button>
          <button type="button" className={`btn btn-sm ${currentFolderId === 'trash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentFolderId('trash')}>
            {t('pages.trash', { defaultValue: 'Corbeille' })}
          </button>
        </div>
        {currentFolder && (
          <span>
            <button type="button" className="btn btn-link p-0" onClick={() => setCurrentFolderId(currentFolder.parentId ?? 'root')}>←</button>{' '}
            <strong>{currentFolder.name}</strong>
          </span>
        )}
        {currentFolderId !== 'trash' && (
          <form
            className="d-flex gap-8 ms-auto"
            onSubmit={(e) => {
              e.preventDefault();
              if (newFolder.trim()) createFolderMut.mutate();
            }}
          >
            <input
              type="text"
              className="form-control form-control-sm"
              style={{ maxWidth: 200 }}
              placeholder={t('pages.folder.new', { defaultValue: 'Nouveau dossier…' })}
              aria-label={t('pages.folder.new', { defaultValue: 'Nouveau dossier…' })}
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!newFolder.trim() || createFolderMut.isPending}>
              {t('pages.folder.create', { defaultValue: 'Créer le dossier' })}
            </button>
          </form>
        )}
      </div>

      {/* Dossiers du niveau courant */}
      {currentFolderId !== 'trash' && childFolders.length > 0 && (
        <div className="d-flex gap-8 flex-wrap mb-12">
          {childFolders.map((f) => (
            <span key={f._id} className="badge bg-secondary d-flex align-items-center gap-8" style={{ fontSize: 13 }}>
              <button type="button" className="btn btn-sm p-0 text-white" onClick={() => setCurrentFolderId(f._id)}>
                📁 {f.name} ({(f.websitesIds ?? []).length})
              </button>
              <button
                type="button"
                className="btn btn-sm p-0 text-white"
                aria-label={`${t('pages.folder.delete', { defaultValue: 'Supprimer le dossier' })} ${f.name}`}
                onClick={() => {
                  if (window.confirm(t('pages.folder.confirm.delete', { defaultValue: 'Supprimer ce dossier ? (les sites ne sont pas supprimés)' }))) deleteFolderMut.mutate(f._id);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-16" style={{ maxWidth: 360 }}>
        <input
          type="search"
          className="form-control"
          placeholder={t('pages.search', { defaultValue: 'Rechercher un site…' })}
          aria-label={t('pages.search', { defaultValue: 'Rechercher un site…' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {query.isLoading && <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>}
      {query.isError && <div className="alert alert-warning" role="alert">{t('pages.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {!query.isLoading && websites.length === 0 && (
        <p className="text-muted">{t('pages.empty', { defaultValue: 'Aucun site. Créez-en un.' })}</p>
      )}

      <ul className="list-unstyled">
        {websites.map((w: Website) => (
          <li key={w._id} className="py-12 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <Link to={`/site/${w._id}`} className="fw-bold" style={{ fontSize: 17 }}>{w.title}</Link>
              {w.description && <div className="text-muted" style={{ fontSize: 13 }}>{w.description}</div>}
              <div className="text-muted" style={{ fontSize: 12 }}>
                {w.owner?.displayName && <>{t('pages.by', { defaultValue: 'Par' })} {w.owner.displayName}</>}
                {dateFr(w.modified) && <> · {t('pages.modified', { defaultValue: 'Modifié le' })} {dateFr(w.modified)}</>}
              </div>
            </div>
            <div className="d-flex gap-8 align-items-center">
              {currentFolderId === 'trash' ? (
                <>
                  <button type="button" className="btn btn-link p-0" onClick={() => trashMut.mutate({ id: w._id, trashed: false })}>
                    {t('pages.restore', { defaultValue: 'Restaurer' })}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-danger"
                    onClick={() => {
                      if (window.confirm(t('pages.confirm.delete', { defaultValue: 'Supprimer définitivement ce site et ses pages ?' }))) deleteMut.mutate(w._id);
                    }}
                  >
                    {t('pages.delete.definitive', { defaultValue: 'Supprimer définitivement' })}
                  </button>
                </>
              ) : (
                <>
                  {folders.filter((f) => !f.trashed).length > 0 && (
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 170 }}
                      aria-label={t('pages.move.to', { defaultValue: 'Déplacer vers…' })}
                      value={folders.find((f) => (f.websitesIds ?? []).includes(w._id))?._id ?? 'root'}
                      onChange={(e) => moveMut.mutate({ siteId: w._id, folderId: e.target.value })}
                    >
                      <option value="root">{t('pages.folder.root', { defaultValue: 'Aucun dossier' })}</option>
                      {folders.filter((f) => !f.trashed).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                  )}
                  <button type="button" className="btn btn-link p-0" onClick={() => setSharing({ id: w._id, name: w.title })}>
                    {t('pages.share', { defaultValue: 'Partager' })}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-danger"
                    onClick={() => trashMut.mutate({ id: w._id, trashed: true })}
                  >
                    {t('pages.totrash', { defaultValue: 'Mettre à la corbeille' })}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Websites;
