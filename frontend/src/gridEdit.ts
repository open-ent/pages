/**
 * Modèle d'édition de la grille d'une page (lignes de 12 colonnes). Fonctions pures : chaque opération renvoie une
 * nouvelle grille, réindexée (l'`index` d'une ligne ou d'une cellule est sa position). Port de `model/row.ts` et
 * `model/cell.ts` (AngularJS) : même format enregistré, donc relisible par l'ancienne interface.
 */
export const MAX_COLUMNS = 12;

export interface EditMedia {
  type?: string;
  source?: unknown;
}
export interface EditCell {
  /** Identifiant d'affichage (clé React), propre à l'éditeur : jamais enregistré. */
  _uid?: string;
  index: number;
  /** Largeur en colonnes (1 → 12). */
  width: number;
  height?: number;
  title?: string;
  media?: EditMedia;
  className?: string[];
  [extra: string]: unknown;
}
export interface EditRow {
  _uid?: string;
  index: number;
  cells: EditCell[];
  [extra: string]: unknown;
}

let uidCounter = 0;
const uid = (): string => `u${++uidCounter}`;

const reindex = (rows: EditRow[]): EditRow[] =>
  rows.map((r, i) => ({ ...r, index: i, cells: r.cells.map((c, j) => ({ ...c, index: j })) }));

/** Copie triée et réindexée d'une grille lue du serveur (largeurs bornées de 1 à 12). */
export function normalizeEditRows(rows: unknown): EditRow[] {
  if (!Array.isArray(rows)) return [];
  const byIndex = (a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0);
  return reindex(
    [...(rows as Array<Partial<EditRow>>)].sort(byIndex).map((r) => ({
      ...r,
      _uid: (r as EditRow)._uid ?? uid(),
      index: r.index ?? 0,
      cells: [...(r.cells ?? [])].sort(byIndex).map((c) => ({
        ...c,
        _uid: (c as EditCell)._uid ?? uid(),
        index: c.index ?? 0,
        width: Math.min(MAX_COLUMNS, Math.max(1, Math.round(c.width && c.width > 0 ? c.width : MAX_COLUMNS))),
      })),
    })),
  );
}

/** Colonnes encore libres sur une ligne. Ex. cellules de 8 et 3 → il en reste 1. */
export const remainingColumns = (row: EditRow): number => Math.max(0, MAX_COLUMNS - row.cells.reduce((sum, c) => sum + c.width, 0));

const emptyCell = (width: number): EditCell => ({ _uid: uid(), index: 0, width, height: 1, media: { type: 'empty' } });

/** Ajoute en fin de grille une ligne d'une cellule vide pleine largeur. */
export const addRow = (rows: EditRow[]): EditRow[] => reindex([...rows, { _uid: uid(), index: 0, cells: [emptyCell(MAX_COLUMNS)] }]);

export const removeRow = (rows: EditRow[], r: number): EditRow[] => reindex(rows.filter((_, i) => i !== r));

/** Déplace une ligne vers le haut (-1) ou le bas (+1) ; sans effet en butée. */
export function moveRow(rows: EditRow[], r: number, dir: -1 | 1): EditRow[] {
  const to = r + dir;
  if (r < 0 || r >= rows.length || to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  [next[r], next[to]] = [next[to], next[r]];
  return reindex(next);
}

/** Ajoute à la ligne une cellule vide occupant les colonnes restantes ; sans effet si la ligne est pleine. */
export function addCell(rows: EditRow[], r: number): EditRow[] {
  const row = rows[r];
  if (!row) return rows;
  const free = remainingColumns(row);
  if (free < 1) return rows;
  return reindex(rows.map((x, i) => (i === r ? { ...x, cells: [...x.cells, emptyCell(free)] } : x)));
}

/** Retire une cellule ; une ligne sans cellule disparaît. */
export function removeCell(rows: EditRow[], r: number, c: number): EditRow[] {
  return reindex(rows.map((x, i) => (i === r ? { ...x, cells: x.cells.filter((_, j) => j !== c) } : x)).filter((x) => x.cells.length > 0));
}

/** Déplace une cellule vers la gauche (-1) ou la droite (+1) dans sa ligne. */
export function moveCell(rows: EditRow[], r: number, c: number, dir: -1 | 1): EditRow[] {
  const row = rows[r];
  const to = c + dir;
  if (!row || c < 0 || c >= row.cells.length || to < 0 || to >= row.cells.length) return rows;
  const cells = [...row.cells];
  [cells[c], cells[to]] = [cells[to], cells[c]];
  return reindex(rows.map((x, i) => (i === r ? { ...x, cells } : x)));
}

/** Fixe la largeur d'une cellule, bornée par les colonnes disponibles de la ligne (elle ne peut pas dépasser 12 au total). */
export function setCellWidth(rows: EditRow[], r: number, c: number, width: number): EditRow[] {
  const row = rows[r];
  const cell = row?.cells[c];
  if (!row || !cell) return rows;
  const max = cell.width + remainingColumns(row);
  const w = Math.min(max, Math.max(1, Math.round(width)));
  if (w === cell.width) return rows;
  return rows.map((x, i) => (i === r ? { ...x, cells: x.cells.map((y, j) => (j === c ? { ...y, width: w } : y)) } : x));
}

const patchCell = (rows: EditRow[], r: number, c: number, patch: Partial<EditCell>): EditRow[] =>
  rows.map((x, i) => (i === r ? { ...x, cells: x.cells.map((y, j) => (j === c ? { ...y, ...patch } : y)) } : x));

export const setCellMedia = (rows: EditRow[], r: number, c: number, media: EditMedia): EditRow[] => patchCell(rows, r, c, { media });
export const setCellTitle = (rows: EditRow[], r: number, c: number, title: string): EditRow[] => patchCell(rows, r, c, { title });

/** Grille de départ d'une page « simple » (contenu HTML, sans grille) : une ligne, une cellule texte pleine largeur. */
export function rowsFromContent(content?: string): EditRow[] {
  if (!content || !content.trim()) return [];
  return [{ _uid: uid(), index: 0, cells: [{ _uid: uid(), index: 0, width: MAX_COLUMNS, height: 1, media: { type: 'text', source: content } }] }];
}

/** Grille à enregistrer : sans les identifiants d'affichage (`_uid`), format identique à celui de l'ancienne interface. */
export function stripUids(rows: EditRow[]): EditRow[] {
  return rows.map(({ _uid, ...row }) => ({ ...row, cells: row.cells.map(({ _uid: _cell, ...cell }) => cell) })) as EditRow[];
}
