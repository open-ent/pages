import { Navigate, RouteObject, createHashRouter, useParams } from 'react-router-dom';

import { Root } from './screens/Root';
import { PageEditor } from './screens/PageEditor';
import { SitePrint, SiteView } from './screens/SiteView';
import { Website } from './screens/Website';
import { Websites } from './screens/Websites';

/** Redirection d'une adresse de l'éditeur historique vers l'écran équivalent (les liens déjà diffusés restent valables). */
function LegacyRedirect({ to }: { to: (p: { siteId?: string; pageLink?: string }) => string }) {
  const params = useParams();
  return <Navigate replace to={to({ siteId: params.siteId, pageLink: params.pageLink })} />;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Websites /> },
      { path: 'site/:siteId', element: <Website /> },
      { path: 'site/:siteId/view', element: <SiteView /> },
      { path: 'site/:siteId/view/:pageLink', element: <SiteView /> },
      { path: 'site/:siteId/print', element: <SitePrint /> },
      { path: 'site/:siteId/edit/:pageLink', element: <PageEditor /> },
      // Adresses de l'éditeur historique : `#/website/<site>[/<page>]`, `#/preview/<site>[/<page>]`, `#/print/<site>`
      { path: 'website/:siteId', element: <LegacyRedirect to={({ siteId }) => `/site/${siteId}/view`} /> },
      { path: 'website/:siteId/:pageLink', element: <LegacyRedirect to={({ siteId, pageLink }) => `/site/${siteId}/view/${pageLink}`} /> },
      { path: 'preview/:siteId', element: <LegacyRedirect to={({ siteId }) => `/site/${siteId}/view`} /> },
      { path: 'preview/:siteId/:pageLink', element: <LegacyRedirect to={({ siteId, pageLink }) => `/site/${siteId}/view/${pageLink}`} /> },
      { path: 'print/:siteId', element: <LegacyRedirect to={({ siteId }) => `/site/${siteId}/print`} /> },
      { path: 'list-sites', element: <Navigate replace to="/" /> },
    ],
  },
];

// Hash router : app servie sous `/pages` (route serveur unique), routage dans le fragment
// (`/pages#/site/…`). Évite les 404 F5 sur sous-routes (pas de fallback SPA). CCTP 51C.
export const router = createHashRouter(routes);
