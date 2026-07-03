import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { api, Website } from '../api';

/** Accueil : liste des sites web + création / suppression. */
export function Websites() {
  const { t } = useTranslation(['pages', 'common']);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['pages', 'list'], queryFn: api.getWebsites });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pages', 'list'] });

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

  const websites = query.data ?? [];

  return (
    <div>
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
            </div>
            <button
              type="button"
              className="btn btn-link p-0 text-danger"
              onClick={() => {
                if (window.confirm(t('pages.confirm.delete', { defaultValue: 'Supprimer ce site et ses pages ?' }))) deleteMut.mutate(w._id);
              }}
            >
              {t('pages.delete', { defaultValue: 'Supprimer' })}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Websites;
