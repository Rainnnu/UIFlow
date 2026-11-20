import { describe, expect, it } from 'vitest';
import { demoGraph } from '../../core/src/fixture';
import { filterView, defaultCollapsed } from './view-filter';
import { validGraph } from '../../core/src/validate';
describe('M4 bounded view projection', () => {
  it('keeps search matches and their ancestors without fabricating edges', () => {
    const graph = filterView(demoGraph, 'ProductCard');
    expect(graph.nodes.map(n => n.id)).toEqual(['page','list','card']); expect(graph.edges).toEqual([]);
    expect(filterView(demoGraph, 'nothing').nodes).toEqual([]);
    expect(filterView(demoGraph, '', new Set(['keyword','filter','filtered'])).nodes.map(n => n.id)).toEqual(['page','keyword','filter','filtered']);
  });
  it('collapses deeper component levels and leaves current component and first children open', () => {
    const collapsed = defaultCollapsed(demoGraph);
    expect(collapsed.has('page')).toBe(false); expect(collapsed.has('list')).toBe(false); expect(collapsed.has('card')).toBe(true);
  });
  it('rejects malformed and cyclic graph payloads before rendering', () => {
    expect(validGraph(demoGraph)).toBe(true);
    const cycle = structuredClone(demoGraph); cycle.nodes[0].parentId = 'card'; expect(validGraph(cycle)).toBe(false);
    const bad = structuredClone(demoGraph); bad.edges[0].target.nodeId = 'missing'; expect(validGraph(bad)).toBe(false);
    for (const value of [null, {}, { ...demoGraph, nodes: 'bad' }, { ...demoGraph, nodes: [null] }, { ...demoGraph, nodes: [{ ...demoGraph.nodes[0], ports: [null] }] }]) expect(validGraph(value)).toBe(false);
  });
});
