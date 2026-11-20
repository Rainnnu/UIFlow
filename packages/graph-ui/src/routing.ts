import type { Box } from './layout';

export interface Point { x: number; y: number }
export interface RouteRequest { id: string; source: Point; target: Point; sourceSide: 'left' | 'right' }
export interface Route { points: Point[]; label: Point }
export interface Obstacle extends Box { id: string }

export function crosses(a: Point, b: Point, box: Box): boolean {
  return a.x === b.x
    ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height
    : a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width;
}

// A compressed rectilinear visibility grid. Routes share endpoint stubs only;
// occupied segments cost more so independent dependencies use separate channels.
export function routeEdges(requests: RouteRequest[], obstacles: Obstacle[]): Record<string, Route> {
  if (!requests.length) return {};
  const boxes = obstacles.map(b => ({ ...b, x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20 }));
  const stubs = requests.map(r => ({ start: { x: r.source.x + (r.sourceSide === 'left' ? -24 : 24), y: r.source.y }, end: { x: r.target.x - 24, y: r.target.y } }));
  const xs = new Set<number>(); const ys = new Set<number>();
  for (const b of boxes) {
    for (const gap of [8, 20, 32]) { xs.add(b.x - gap); xs.add(b.x + b.width + gap); ys.add(b.y - gap); ys.add(b.y + b.height + gap); }
  }
  for (const { start, end } of stubs) { xs.add(start.x); xs.add(end.x); ys.add(start.y); ys.add(end.y); }
  const x = [...xs].sort((a, b) => a - b); const y = [...ys].sort((a, b) => a - b);
  const width = x.length; const size = width * y.length;
  const point = (n: number): Point => ({ x: x[n % width], y: y[Math.floor(n / width)] });
  const index = (p: Point) => y.indexOf(p.y) * width + x.indexOf(p.x);
  const occupied = new Map<string, number>(); const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const blocked = new Map<string, boolean>();
  const allowed = (a: number, b: number) => {
    const k = key(a, b);
    if (!blocked.has(k)) blocked.set(k, boxes.some(box => crosses(point(a), point(b), box)));
    return !blocked.get(k);
  };
  const result: Record<string, Route> = {};
  requests.forEach((request, requestIndex) => {
    const { start, end } = stubs[requestIndex]; const from = index(start); const to = index(end);
    const distances = new Float64Array(size * 2).fill(Infinity); const previous = new Int32Array(size * 2).fill(-1);
    // Binary heap avoids quadratic routing work while nodes are being dragged.
    const heap: Array<{ state: number; score: number; cost: number }> = [];
    const push = (item: typeof heap[number]) => { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].score <= item.score) break; heap[i] = heap[p]; i = p; } heap[i] = item; };
    const pop = () => { const first = heap[0]; const last = heap.pop()!; if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++; if (heap[c].score >= last.score) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return first; };
    distances[from * 2] = 0; push({ state: from * 2, score: 0, cost: 0 }); let finish = -1;
    while (heap.length) {
      const current = pop(); if (current.cost !== distances[current.state]) continue;
      const cell = current.state >> 1; if (cell === to) { finish = current.state; break; }
      const col = cell % width; const row = Math.floor(cell / width);
      const neighbours = [col > 0 ? cell - 1 : -1, col + 1 < width ? cell + 1 : -1, row > 0 ? cell - width : -1, row + 1 < y.length ? cell + width : -1];
      for (let direction = 0; direction < 4; direction++) {
        const next = neighbours[direction]; if (next < 0 || !allowed(cell, next)) continue;
        const axis = direction < 2 ? 0 : 1; const a = point(cell); const b = point(next); const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        const cost = current.cost + length + (axis !== current.state % 2 ? 28 : 0) + (occupied.get(key(cell, next)) ?? 0) * (length * 8 + 80);
        const state = next * 2 + axis;
        if (cost >= distances[state]) continue;
        distances[state] = cost; previous[state] = current.state;
        push({ state, cost, score: cost + Math.abs(b.x - end.x) + Math.abs(b.y - end.y) });
      }
    }
    const cells: number[] = [];
    for (let cursor = finish; cursor >= 0; cursor = previous[cursor]) cells.push(cursor >> 1);
    cells.reverse();
    for (let i = 1; i < cells.length; i++) { const k = key(cells[i - 1], cells[i]); occupied.set(k, (occupied.get(k) ?? 0) + 1); }
    // Overlapping manually dragged nodes can leave no free route. Keep real endpoints;
    // rendering under nodes hides the unavoidable crossing instead of moving semantics.
    const raw = [request.source, ...(cells.length ? cells.map(point) : [start, { x: end.x, y: start.y }, end]), request.target];
    const points = raw.filter((p, i) => !i || p.x !== raw[i - 1].x || p.y !== raw[i - 1].y).filter((p, i, all) => !i || i === all.length - 1 || !((all[i - 1].x === p.x && p.x === all[i + 1].x) || (all[i - 1].y === p.y && p.y === all[i + 1].y)));
    // Labels belong on a long free segment, never over a node or endpoint.
    let best = -1; let label = start;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]; const b = points[i]; const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const score = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (score > best && !boxes.some(box => middle.x > box.x - 20 && middle.x < box.x + box.width + 20 && middle.y > box.y - 12 && middle.y < box.y + box.height + 12)) { best = score; label = middle; }
    }
    result[request.id] = { points, label };
  });
  return result;
}

export function roundedPath(points: Point[]): string {
  if (!points.length) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]; const b = points[i]; const c = points[i + 1];
    const before = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); const after = Math.abs(c.x - b.x) + Math.abs(c.y - b.y); const r = Math.min(7, before / 2, after / 2);
    path += ` L ${b.x + Math.sign(a.x - b.x) * r} ${b.y + Math.sign(a.y - b.y) * r} Q ${b.x} ${b.y} ${b.x + Math.sign(c.x - b.x) * r} ${b.y + Math.sign(c.y - b.y) * r}`;
  }
  const last = points[points.length - 1]; return `${path} L ${last.x} ${last.y}`;
}
