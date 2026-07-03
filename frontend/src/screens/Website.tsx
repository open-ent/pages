import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, Page } from '../api';
import { pagePreview } from '../utils';

/** Détail d'un site : gestion des pages embarquées (ajout / édition / suppression). */
export function Website() {
  const { siteId = '' } = useParams();
  const { t } = useTranslation(['pages', 'common']);
  const qc = useQueryClient();
  const key = ['pages', 'site', siteId];

  const query = useQuery({ queryKey: key, queryFn: () => api.getWebsite(siteId), enabled: !!siteId });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const site = query.data;
  const pages: Page[] = site?.pages ?? [];

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  /** Sauvegarde le site avec un nouveau tableau de pages. */
  const putPages = (nextPages: Page[]) =>
    api.updateWebsite(siteId, { title: site!.title, description: site?.description, pages: nextPages });

  const saveMut = useMutation({
    mutationFn: () => {
      const page: Page = { title: title.trim(), content };
      const next = editingIdx === null ? [...pages, page] : pages.map((p, i) => (i === editingIdx ? page : p));
      return putPages(next);
    },
    onSuccess: () => {
      setTitle('');
      setContent('');
      setEditingIdx(null);
      setFormError('');
      invalidate();
    },
    onError: () => setFormError(t('pages.page.error', { defaultValue: "L'enregistrement a échoué." })),
  });
  const deleteMut = useMutation({
    mutationFn: (idx: number) => putPages(pages.filter((_, i) => i !== idx)),
    onSuccess: invalidate,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError(t('pages.page.incomplete', { defaultValue: 'Renseignez un titre de page.' }));
      return;
    }
    setFormError('');
    saveMut.mutate();
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setTitle(pages[idx].title);
    setContent(pages[idx].content);
  };

  return (
    <div>
      <p>
        <Link to="/">← {t('pages.back', { defaultValue: 'Retour aux sites' })}</Link>
      </p>
      <h1 className="mb-16">{site?.title ?? t('pages.title', { defaultValue: 'Site' })}</h1>
      {site?.description && <p className="text-muted">{site.description}</p>}

      {/* Formulaire de page */}
      <form className="card p-16 mb-16" onSubmit={onSubmit}>
        <h2 style={{ fontSize: 18 }} className="mb-12">
          {editingIdx === null ? t('pages.page.new', { defaultValue: 'Nouvelle page' }) : t('pages.page.edit', { defaultValue: 'Modifier la page' })}
        </h2>
        <div className="mb-8">
          <label htmlFor="page-title" className="form-label">{t('pages.page.title', { defaultValue: 'Titre de la page' })}</label>
          <input id="page-title" type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="mb-8">
          <label htmlFor="page-content" className="form-label">{t('pages.page.content', { defaultValue: 'Contenu (HTML)' })}</label>
          <textarea id="page-content" className="form-control" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        {formError && <div className="alert alert-warning" role="alert">{formError}</div>}
        <div className="d-flex gap-8">
          <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>
            {editingIdx === null ? t('pages.page.add', { defaultValue: 'Ajouter la page' }) : t('pages.save', { defaultValue: 'Enregistrer' })}
          </button>
          {editingIdx !== null && (
            <button type="button" className="btn btn-secondary" onClick={() => { setEditingIdx(null); setTitle(''); setContent(''); }}>
              {t('pages.cancel', { defaultValue: 'Annuler' })}
            </button>
          )}
        </div>
      </form>

      {/* Liste des pages */}
      <h2 style={{ fontSize: 18 }} className="mb-12">{t('pages.pages', { defaultValue: 'Pages' })}</h2>
      {query.isLoading && <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>}
      {!query.isLoading && pages.length === 0 && (
        <p className="text-muted">{t('pages.pages.empty', { defaultValue: 'Aucune page. Ajoutez-en une.' })}</p>
      )}
      <ul className="list-unstyled">
        {pages.map((p, idx) => (
          <li key={idx} className="py-12 border-bottom">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="fw-bold">{p.title}</div>
                <div className="text-muted" style={{ fontSize: 14 }}>{pagePreview(p.content)}</div>
              </div>
              <div className="d-flex gap-8">
                <button type="button" className="btn btn-link p-0" onClick={() => startEdit(idx)}>{t('pages.edit', { defaultValue: 'Modifier' })}</button>
                <button
                  type="button"
                  className="btn btn-link p-0 text-danger"
                  onClick={() => {
                    if (window.confirm(t('pages.page.confirm.delete', { defaultValue: 'Supprimer cette page ?' }))) deleteMut.mutate(idx);
                  }}
                >
                  {t('pages.delete', { defaultValue: 'Supprimer' })}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Website;
