import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, Page } from '../api';
import { sanitizeHtml } from '../sanitize';
import { canUpdateSite, isGridPage, landingPageOf, matchingPage, visiblePages } from '../utils';
import { GridViewer } from './GridViewer';
import { PageStyle } from './PageStyle';
import { SiteContext } from './SiteContext';

/** Contenu d'une page : sa grille (lecture seule) ou, pour une page simple, son HTML assaini. */
function PageBody({ page }: { page: Page }) {
  return (
    <>
      <PageStyle sass={page.sass} />
      {isGridPage(page) ? <GridViewer rows={page.rows} /> : <div className="page-content pages-grid" data-page-content dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content ?? '') }} />}
    </>
  );
}

function useSiteAccess(siteId: string) {
  const { user } = useEdificeClient();
  const query = useQuery({ queryKey: ['pages', 'site', siteId], queryFn: () => api.getWebsite(siteId), enabled: !!siteId });
  const me = user as { userId?: string; groupsIds?: string[] } | undefined;
  const site = query.data;
  const editMode = !!site && canUpdateSite(site, me?.userId, me?.groupsIds ?? []);
  return { query, site, editMode };
}

/** Affichage d'une page du site (accueil par défaut), avec la navigation entre les pages visibles. */
export function SiteView() {
  const { siteId = '', pageLink } = useParams();
  const { t } = useTranslation(['pages', 'common']);
  const { query, site, editMode } = useSiteAccess(siteId);

  if (query.isLoading) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  if (query.isError || !site) {
    return <div className="alert alert-warning" role="alert" data-pages-error>{t('pages.error', { defaultValue: 'Une erreur est survenue.' })}</div>;
  }
  const pages = site.pages ?? [];
  const visible = visiblePages(pages, editMode);
  const landing = landingPageOf(pages, site.landingPage, editMode);
  const page = matchingPage(pages, pageLink, site.landingPage, editMode);

  return (
    <SiteContext.Provider value={{ siteId }}>
    <div data-site-view>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-8 mb-16 d-print-none">
        <div>
          <p className="mb-4"><Link to="/">← {t('pages.back', { defaultValue: 'Retour aux sites' })}</Link></p>
          <h1 className="mb-0">{site.title}</h1>
        </div>
        <div className="d-flex gap-8">
          {editMode && <Link className="btn btn-secondary" to={`/site/${siteId}`}>{t('pages.edit', { defaultValue: 'Modifier' })}</Link>}
          <Link className="btn btn-secondary" to={`/site/${siteId}/print`} data-print-link>{t('pages.print', { defaultValue: 'Imprimer' })}</Link>
        </div>
      </div>

      {visible.length > 1 && (
        <nav className="mb-16 d-print-none" aria-label={t('pages.nav', { defaultValue: 'Pages du site' })} data-site-nav>
          <ul className="nav nav-pills">
            {visible.map((p) => (
              <li key={p.titleLink} className="nav-item">
                <Link className={`nav-link${p === page ? ' active' : ''}`} aria-current={p === page ? 'page' : undefined} to={p === landing ? `/site/${siteId}/view` : `/site/${siteId}/view/${p.titleLink}`}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {page ? (
        <article data-page-link={page.titleLink}>
          <h2 style={{ fontSize: 22 }} className="mb-12">{page.title}</h2>
          <PageBody page={page} />
        </article>
      ) : (
        <p className="text-muted" data-site-empty>{t('pages.view.empty', { defaultValue: "Ce site n'a pas de page visible." })}</p>
      )}
    </div>
    </SiteContext.Provider>
  );
}

/** Impression : toutes les pages visibles à la suite ; le navigateur imprime une fois les images chargées. */
export function SitePrint() {
  const { siteId = '' } = useParams();
  const { t } = useTranslation(['pages', 'common']);
  const { query, site, editMode } = useSiteAccess(siteId);
  const pages = site ? visiblePages(site.pages ?? [], editMode) : [];

  useEffect(() => {
    if (!site) return;
    const timer = setInterval(() => {
      const pending = Array.from(document.images).filter((img) => !img.complete);
      if (pending.length === 0) {
        clearInterval(timer);
        window.print();
      }
    }, 150);
    return () => clearInterval(timer);
  }, [site]);

  if (query.isLoading) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  if (!site) return <div className="alert alert-warning" role="alert">{t('pages.error', { defaultValue: 'Une erreur est survenue.' })}</div>;
  return (
    <SiteContext.Provider value={{ siteId }}>
    <div data-site-print>
      <h1 className="mb-16">{site.title}</h1>
      {pages.map((p) => (
        <article key={p.titleLink} className="mb-24" data-print-page={p.titleLink}>
          <h2 style={{ fontSize: 22 }} className="mb-12">{p.title}</h2>
          <PageBody page={p} />
        </article>
      ))}
    </div>
    </SiteContext.Provider>
  );
}
