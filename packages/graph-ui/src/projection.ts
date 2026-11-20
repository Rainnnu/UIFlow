import { visibleOwner, type ProjectGraph } from '@uiflow/core';

// Projection only: never mutate semantic endpoints or containment in the IR.
export function projectGraph(graph: ProjectGraph, collapsed: ReadonlySet<string>) {
  const nodes = graph.nodes.filter(n => visibleOwner(graph, n.id, collapsed) === n.id);
  const edges = graph.edges.flatMap(edge => {
    const source = visibleOwner(graph, edge.source.nodeId, collapsed);
    const target = visibleOwner(graph, edge.target.nodeId, collapsed);
    if (source === target) return [];
    return [{ ...edge, viewSource: source, viewTarget: target,
      sourceHandle: source === edge.source.nodeId ? edge.source.portId : `summary-out-${edge.id}`,
      targetHandle: target === edge.target.nodeId ? edge.target.portId : `summary-in-${edge.id}` }];
  });
  return { nodes, edges };
}
