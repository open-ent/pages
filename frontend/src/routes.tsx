import { RouteObject, createHashRouter } from 'react-router-dom';

import { Root } from './screens/Root';
import { Website } from './screens/Website';
import { Websites } from './screens/Websites';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Websites /> },
      { path: 'site/:siteId', element: <Website /> },
    ],
  },
];

// Hash router : app servie sous `/pages` (route serveur unique), routage dans le fragment
// (`/pages#/site/…`). Évite les 404 F5 sur sous-routes (pas de fallback SPA). CCTP 51C.
export const router = createHashRouter(routes);
