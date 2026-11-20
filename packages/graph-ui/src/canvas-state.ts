import { applyNodeChanges, type Node, type NodeChange, type XYPosition } from '@xyflow/react';

export interface CanvasState<N extends Node> {
  nodes: N[];
  positions: Record<string, XYPosition>;
}

// Keep the full controlled-node state, including measured/dragging, between pointer events.
export function changeCanvas<N extends Node>(state: CanvasState<N>, changes: NodeChange<N>[]): CanvasState<N> {
  const nodes = applyNodeChanges(changes, state.nodes);
  const positions = { ...state.positions };
  for (const change of changes) if (change.type === 'position' && change.position) positions[change.id] = change.position;
  return { nodes, positions };
}

// Selection/folding changes presentation only. They must not replay initial coordinates over a drag.
export function reconcileCanvas<N extends Node>(state: CanvasState<N>, projected: N[], reset = false): CanvasState<N> {
  const previous = new Map(state.nodes.map(node => [node.id, node]));
  return {
    positions: reset ? {} : state.positions,
    nodes: projected.map(node => {
      const old = previous.get(node.id);
      return { ...old, ...node,
        position: reset ? node.position : state.positions[node.id] ?? node.position,
        dragging: reset ? false : old?.dragging,
        measured: old?.measured
      };
    })
  };
}
