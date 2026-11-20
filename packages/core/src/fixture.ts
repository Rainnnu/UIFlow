import type { GraphNode, GraphEdge, GraphPort, ProjectGraph } from './index';
const port = (id: string, kind: GraphPort['kind']): GraphPort => ({ id, name: id, kind, sourceRefs: [] });
const node = (id: string, label: string, kind: GraphNode['kind'], parentId?: string, ports: GraphPort[] = []): GraphNode => ({ id, label, kind, parentId, ports, confidence: 'partial', sourceRefs: [], notes: ['M0 硬编码演示，未经源码分析'] });
const edge = (id: string, kind: GraphEdge['kind'], from: string, to: string, sourcePort: string, targetPort: string): GraphEdge => ({ id, kind, source: { nodeId: from, portId: sourcePort }, target: { nodeId: to, portId: targetPort }, sourceRefs: [], confidence: 'partial', notes: ['M0 演示关系，无源码证据'] });
export const demoGraph: ProjectGraph = {
  schemaVersion: 1, rootNodeIds: ['page'], definitions: [], diagnostics: [],
  nodes: [
    node('page', 'ProductPage', 'component-use'),
    node('keyword', 'keyword', 'state', 'page', [port('in', 'value-in'), port('out', 'value-out')]),
    node('products', 'products', 'value', 'page', [port('out', 'value-out')]),
    node('filter', 'filter()', 'transform', 'page', [port('keyword', 'value-in'), port('products', 'value-in'), port('out', 'value-out')]),
    node('filtered', 'filtered', 'value', 'page', [port('in', 'value-in'), port('out', 'value-out')]),
    node('search', 'SearchInput', 'component-use', 'page', [port('value', 'value-in'), port('onChange', 'callback')]),
    node('setter', 'setKeyword', 'handler', 'page', [port('in', 'value-in'), port('out', 'state-setter')]),
    node('list', 'ProductList', 'component-use', 'page', [port('products', 'value-in')]),
    node('card', 'ProductCard ×N（动态）', 'component-use', 'list')
  ],
  edges: [
    edge('keyword-filter', 'data-read', 'keyword', 'filter', 'out', 'keyword'),
    edge('products-filter', 'data-read', 'products', 'filter', 'out', 'products'),
    edge('filter-filtered', 'derive', 'filter', 'filtered', 'out', 'in'),
    edge('filtered-list', 'prop-pass', 'filtered', 'list', 'out', 'products'),
    edge('keyword-search', 'prop-pass', 'keyword', 'search', 'out', 'value'),
    edge('search-setter', 'callback-bind', 'search', 'setter', 'onChange', 'in'),
    edge('setter-keyword', 'state-write', 'setter', 'keyword', 'out', 'in')
  ]
};
