import type { ProjectGraph } from './index';

// Reject malformed transport data before layout/traversal. This does not promote evidence.
export function validGraph(value: unknown): value is ProjectGraph {
  if (!value || typeof value !== 'object') return false;
  const graph = value as ProjectGraph;
  if (graph.schemaVersion !== 1 || !Array.isArray(graph.nodes) || graph.nodes.length > 2000 || !Array.isArray(graph.edges) || graph.edges.length > 10000 || !Array.isArray(graph.rootNodeIds) || !Array.isArray(graph.definitions) || !Array.isArray(graph.diagnostics)) return false;
  const refs = (items: unknown) => Array.isArray(items) && items.every(ref => ref && typeof ref.uri === 'string' && ['definition','usage','declaration','expression','binding'].includes(ref.role) && [ref.start, ref.end].every(p => p && Number.isInteger(p.line) && p.line >= 0 && Number.isInteger(p.character) && p.character >= 0));
  const ids = new Map<string, typeof graph.nodes[number]>();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id) || typeof node.label !== 'string' || !['component-use','jsx-region','state','value','transform','handler','unknown'].includes(node.kind) || !['confirmed','partial','unresolved'].includes(node.confidence) || !refs(node.sourceRefs) || !Array.isArray(node.ports) || node.ports.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || !['value-in','value-out','callback','state-setter'].includes(p.kind) || !refs(p.sourceRefs)) || (node.notes && (!Array.isArray(node.notes) || node.notes.some(n => typeof n !== 'string')))) return false;
    ids.set(node.id, node);
  }
  for (const node of graph.nodes) {
    const chain = new Set([node.id]); let parent = node.parentId;
    while (parent) { if (!ids.has(parent) || chain.has(parent)) return false; chain.add(parent); parent = ids.get(parent)!.parentId; }
  }
  if (graph.rootNodeIds.some(id => !ids.has(id))) return false;
  for (const edge of graph.edges) if (!edge || typeof edge.id !== 'string' || !['data-read','derive','prop-pass','callback-bind','state-write'].includes(edge.kind) || !['confirmed','partial','unresolved'].includes(edge.confidence) || !refs(edge.sourceRefs) || [edge.source, edge.target].some(p => !p || !ids.has(p.nodeId) || (p.portId !== undefined && !ids.get(p.nodeId)!.ports.some(port => port.id === p.portId)))) return false;
  return graph.diagnostics.every(d => d && typeof d.code === 'string' && typeof d.message === 'string');
}
