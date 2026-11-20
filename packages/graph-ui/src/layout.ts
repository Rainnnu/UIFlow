import type { ProjectGraph } from '../../core/src/index';
export interface Box { x: number; y: number; width: number; height: number }
// Rank local values by data dependencies; callbacks never participate in the DAG.
// This is a semantic layout, not an inference of the application's CSS layout.
export function layoutStructure(graph: ProjectGraph, collapsed: ReadonlySet<string> = new Set()): Record<string, Box> {
  const result: Record<string, Box> = {};
  const children = new Map<string | undefined, string[]>();
  graph.nodes.forEach(n => { const list = children.get(n.parentId) ?? []; list.push(n.id); children.set(n.parentId, list); });
  const measure = (id: string, x: number, y: number): Box => {
    if (collapsed.has(id)) { const box = { x, y, width: 300, height: 112 }; result[id] = box; return box; }
    let cursor = 100; let width = 360;
    const childIds = children.get(id) ?? [];
    const values = childIds.filter(child => !['component-use', 'jsx-region'].includes(graph.nodes.find(n => n.id === child)!.kind));
    const containers = childIds.filter(child => !values.includes(child));
    // Keep the forward pipeline on the first row; place return callbacks afterwards.
    values.sort((a, b) => Number(graph.nodes.find(n => n.id === a)!.kind === 'handler') - Number(graph.nodes.find(n => n.id === b)!.kind === 'handler'));
    const rank = new Map(values.map(child => [child, 0]));
    const localEdges = graph.edges.filter(e => ['data-read', 'derive', 'prop-pass'].includes(e.kind) && rank.has(e.source.nodeId) && rank.has(e.target.nodeId));
    const remaining = new Set(values);
    // Kahn ordering leaves cycles at rank zero rather than expanding indefinitely.
    for (;;) {
      const ready = [...remaining].filter(child => !localEdges.some(e => e.target.nodeId === child && remaining.has(e.source.nodeId)));
      if (!ready.length) break;
      for (const child of ready) {
        remaining.delete(child);
        for (const edge of localEdges.filter(e => e.source.nodeId === child)) rank.set(edge.target.nodeId, Math.max(rank.get(edge.target.nodeId)!, rank.get(child)! + 1));
      }
    }
    const rows = new Map<number, number>();
    values.forEach((child, index) => {
      const model = graph.nodes.find(n => n.id === child)!;
      const column = localEdges.length ? model.kind === 'handler' ? Math.min(Math.max(...rank.values()), 5) : Math.min(rank.get(child)!, 5) : index % 2; const row = rows.get(column) ?? 0; rows.set(column, row + 1);
      result[child] = { x: 56 + column * 288, y: 100 + row * 148, width: 208, height: 88 };
      width = Math.max(width, result[child].x + 264);
    });
    if (values.length) cursor = 100 + Math.max(...rows.values()) * 148 + 36;
    let childX = 56; let rowHeight = 0;
    for (const child of containers) {
      const box = measure(child, childX, cursor);
      if (childX > 56 && childX + box.width > Math.max(width - 56, 1400)) { cursor += rowHeight + 56; childX = 56; rowHeight = 0; box.x = childX; box.y = cursor; }
      childX += box.width + 64; rowHeight = Math.max(rowHeight, box.height); width = Math.max(width, box.x + box.width + 56);
    }
    if (containers.length) cursor += rowHeight + 40;
    const box = { x, y, width, height: Math.max(112, cursor + 16) }; result[id] = box; return box;
  };
  let x = 0; for (const root of graph.rootNodeIds) x += measure(root, x, 0).width + 40;
  return result;
}
