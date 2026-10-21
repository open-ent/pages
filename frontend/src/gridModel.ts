/** Modèle de la grille de mise en page (pages en lignes/cellules créées par l'éditeur historique), en lecture seule. */
export interface GridMedia {
  type?: string;
  source?: unknown;
}
export interface GridCell {
  index?: number;
  /** Largeur en colonnes (1 → 12). */
  width?: number;
  media?: GridMedia;
  title?: string;
  className?: string[];
}
export interface GridRow {
  index?: number;
  cells?: GridCell[];
}

const byIndex = (a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0);

/** Lignes triées, cellules triées ; largeur ramenée entre 1 et 12 (ex. 0 ou absent → 12 : cellule pleine largeur). */
export function normalizeRows(rows: unknown): GridRow[] {
  if (!Array.isArray(rows)) return [];
  return (rows as GridRow[])
    .map((r) => ({
      ...r,
      cells: [...(r.cells ?? [])]
        .sort(byIndex)
        .map((c) => ({ ...c, width: Math.min(12, Math.max(1, Math.round(c.width && c.width > 0 ? c.width : 12))) })),
    }))
    .sort(byIndex);
}

/** Une cellule « grille » contient une sous-page : `media.source.rows`. */
export function subRows(cell: GridCell): GridRow[] {
  const src = cell.media?.source as { rows?: unknown } | undefined;
  return normalizeRows(src?.rows);
}
