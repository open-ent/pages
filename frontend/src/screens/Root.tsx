import {
  AppHeader,
  Breadcrumb,
  Layout,
  LoadingScreen,
  useEdificeClient,
} from '@open-ent/react';
import i18n from 'i18next';
import { Outlet } from 'react-router-dom';

import { setLanguage } from '../locale';
import { setSanitizeTranslator } from '../sanitize';

/** Gabarit commun : bandeau ENT (Layout + AppHeader + fil d'Ariane) + contenu. */
export function Root() {
  const { currentApp, currentLanguage, init } = useEdificeClient();

  // La locale de formatage des dates suit la langue de la session (cf. locale.ts). Elle est
  // posée pendant le rendu, et non dans un effet : les écrans sont montés sous ce composant
  // et formateraient leurs premières dates en français avant que l'effet ne s'exécute.
  setLanguage(currentLanguage);
  // `<i18n>clé</i18n>` des anciens contenus (blocs modèles) : traduit avec les textes du module et communs
  setSanitizeTranslator((key) => i18n.t(key, { ns: ['pages', 'common'], defaultValue: key }) as string);

  if (!init) return <LoadingScreen />;

  return (
    <div className="d-flex flex-column vh-100">
      <Layout>
        <div className="d-print-none">
          <AppHeader>{currentApp && <Breadcrumb app={currentApp} />}</AppHeader>
        </div>
        <div className="flex-grow-1 overflow-auto">
          <div className="container py-16">
            <Outlet />
          </div>
        </div>
      </Layout>
    </div>
  );
}

export default Root;
