import { describe, expect, it } from 'vitest';
import { traceData, traceCallback, visibleOwner } from './index';
import { demoGraph } from './fixture';
import { projectGraph } from '../../graph-ui/src/projection';

describe('M0 semantic boundaries', () => {
  it('keeps callback chains separate from ordinary data reads', () => {
    const trace = traceCallback(demoGraph, 'search-setter', true);
    expect([...trace.edges]).toEqual(['search-setter', 'setter-keyword']);
    expect(trace.nodes.has('filter')).toBe(false);
  });
  it('traces demo data without callback/update edges or implied child dependencies', () => {
    const trace = traceData(demoGraph, 'keyword', true);
    expect([...trace.edges].sort()).toEqual(['keyword-filter', 'filter-filtered', 'filtered-list', 'keyword-search'].sort());
    expect(trace.nodes.has('setter')).toBe(false); expect(trace.nodes.has('card')).toBe(false);
  });
  it('does not treat demonstration evidence as confirmed', () => {
    expect(traceData(demoGraph, 'keyword').edges.size).toBe(0);
    expect(demoGraph.edges.every(e => e.confidence === 'partial')).toBe(true);
  });
  it('keeps incoming boundary edges when collapsing and restores originals on expansion', () => {
    const before = JSON.stringify(demoGraph);
    const graph = structuredClone(demoGraph);
    graph.edges.push({ ...graph.edges[0], id: 'nested-read', target: { nodeId: 'card' } });
    const projected = projectGraph(graph, new Set(['list']));
    expect(projected.nodes.some(n => n.id === 'card')).toBe(false);
    expect(projected.edges.find(e => e.id === 'nested-read')).toMatchObject({ viewTarget: 'list', targetHandle: 'summary-in-nested-read' });
    expect(projectGraph(graph, new Set()).edges.find(e => e.id === 'nested-read')?.viewTarget).toBe('card');
    expect(JSON.stringify(demoGraph)).toBe(before);
  });
  it('resolves outermost collapsed ancestor and hides internal edges', () => {
    expect(visibleOwner(demoGraph, 'card', new Set(['list', 'page']))).toBe('page');
    const projected = projectGraph(demoGraph, new Set(['page']));
    expect(projected.nodes.map(n => n.id)).toEqual(['page']); expect(projected.edges).toEqual([]);
  });
  it('keeps identically named nodes independent by ID and terminates cycles', () => {
    const graph = structuredClone(demoGraph);
    graph.nodes.push({ ...graph.nodes[1], id: 'other-keyword' });
    graph.edges.push({ ...graph.edges[0], id: 'cycle', source: { nodeId: 'filtered' }, target: { nodeId: 'keyword' } });
    const trace = traceData(graph, 'keyword', true);
    expect(trace.nodes.has('other-keyword')).toBe(false); expect(trace.edges.has('cycle')).toBe(true);
  });
});
