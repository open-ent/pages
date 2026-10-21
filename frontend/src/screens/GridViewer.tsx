import { useTranslation } from 'react-i18next';

import { GridCell, GridRow, normalizeRows, subRows } from '../gridModel';
import { sanitizeHtml } from '../sanitize';

/** Un média de cellule : texte/vidéo (HTML assaini), image, son ; l'interactif (sniplet) n'est pas rendu ici. */
function CellContent({ cell, depth }: { cell: GridCell; depth: number }) {
  const { t } = useTranslation(['pages', 'common']);
  const media = cell.media ?? {};
  const source = typeof media.source === 'string' ? media.source : '';
  switch (media.type) {
    case 'text':
      return <div className="text-wrapper" dangerouslySetInnerHTML={{ __html: sanitizeHtml(source) }} />;
    case 'video':
      return <div className="video-wrapper" dangerouslySetInnerHTML={{ __html: sanitizeHtml(source, true) }} />;
    case 'image':
      return source ? <img className="image-wrapper" src={`${source}?thumbnail=1600x0`} alt={cell.title ?? ''} style={{ maxWidth: '100%' }} /> : null;
    case 'sound':
      return source ? <audio controls src={source} /> : null;
    case 'grid':
      return depth < 4 ? <GridRows rows={subRows(cell)} depth={depth + 1} /> : null;
    case 'sniplet':
      return (
        <p className="text-muted mb-0" data-sniplet>
          {t('pages.page.sniplet', { defaultValue: "Contenu interactif : à consulter depuis l'ancienne interface." })}
        </p>
      );
    default:
      return null;
  }
}

function GridRows({ rows, depth }: { rows: GridRow[]; depth: number }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className="pages-grid-row" data-grid-row>
          {(row.cells ?? []).map((cell, j) => (
            <div key={j} className="pages-grid-cell" style={{ gridColumn: `span ${cell.width}` }} data-grid-cell data-cell-type={cell.media?.type ?? 'empty'}>
              <CellContent cell={cell} depth={depth} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Aperçu en lecture seule d'une page en grille (lignes de 12 colonnes). */
export function GridViewer({ rows }: { rows: unknown }) {
  return (
    <div className="pages-grid" data-grid-viewer>
      <GridRows rows={normalizeRows(rows)} depth={0} />
    </div>
  );
}

export default GridViewer;
