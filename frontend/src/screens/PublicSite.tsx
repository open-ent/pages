import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api';
import { landingPageOf, matchingPage, visiblePages } from '../utils';
import { SiteContext } from './SiteContext';
import { PageBody } from './SiteView';

/**
 * Site publié consulté SANS connexion (`/pages/p/website#/website/<site>[/<page>]`, l'adresse que diffuse l'éditeur
 * historique). Aucune session n'est demandée : seules les pages publiées sont montrées et la lecture reste soumise aux droits
 * du serveur (un site non public répond 401/403, signalé par un message). Pas de modification ni d'impression ici.
 */
export function PublicSite() {
  const { siteId = '', pageLink } = useParams();
  const { t } = useTranslation(['pages', 'common']);
  const query = useQuery({ queryKey: ['pages', 'public-site', siteId], queryFn: () => api.getWebsite(siteId), enabled: !!siteId });

  if (query.isLoading) return <p className="p-24">{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  const site = query.data;
  if (query.isError || !site) {
    return (
      <div className="alert alert-warning m-24" role="alert" data-public-error>
        {t('pages.public.unavailable', { defaultValue: "Ce site n'est pas accessible. Il n'est peut-être pas public ou n'existe plus." })}
      </div>
    );
  }
  const pages = site.pages ?? [];
  const visible = visiblePages(pages, false);
  const landing = landingPageOf(pages, site.landingPage, false);
  const page = matchingPage(pages, pageLink, site.landingPage, false);

  return (
    <SiteContext.Provider value={{ siteId }}>
      <div className="container py-24" data-public-site>
        <h1 className="mb-16">{site.title}</h1>
        {visible.length > 1 && (
          <nav className="mb-16" aria-label={t('pages.nav', { defaultValue: 'Pages du site' })} data-site-nav>
            <ul className="nav nav-pills">
              {visible.map((p) => (
                <li key={p.titleLink} className="nav-item">
                  <Link className={`nav-link${p === page ? ' active' : ''}`} aria-current={p === page ? 'page' : undefined} to={p === landing ? `/website/${siteId}` : `/website/${siteId}/${p.titleLink}`}>
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

export default PublicSite;
