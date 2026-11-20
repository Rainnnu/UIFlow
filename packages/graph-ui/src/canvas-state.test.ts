import { describe, expect, it } from 'vitest';
import { changeCanvas, reconcileCanvas, type CanvasState } from './canvas-state';
import type { Node } from '@xyflow/react';

const projection: Node[] = [
  { id: 'parent', position: { x: 0, y: 0 }, data: {}, style: { width: 600, height: 400 } },
  { id: 'child', parentId: 'parent', extent: 'parent', position: { x: 28, y: 84 }, data: {} }
];
const initial = (): CanvasState<Node> => reconcileCanvas({ nodes: [], positions: {} }, projection, true);
describe('controlled canvas drag regression', () => {
  it('adopts compact auto layout while preserving explicitly dragged positions', () => {
    const moved = changeCanvas(initial(), [{ id: 'child', type: 'position', position: { x: 80, y: 120 }, dragging: false }]);
    const compact = projection.map(node => ({ ...node, position: { x: 5, y: 10 } }));
    const next = reconcileCanvas(moved, compact);
    expect(next.nodes[0].position).toEqual({ x: 5, y: 10 }); expect(next.nodes[1].position).toEqual({ x: 80, y: 120 });
  });
  it('preserves pointer position, dragging and dimensions through selection/presentation changes', () => {
    let state = changeCanvas(initial(), [{ id: 'child', type: 'dimensions', dimensions: { width: 100, height: 110 } }]);
    for (let x = 30; x < 100; x += 5) {
      state = changeCanvas(state, [{ id: 'child', type: 'position', position: { x, y: 90 }, dragging: true }]);
      state = reconcileCanvas(state, projection.map(n => ({ ...n, selected: n.id === 'child' })));
      expect(state.nodes[1]).toMatchObject({ position: { x, y: 90 }, dragging: true, measured: { width: 100, height: 110 }, parentId: 'parent' });
    }
    state = changeCanvas(state, [{ id: 'child', type: 'position', dragging: false }]);
    expect(state.nodes[1].dragging).toBe(false);
    expect(state.nodes[1].position.x).toBe(95);
  });
  it('uses the latest positions when multiple batches arrive before a render', () => {
    let state = changeCanvas(initial(), [{ id: 'parent', type: 'position', position: { x: 100, y: 100 }, dragging: true }]);
    state = changeCanvas(state, [{ id: 'child', type: 'position', position: { x: 50, y: 90 }, dragging: true }]);
    expect(state.nodes.map(n => n.position)).toEqual([{ x: 100, y: 100 }, { x: 50, y: 90 }]);
    expect(state.nodes[1].parentId).toBe('parent');
  });
  it('restores moved children after folding and resets positions only on explicit layout reset', () => {
    let state = changeCanvas(initial(), [{ id: 'child', type: 'position', position: { x: 80, y: 120 }, dragging: false }]);
    state = reconcileCanvas(state, [projection[0]]);
    state = reconcileCanvas(state, projection);
    expect(state.nodes[1].position).toEqual({ x: 80, y: 120 });
    state = reconcileCanvas(state, projection, true);
    expect(state.nodes[1].position).toEqual({ x: 28, y: 84 });
    expect(state.positions).toEqual({});
  });
});
