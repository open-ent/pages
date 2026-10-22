import { createContext, useContext } from 'react';

/** Site affiché : certains contenus (navigation) ont besoin des pages du site qui les contient. */
export const SiteContext = createContext<{ siteId?: string }>({});
export const useSiteContext = () => useContext(SiteContext);
