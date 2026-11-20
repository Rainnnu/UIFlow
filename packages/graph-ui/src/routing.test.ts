import { describe, expect, it } from 'vitest';
import { routeEdges, crosses, type Point, type Obstacle } from './routing';
import { layoutStructure } from './layout';
import { demoGraph } from '../../core/src/fixture';

function avoids(points: Point[], boxes: Obstacle[]) {
  for (let i = 1; i < points.length; i++) {
    expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
    for (const box of boxes) expect(crosses(points[i - 1], points[i], box), `${box.id}: segment ${i}`).toBe(false);
  }
}
describe('readable dependency routes', () => {
  const boxes = [
    { id: 'state', x: 0, y: 0, width: 208, height: 88 },
    { id: 'middle', x: 288, y: 0, width: 208, height: 88 },
    { id: 'setter', x: 576, y: 0, width: 208, height: 88 }
  ];
  it('routes a backward setter around every card instead of through its title', () => {
    const request = { id: 'update', source: { x: 784, y: 60 }, target: { x: 0, y: 60 }, sourceSide: 'right' as const };
    const route = routeEdges([request], boxes).update;
    expect(route.points[0]).toEqual(request.source); expect(route.points.at(-1)).toEqual(request.target);
    avoids(route.points, boxes);
    expect(boxes.some(b => crosses({ x: route.label.x - 24, y: route.label.y }, { x: route.label.x + 24, y: route.label.y }, b))).toBe(false);
  });
  it('separates parallel routes after their shared endpoint stubs', () => {
    const request = { source: { x: 208, y: 60 }, target: { x: 576, y: 60 }, sourceSide: 'right' as const };
    const routes = routeEdges([{ ...request, id: 'a' }, { ...request, id: 'b' }], boxes);
    avoids(routes.a.points, boxes); avoids(routes.b.points, boxes);
    expect(routes.a.points).not.toEqual(routes.b.points);
  });
  it('recomputes around a moved obstacle without altering endpoints', () => {
    const request = { id: 'read', source: { x: 208, y: 60 }, target: { x: 576, y: 60 }, sourceSide: 'right' as const };
    const moved = boxes.map(b => b.id === 'middle' ? { ...b, y: 150 } : b);
    const before = routeEdges([request], boxes).read; const after = routeEdges([request], moved).read;
    avoids(after.points, moved); expect(after.points).not.toEqual(before.points);
    expect(after.points[0]).toEqual(request.source); expect(after.points.at(-1)).toEqual(request.target);
  });
  it('keeps containment while ordering the data pipeline from left to right', () => {
    const graph = structuredClone(demoGraph); const original = JSON.stringify(graph); const boxes = layoutStructure(graph);
    expect(boxes.keyword.x).toBeLessThan(boxes.filter.x); expect(boxes.products.x).toBeLessThan(boxes.filter.x); expect(boxes.filter.x).toBeLessThan(boxes.filtered.x);
    for (const node of graph.nodes.filter(n => n.parentId)) {
      expect(boxes[node.id].x).toBeGreaterThan(0); expect(boxes[node.id].x + boxes[node.id].width).toBeLessThanOrEqual(boxes[node.parentId!].width);
      expect(boxes[node.id].y + boxes[node.id].height).toBeLessThanOrEqual(boxes[node.parentId!].height);
    }
    expect(JSON.stringify(graph)).toBe(original);
  });
  it('compacts folded containers and preserves horizontal separation of siblings', () => {
    const open = layoutStructure(demoGraph); const folded = layoutStructure(demoGraph, new Set(['list']));
    expect(folded.list.height).toBe(112); expect(folded.page.height).toBeLessThanOrEqual(open.page.height);
    expect(folded.card).toBeUndefined();
    const a = folded.search; const b = folded.list;
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  });
});
