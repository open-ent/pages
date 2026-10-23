import { EdificeClientProvider, EdificeThemeProvider } from '@open-ent/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';

import { router } from './routes';
import { PublicSite } from './screens/PublicSite';

import './i18n';
import '@open-ent/bootstrap/dist/index.css';
import './theme-fixes.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

// Site publié consulté sans connexion (`/pages/p/website`) : aucune session n'existe, on n'initialise donc pas le client ENT.
const isPublicWebsite = window.location.pathname.replace(/\/$/, '').endsWith('/p/website');
const publicRouter = createHashRouter([
  { path: '/website/:siteId', element: <PublicSite /> },
  { path: '/website/:siteId/:pageLink', element: <PublicSite /> },
  { path: '*', element: <p className="p-24">Adresse inconnue.</p> },
]);

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    {isPublicWebsite ? (
      <RouterProvider router={publicRouter} />
    ) : (
      <EdificeClientProvider params={{ app: 'pages' }}>
        <EdificeThemeProvider>
          <RouterProvider router={router} />
        </EdificeThemeProvider>
      </EdificeClientProvider>
    )}
  </QueryClientProvider>,
);
