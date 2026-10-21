import { useQuery } from '@tanstack/react-query';

import { compilePageStyle } from '../sassCompile';

/** Applique le style (SASS) d'une page : compilé dans le navigateur, injecté dans une balise `<style>`. Rien si le style est vide ou invalide. */
export function PageStyle({ sass }: { sass?: string }) {
  const query = useQuery({ queryKey: ['pages', 'style', sass ?? ''], queryFn: () => compilePageStyle(sass), enabled: !!sass?.trim(), retry: false, staleTime: Infinity });
  if (!query.data) return null;
  return <style data-page-style>{query.data}</style>;
}

export default PageStyle;
