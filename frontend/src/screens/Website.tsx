import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, Page } from '../api';
import { isGridPage, isPagePublished, pagePreview, slugify } from '../utils';
import { GridViewer } from './GridViewer';
import { PublishPanel } from './PublishPanel';

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
  // Pages dont l'aperçu en grille est déplié (par indice)
  const [previews, setPreviews] = useState<number[]>([]);
  const togglePreview = (idx: number) => setPreviews((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));

  /** Sauvegarde le site avec un nouveau tableau de pages. */
  const putPages = (nextPages: Page[]) =>
    api.updateWebsite(siteId, { title: site!.title, description: site?.description, pages: nextPages });

  const saveMut = useMutation({
    mutationFn: () => {
      // Édition : on fusionne dans la page existante pour ne perdre aucun champ (titleLink, published, style…) ;
      // création : champs attendus par la navigation et l'éditeur AngularJS (lien, grille vide, publiée).
      const next =
        editingIdx === null
          ? [...pages, { title: title.trim(), content, titleLink: slugify(title.trim()), rows: [], published: true, index: pages.length } as Page]
          : pages.map((p, i) => (i === editingIdx ? { ...p, title: title.trim(), content } : p));
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
    onError: () => setFormError(t('pages.page.error', { defaultValue: "L'enregistrement a échoué." })),
  });

  // Publier / dépublier une page : même drapeau `published` que l'éditeur historique
  const publishMut = useMutation({
    mutationFn: (idx: number) => putPages(pages.map((p, i) => (i === idx ? { ...p, published: !isPagePublished(p) } : p))),
    onSuccess: invalidate,
    onError: () => setFormError(t('pages.page.error', { defaultValue: "L'enregistrement a échoué." })),
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
    setContent(pages[idx].content ?? '');
  };

  return (
    <div>
      <p>
        <Link to="/">← {t('pages.back', { defaultValue: 'Retour aux sites' })}</Link>
      </p>
      <div className="d-flex justify-content-between align-items-start mb-16 gap-8 flex-wrap">
        <h1 className="mb-0">{site?.title ?? t('pages.title', { defaultValue: 'Site' })}</h1>
        {site && <Link className="btn btn-secondary" to={`/site/${siteId}/view`} data-view-site>{t('pages.view', { defaultValue: 'Voir le site' })}</Link>}
      </div>
      {site?.description && <p className="text-muted">{site.description}</p>}
      {site && <PublishPanel site={site} />}

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
      {query.isError && (
        <div className="alert alert-warning" role="alert" data-pages-error>
          {t('pages.error', { defaultValue: 'Une erreur est survenue.' })}
        </div>
      )}
      {query.isLoading && <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>}
      {!query.isLoading && pages.length === 0 && (
        <p className="text-muted">{t('pages.pages.empty', { defaultValue: 'Aucune page. Ajoutez-en une.' })}</p>
      )}
      <ul className="list-unstyled">
        {pages.map((p, idx) => (
          <li key={idx} className="py-12 border-bottom">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="fw-bold">
                  {p.title}
                  <span className={`badge ms-8 ${isPagePublished(p) ? 'bg-success' : 'bg-secondary'}`} data-page-status={isPagePublished(p) ? 'published' : 'unpublished'}>
                    {isPagePublished(p) ? t('pages.page.published', { defaultValue: 'Publiée' }) : t('pages.page.unpublished', { defaultValue: 'Non publiée' })}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: 14 }}>{pagePreview(p.content)}</div>
              </div>
              <div className="d-flex gap-8">
                <button type="button" className="btn btn-link p-0" onClick={() => publishMut.mutate(idx)} disabled={publishMut.isPending} data-publish-toggle>
                  {isPagePublished(p) ? t('pages.page.unpublish', { defaultValue: 'Dépublier' }) : t('pages.page.publish', { defaultValue: 'Publier' })}
                </button>
                {isGridPage(p) && (
                  <button type="button" className="btn btn-link p-0" aria-expanded={previews.includes(idx)} onClick={() => togglePreview(idx)} data-grid-preview-toggle>
                    {previews.includes(idx) ? t('pages.page.preview.hide', { defaultValue: "Masquer l'aperçu" }) : t('pages.page.preview', { defaultValue: 'Aperçu' })}
                  </button>
                )}
                <Link className="btn btn-link p-0" to={`/site/${siteId}/edit/${p.titleLink}`} data-edit-layout>
                  {t('pages.page.layout', { defaultValue: 'Mettre en page' })}
                </Link>
                {isGridPage(p) ? (
                  <span className="text-muted" style={{ fontSize: 13 }} data-grid-page>
                    {t('pages.page.grid', { defaultValue: 'Page en grille' })}
                  </span>
                ) : (
                  <button type="button" className="btn btn-link p-0" onClick={() => startEdit(idx)}>{t('pages.edit', { defaultValue: 'Modifier' })}</button>
                )}
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
            {isGridPage(p) && previews.includes(idx) && (
              <div className="card p-16 mt-12" data-grid-preview>
                <GridViewer rows={p.rows} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Website;
