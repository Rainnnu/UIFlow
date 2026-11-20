export type Confidence = 'confirmed' | 'partial' | 'unresolved';
export interface Position { line: number; character: number }
export interface SourceRef { uri: string; start: Position; end: Position; role: 'definition' | 'usage' | 'declaration' | 'expression' | 'binding' }
export type NodeKind = 'component-use' | 'jsx-region' | 'state' | 'value' | 'transform' | 'handler' | 'unknown';
export interface GraphPort { id: string; name: string; kind: 'value-in' | 'value-out' | 'callback' | 'state-setter'; sourceRefs: SourceRef[] }
export interface GraphNode { id: string; kind: NodeKind; label: string; parentId?: string; definitionId?: string; ports: GraphPort[]; sourceRefs: SourceRef[]; confidence: Confidence; notes?: string[] }
export type EdgeKind = 'data-read' | 'derive' | 'prop-pass' | 'callback-bind' | 'state-write';
export interface GraphEdge { id: string; kind: EdgeKind; source: { nodeId: string; portId?: string }; target: { nodeId: string; portId?: string }; sourceRefs: SourceRef[]; confidence: Confidence; notes?: string[] }
export interface ComponentDefinition { id: string; name: string; source: SourceRef }
export interface ProjectGraph { schemaVersion: 1; documentVersion?: number; rootNodeIds: string[]; definitions: ComponentDefinition[]; nodes: GraphNode[]; edges: GraphEdge[]; diagnostics: { code: string; message: string; source?: SourceRef }[] }

export const isDataEdge = (edge: GraphEdge) => ['data-read', 'derive', 'prop-pass'].includes(edge.kind);

// Demo traversal is explicitly enabled only by the M0 view. Production accepts confirmed evidence only.
export function traceData(graph: ProjectGraph, start: string, demo = false) {
  const nodes = new Set([start]); const edges = new Set<string>();
  const queue: Array<{ nodeId: string; portId?: string }> = [{ nodeId: start }];
  const visited = new Set<string>();
  while (queue.length) {
    const endpoint = queue.shift()!;
    const key = JSON.stringify([endpoint.nodeId, endpoint.portId]); if (visited.has(key)) continue; visited.add(key);
    const container = graph.nodes.find(n => n.id === endpoint.nodeId)?.kind === 'component-use';
    for (const edge of graph.edges) {
      if (edge.source.nodeId !== endpoint.nodeId || (container && endpoint.portId !== undefined && edge.source.portId !== endpoint.portId) || !isDataEdge(edge) || !(edge.confidence === 'confirmed' || (demo && edge.confidence === 'partial'))) continue;
      edges.add(edge.id);
      nodes.add(edge.target.nodeId); queue.push(edge.target);
    }
  }
  return { nodes, edges };
}

export function visibleOwner(graph: ProjectGraph, id: string, collapsed: ReadonlySet<string>): string {
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  let current = byId.get(id); let owner = id;
  while (current?.parentId) {
    if (collapsed.has(current.parentId)) owner = current.parentId;
    current = byId.get(current.parentId);
  }
  return owner;
}

export function traceCallback(graph: ProjectGraph, edgeId: string, demo = false) {
  const nodes = new Set<string>(); const edges = new Set<string>();
  const selected = graph.edges.find(e => e.id === edgeId);
  if (!selected || !['callback-bind', 'state-write'].includes(selected.kind)) return { nodes, edges };
  const queue = [selected];
  while (queue.length) {
    const edge = queue.shift()!;
    if (edges.has(edge.id) || !(edge.confidence === 'confirmed' || (demo && edge.confidence === 'partial'))) continue;
    edges.add(edge.id); nodes.add(edge.source.nodeId); nodes.add(edge.target.nodeId);
    for (const next of graph.edges) if (['callback-bind', 'state-write'].includes(next.kind) && next.source.nodeId === edge.target.nodeId) queue.push(next);
  }
  return { nodes, edges };
}
