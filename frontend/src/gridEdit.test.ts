import { describe, expect, it } from 'vitest';

import { insertEmptyRow, locateCell, moveCellTo, resizedWidth, stripUids, addCell, addRow, moveCell, moveRow, normalizeEditRows, remainingColumns, removeCell, removeRow, rowsFromContent, setCellMedia, setCellWidth, insertEmptyCell } from './gridEdit';
import type { EditRow } from './gridEdit';

const grid = () => stripUids(normalizeEditRows([{ index: 0, cells: [{ index: 0, width: 8 }, { index: 1, width: 3 }] }, { index: 1, cells: [{ index: 0, width: 12 }] }]));

describe('normalizeEditRows', () => {
  it('trie, réindexe et borne les largeurs', () => {
    const rows = normalizeEditRows([{ index: 5, cells: [{ index: 9, width: 99 }, { index: 2, width: 0 }] }, { index: 1, cells: [{ index: 0, width: 4 }] }]);
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
    expect(rows[0].cells[0].width).toBe(4);
    expect(rows[1].cells.map((c) => [c.index, c.width])).toEqual([[0, 12], [1, 12]]);
  });
  it('grille absente → vide', () => expect(normalizeEditRows(undefined)).toEqual([]));
});

describe('lignes', () => {
  it('ajoute une ligne pleine largeur', () => {
    const rows = addRow(grid());
    expect(rows).toHaveLength(3);
    expect(rows[2].cells[0]).toMatchObject({ width: 12, media: { type: 'empty' } });
  });
  it('supprime et déplace', () => {
    expect(removeRow(grid(), 0)).toHaveLength(1);
    expect(moveRow(grid(), 0, 1)[1].cells).toHaveLength(2);
    expect(moveRow(grid(), 0, -1)).toEqual(grid());
  });
});

describe('cellules', () => {
  it('ajoute une cellule sur les colonnes restantes, pas si la ligne est pleine', () => {
    expect(remainingColumns(grid()[0])).toBe(1);
    const rows = addCell(grid(), 0);
    expect(rows[0].cells).toHaveLength(3);
    expect(rows[0].cells[2].width).toBe(1);
    expect(addCell(grid(), 1)).toEqual(grid());
  });
  it('largeur bornée par les colonnes disponibles', () => {
    expect(setCellWidth(grid(), 0, 0, 12)[0].cells[0].width).toBe(9);
    expect(setCellWidth(grid(), 0, 1, 1)[0].cells[1].width).toBe(1);
    expect(setCellWidth(grid(), 0, 1, 0)[0].cells[1].width).toBe(1);
  });
  it('supprime une cellule ; une ligne vide disparaît', () => {
    expect(removeCell(grid(), 0, 1)[0].cells).toHaveLength(1);
    expect(removeCell(grid(), 1, 0)).toHaveLength(1);
  });
  it('déplace dans la ligne et réindexe', () => {
    const rows = moveCell(grid(), 0, 0, 1);
    expect(rows[0].cells.map((c) => [c.index, c.width])).toEqual([[0, 3], [1, 8]]);
    expect(moveCell(grid(), 0, 1, 1)).toEqual(grid());
  });
  it('définit le contenu sans toucher aux autres cellules', () => {
    const rows = setCellMedia(grid(), 0, 1, { type: 'text', source: '<p>x</p>' });
    expect(rows[0].cells[1].media).toEqual({ type: 'text', source: '<p>x</p>' });
    expect(rows[0].cells[0].media).toBeUndefined();
  });
});

describe('rowsFromContent', () => {
  it('page simple → une cellule texte', () => expect(rowsFromContent('<p>a</p>')[0].cells[0].media).toEqual({ type: 'text', source: '<p>a</p>' }));
  it('contenu vide → rien', () => expect(rowsFromContent('  ')).toEqual([]));
});

