import { useQuery } from '@tanstack/react-query';

import { loadBlockHtml } from '../blocks';

/**
 * Aperçu rendu d'un modèle de bloc (comme l'éditeur historique) : le HTML du modèle, déjà résolu et nettoyé, réduit dans une
 * vignette de hauteur fixe ; il n'est pas cliquable (le clic revient au bloc). Un modèle illisible n'affiche rien.
 */
export function BlockPreview({ name }: { name: string }) {
  const query = useQuery({ queryKey: ['pages', 'block-html', name], queryFn: () => loadBlockHtml(name), retry: false, staleTime: Infinity });
  if (!query.data) return null;
  return (
    <div className="block-preview mt-4" aria-hidden="true" data-block-preview={name} style={{ height: 88, overflow: 'hidden', position: 'relative', border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff' }}>
      <div
        className="text-wrapper"
        style={{ width: '250%', transform: 'scale(0.4)', transformOrigin: 'top left', pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: query.data }}
      />
    </div>
  );
}

export default BlockPreview;
