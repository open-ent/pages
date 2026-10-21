import { describe, expect, it } from 'vitest';

import { stripUids, addCell, addRow, moveCell, moveRow, normalizeEditRows, remainingColumns, removeCell, removeRow, rowsFromContent, setCellMedia, setCellWidth } from './gridEdit';

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