describe('moveCellTo', () => {
  // Ligne 0 : A(4) B(4) ; ligne 1 : C(12, pleine) ; ligne 2 : D(4)
  const make = () => {
    const rows = normalizeEditRows([
      { index: 0, cells: [{ index: 0, width: 4, title: 'A' }, { index: 1, width: 4, title: 'B' }] },
      { index: 1, cells: [{ index: 0, width: 12, title: 'C' }] },
      { index: 2, cells: [{ index: 0, width: 4, title: 'D' }] },
    ]);
    const uidOf = (title: string) => rows.flatMap((r) => r.cells).find((c) => c.title === title)!._uid!;
    const titles = (g: ReturnType<typeof normalizeEditRows>) => g.map((r) => r.cells.map((c) => `${c.title}${c.width}`));
    return { rows, uidOf, titles };
  };
  it('réordonne dans la même ligne', () => {
    const { rows, uidOf, titles } = make();
    expect(titles(moveCellTo(rows, uidOf('A'), { cellUid: uidOf('B'), side: 'after' }))[0]).toEqual(['B4', 'A4']);
  });
  it('change de ligne : la ligne vidée disparaît', () => {
    const { rows, uidOf, titles } = make();
    expect(titles(moveCellTo(rows, uidOf('D'), { cellUid: uidOf('A'), side: 'before' }))).toEqual([['D4', 'A4', 'B4'], ['C12']]);
  });
  it('réduit la largeur aux colonnes libres de la ligne cible', () => {
    const { rows, uidOf, titles } = make();
    const wide = normalizeEditRows([{ index: 0, cells: [{ index: 0, width: 8, title: 'X' }] }, { index: 1, cells: [{ index: 0, width: 10, title: 'Y' }] }]);
    const y = wide[1].cells[0]._uid!;
    expect(titles(moveCellTo(wide, y, { cellUid: wide[0].cells[0]._uid!, side: 'after' }))).toEqual([['X8', 'Y4']]);
    expect(rows).toHaveLength(3);
    expect(uidOf('A')).toBeTruthy();
  });
  it('ligne pleine : nouvelle ligne juste après, pleine largeur', () => {
    const { rows, uidOf, titles } = make();
    expect(titles(moveCellTo(rows, uidOf('A'), { cellUid: uidOf('C'), side: 'before' }))).toEqual([['B4'], ['C12'], ['A12'], ['D4']]);
  });
  it('zone entre les lignes : nouvelle ligne pleine largeur', () => {
    const { rows, uidOf, titles } = make();
    const out = moveCellTo(rows, uidOf('D'), { rowUid: rows[0]._uid!, side: 'before', newRow: true });
    expect(titles(out)).toEqual([['D12'], ['A4', 'B4'], ['C12']]);
  });
  it('cible identique ou inconnue : sans effet', () => {
    const { rows, uidOf } = make();
    expect(moveCellTo(rows, uidOf('A'), { cellUid: uidOf('A'), side: 'after' })).toBe(rows);
    expect(moveCellTo(rows, uidOf('A'), { cellUid: 'inconnue', side: 'after' })).toBe(rows);
    expect(moveCellTo(rows, 'inconnue', { cellUid: uidOf('A'), side: 'after' })).toBe(rows);
  });
});

describe('resizedWidth', () => {
  it('convertit un glissement en colonnes (ligne de 1200 px → 100 px par colonne)', () => {
    expect(resizedWidth(4, 200, 1200)).toBe(6);
    expect(resizedWidth(4, -140, 1200)).toBe(3);
    expect(resizedWidth(4, 30, 0)).toBe(4);
  });
});

describe('insertEmptyRow / locateCell', () => {
  const rows = normalizeEditRows([{ index: 0, cells: [{ index: 0, width: 6 }] }, { index: 1, cells: [{ index: 0, width: 12 }] }]);
  it('insère une ligne vide avant ou après et renvoie sa cellule', () => {
    const before = insertEmptyRow(rows, rows[1]._uid!, 'before')!;
    expect(before.rows).toHaveLength(3);
    expect(before.rows[1].cells[0]).toMatchObject({ width: 12, media: { type: 'empty' }, _uid: before.cellUid });
    const after = insertEmptyRow(rows, rows[1]._uid!, 'after')!;
    expect(locateCell(after.rows, after.cellUid)).toEqual({ r: 2, c: 0 });
    expect(after.rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });
  it('ligne inconnue : rien', () => expect(insertEmptyRow(rows, 'inconnue', 'after')).toBeUndefined());
  it('cellule disparue : introuvable', () => expect(locateCell(rows, 'x')).toBeUndefined());
});

describe('insertEmptyCell (dépôt d’un élément au bord d’une cellule)', () => {
  const cell = (width: number): EditRow['cells'][number] => ({ _uid: `c${width}-${Math.random()}`, index: 0, width, height: 1, media: { type: 'text', source: 'x' } } as never);
  const rowOf = (...widths: number[]): EditRow => ({ _uid: `r-${Math.random()}`, index: 0, cells: widths.map(cell) });

  it('ligne avec de la place : la nouvelle cellule prend jusqu’à 6 colonnes, à gauche ou à droite', () => {
    const rows = [rowOf(6)];
    const after = insertEmptyCell(rows, rows[0].cells[0]._uid!, 'after')!;
    expect(after.rows[0].cells.map((c) => c.width)).toEqual([6, 6]);
    expect(after.rows[0].cells[1]._uid).toBe(after.cellUid);
    const before = insertEmptyCell([rowOf(8)], rows[0].cells[0]._uid!, 'before');
    expect(before).toBeUndefined();
    const rows2 = [rowOf(8)];
    const b2 = insertEmptyCell(rows2, rows2[0].cells[0]._uid!, 'before')!;
    expect(b2.rows[0].cells.map((c) => c.width)).toEqual([4, 8]);
    expect(b2.rows[0].cells[0]._uid).toBe(b2.cellUid);
  });
  it('ligne pleine : la cellule voisine cède la moitié de sa largeur', () => {
    const rows = [rowOf(12)];
    const r = insertEmptyCell(rows, rows[0].cells[0]._uid!, 'after')!;
    expect(r.rows[0].cells.map((c) => c.width)).toEqual([6, 6]);
  });
  it('ligne pleine et cellule d’une colonne : nouvelle ligne juste après', () => {
    const rows = [rowOf(1, 11)];
    const r = insertEmptyCell(rows, rows[0].cells[0]._uid!, 'after')!;
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1].cells[0]._uid).toBe(r.cellUid);
    expect(r.rows[1].cells[0].width).toBe(12);
  });
  it('cellule introuvable : sans effet', () => {
    expect(insertEmptyCell([rowOf(6)], 'inconnue', 'after')).toBeUndefined();
  });
});
