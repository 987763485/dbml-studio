import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { TableLayout } from '../types';
import { tableSize, type ViewModel } from './model';

const elk = new ELK();

export type LayoutDirection = 'RIGHT' | 'DOWN';

export interface LayoutResult {
  positions: Record<string, TableLayout>;
  direction: LayoutDirection;
}

function gridPlacement(
  missing: string[],
  existing: Record<string, TableLayout>,
  view: ViewModel,
): Record<string, TableLayout> {
  const positions: Record<string, TableLayout> = { ...existing };
  if (missing.length === 0) return positions;

  const sizes = new Map(
    view.tables.map((table) => {
      const { width, height } = tableSize(table);
      return [table.key, { width, height }];
    }),
  );

  let maxY = 0;
  let minX = 80;
  let maxX = 0;
  if (Object.keys(existing).length > 0) {
    minX = Math.min(...Object.values(existing).map((position) => position.x));
    maxX = Math.max(
      ...Object.entries(existing).map(
        ([key, position]) => position.x + (sizes.get(key)?.width ?? 236),
      ),
    );
    maxY = Math.max(
      ...Object.entries(existing).map(
        ([key, position]) => position.y + (sizes.get(key)?.height ?? 140),
      ),
    );
  }

  let x = Math.max(80, minX);
  let y = maxY + 90;
  let rowHeight = 0;
  let countInRow = 0;
  for (const key of missing) {
    const size = sizes.get(key) ?? { width: 236, height: 140 };
    positions[key] = { x, y };
    rowHeight = Math.max(rowHeight, size.height);
    countInRow += 1;
    x += size.width + 64;
    if (countInRow >= 3) {
      x = Math.max(80, minX);
      y += rowHeight + 64;
      rowHeight = 0;
      countInRow = 0;
    }
  }
  void maxX;
  return positions;
}

export async function autoLayout(
  view: ViewModel,
  direction: LayoutDirection,
  existing: Record<string, TableLayout> = {},
  options: { preserveExisting?: boolean; missingOnly?: string[] } = {},
): Promise<LayoutResult> {
  if (view.tables.length === 0) {
    return { positions: {}, direction };
  }

  const preserveExisting = options.preserveExisting ?? true;
  const missingOnly = new Set(
    options.missingOnly ??
      (preserveExisting
        ? view.tables.filter((table) => !existing[table.key]).map((table) => table.key)
        : view.tables.map((table) => table.key)),
  );

  if (missingOnly.size === 0) {
    return { positions: { ...existing }, direction };
  }

  if (preserveExisting && Object.keys(existing).length > 0) {
    return {
      positions: gridPlacement([...missingOnly], existing, view),
      direction,
    };
  }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '52',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.edgeRouting': 'SPLINES',
      'elk.padding': '[top=80,left=80,bottom=80,right=80]',
    },
    children: view.tables.map((table) => {
      const size = tableSize(table);
      return {
        id: table.key,
        width: size.width,
        height: size.height,
        layoutOptions: {
          'elk.portConstraints': 'UNDEFINED',
        },
      };
    }),
    edges: view.refs
      .filter(
        (ref) =>
          view.tableMap.has(ref.left.tableKey) && view.tableMap.has(ref.right.tableKey),
      )
      .map((ref, index) => ({
        id: `edge-${index}`,
        sources: [ref.left.tableKey],
        targets: [ref.right.tableKey],
      })),
  };

  const result = await elk.layout(graph);
  const positions: Record<string, TableLayout> = {};
  for (const child of result.children ?? []) {
    positions[child.id] = {
      x: Math.round(child.x ?? 80),
      y: Math.round(child.y ?? 80),
    };
  }

  return {
    positions: { ...existing, ...positions },
    direction,
  };
}

export function reconcileLayout(
  view: ViewModel,
  existing: Record<string, TableLayout>,
): Record<string, TableLayout> {
  const next: Record<string, TableLayout> = {};
  for (const table of view.tables) {
    if (existing[table.key]) next[table.key] = existing[table.key];
  }
  return next;
}

export function missingTableKeys(
  view: ViewModel,
  existing: Record<string, TableLayout>,
): string[] {
  return view.tables
    .filter((table) => !existing[table.key])
    .map((table) => table.key);
}
