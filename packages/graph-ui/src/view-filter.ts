import type { ProjectGraph } from '../../core/src/index';

export function defaultCollapsed(graph: ProjectGraph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  return new Set(graph.nodes.filter(node => {
    if (!['component-use','jsx-region'].includes(node.kind)) return false;
    let parent = node.parentId; let components = 0;
    while (parent) { const owner = byId.get(parent)!; if (owner.kind === 'component-use') components++; parent = owner.parentId; }
    return components >= 2;
  }).map(n => n.id));
}

export function filterView(graph: ProjectGraph, query: string, path?: ReadonlySet<string>) {
  const text = query.trim().toLocaleLowerCase();
  if (!text && !path) return graph;
  const byId = new Map(graph.nodes.map(n => [n.id, n])); const keep = new Set<string>();
  for (const node of graph.nodes) if ((!text || node.label.toLocaleLowerCase().includes(text)) && (!path || path.has(node.id))) {
    let current: typeof node | undefined = node;
    while (current) { keep.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined; }
  }
  return { ...graph, nodes: graph.nodes.filter(n => keep.has(n.id)), edges: graph.edges.filter(e => keep.has(e.source.nodeId) && keep.has(e.target.nodeId)), rootNodeIds: graph.rootNodeIds.filter(id => keep.has(id)) };
}
