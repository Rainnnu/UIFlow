import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType, BaseEdge, useUpdateNodeInternals, useReactFlow, useNodesInitialized, type Node, type NodeProps, type Edge, type EdgeProps, type NodeChange } from '@xyflow/react';
import { traceData, traceCallback, isDataEdge, type GraphNode, type ProjectGraph } from '@uiflow/core';
import { projectGraph } from './projection';
import { filterView, defaultCollapsed } from './view-filter';
import { validGraph } from '../../core/src/validate';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { layoutStructure } from './layout';
import { routeEdges, roundedPath, type Route, type Obstacle, type Point } from './routing';
import { changeCanvas, reconcileCanvas, type CanvasState } from './canvas-state';
import type { SourceActions } from '../../core/src/messages';
import '@xyflow/react/dist/style.css';
import './style.css';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
type Port = { id: string; name: string; output: boolean };
const isContainer = (model: GraphNode) => model.kind === 'component-use' || model.kind === 'jsx-region';
const portPercent = (container: boolean, collapsed: boolean, index: number, count: number) => container && !collapsed ? 30 + (index + 1) * 50 / (count + 1) : 58 + (index + 1) * 24 / (count + 1);
type CanvasNode = Node<{ model: GraphNode; ports: Port[]; collapsed: boolean; toggle: (id: string) => void; inspectPort: (node: string, port: string) => void }, 'semantic'>;
const initialLayout: Record<string, { x: number; y: number; width: number; height: number }> = {
  page: { x: 0, y: 0, width: 1080, height: 740 },
  keyword: { x: 55, y: 110, width: 180, height: 80 }, products: { x: 360, y: 110, width: 180, height: 80 },
  filter: { x: 360, y: 290, width: 180, height: 100 }, filtered: { x: 700, y: 290, width: 180, height: 80 },
  search: { x: 55, y: 475, width: 230, height: 190 }, setter: { x: 55, y: 290, width: 180, height: 80 },
  list: { x: 650, y: 475, width: 360, height: 200 }, card: { x: 40, y: 80, width: 280, height: 80 }
};
function SemanticNode({ id, data }: NodeProps<CanvasNode>) {
  const container = isContainer(data.model);
  const update = useUpdateNodeInternals();
  const portKey = data.ports.map(p => `${p.id}:${p.output}`).join('|');
  useEffect(() => { update(id); }, [id, portKey, data.collapsed, update]);
  const input = data.ports.filter(p => !p.output); const output = data.ports.filter(p => p.output);
  return <div className={`semantic ${container ? 'container' : 'value'} ${data.model.kind}`}>
    <div className="node-title"><span>{data.model.label}</span>{container && id !== 'card' && <button className="nodrag nopan" aria-label={`${data.collapsed ? '展开' : '折叠'} ${data.model.label}`} onClick={e => { e.stopPropagation(); data.toggle(id); }}>{data.collapsed ? '+' : '−'}</button>}</div>
    <span className="kind">{{ 'component-use': '组件', 'jsx-region': 'JSX', state: 'State', value: 'Value', transform: 'Transform', handler: 'Callback', unknown: '未解析' }[data.model.kind]}</span>
    {[[input, false], [output, true]].map(([items, out]) => (items as Port[]).map((p, i, all) => <React.Fragment key={p.id}>
      <Handle id={p.id} type={out ? 'source' : 'target'} position={out ? Position.Right : Position.Left} style={{ top: `${portPercent(container, data.collapsed, i, all.length)}%` }} isConnectable={false} />
      {!out && container && <Handle id={p.id} type="source" position={Position.Left} style={{ top: `${portPercent(container, data.collapsed, i, all.length)}%`, opacity: 0, pointerEvents: 'none' }} isConnectable={false} />}
      <button className={`port-label nodrag nopan ${out ? 'output' : 'input'} ${['in', 'out', 'output', 'input'].includes(p.name) ? 'generic' : ''}`} style={{ top: `${portPercent(container, data.collapsed, i, all.length)}%` }} onClick={e => { e.stopPropagation(); data.inspectPort(id, p.id); }} aria-label={`${data.model.label}.${p.name}`} title={`${data.model.label}.${p.name}`}>{p.name}</button>
    </React.Fragment>))}
  </div>;
}
const nodeTypes = { semantic: SemanticNode };
type RoutedEdge = Edge<{ route?: Route; caption?: string; active?: boolean }>;
function DependencyEdge({ id, data, markerEnd, style, interactionWidth }: EdgeProps<RoutedEdge>) {
  if (!data?.route) return null;
  const path = roundedPath(data.route.points);
  return <g className={`dependency-edge ${data.active ? 'active' : ''}`}>
    <path className="edge-halo" d={path} fill="none" />
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth} />
    {data.caption && <g className="edge-caption" transform={`translate(${data.route.label.x},${data.route.label.y})`} style={{ opacity: style?.opacity }}>
      <rect x="-24" y="-10" width="48" height="20" rx="5" /><text textAnchor="middle" dominantBaseline="central">{data.caption}</text>
    </g>}
  </g>;
}
const edgeTypes = { dependency: DependencyEdge };
function FitVisibleGraph({ viewKey }: { viewKey: string }) {
  const ready = useNodesInitialized(); const { fitView } = useReactFlow();
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => { void fitView({ padding: 0.1, maxZoom: 1.15, duration: 180 }); });
    return () => cancelAnimationFrame(frame);
  }, [ready, viewKey, fitView]);
  return null;
}
type Selection = { kind: 'node' | 'edge' | 'port'; id: string; port?: string };
function App() {
  const [graph, setGraph] = useState<ProjectGraph>(); const [error, setError] = useState('');
  const [actions, setActions] = useState<SourceActions>({});
  const [mode, setMode] = useState<'demo' | 'structure'>('structure');
  const [graphKey, setGraphKey] = useState('');
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyPath, setOnlyPath] = useState(false);
  const revision = useRef(-1);
  const baseLayout = useRef(initialLayout);
  const [navigationStatus, setNavigationStatus] = useState('');
  const requestId = useRef('');
  const navigationId = useRef('');
  const reload = useCallback(() => {
    requestId.current = crypto.randomUUID(); navigationId.current = '';
    setActions({}); setError(''); setNavigationStatus(''); setPending(true); setStale(true);
    vscode?.postMessage({ type: 'requestGraph', requestId: requestId.current });
  }, []);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selection, setSelection] = useState<Selection>();
  const [layout, setLayout] = useState(initialLayout);
  const [canvas, setCanvas] = useState<CanvasState<CanvasNode>>({ nodes: [], positions: {} });
  const appliedLayout = useRef<typeof layout | undefined>(undefined);
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setCanvas(previous => changeCanvas(previous, changes));
  }, []);
  useEffect(() => {
    if (!vscode) { setError('请从 VS Code 的 UIFlow 命令打开演示画布。'); return; }
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (message && ['graphLoading', 'graphInvalidated', 'graphLoaded', 'analysisFailed'].includes(message.type)) {
        if (!Number.isInteger(message.revision) || message.revision < revision.current) return;
        revision.current = message.revision;
        if (message.type === 'graphLoading') { setPending(true); setStale(true); setActions({}); setError(''); return; }
        if (message.type === 'graphInvalidated') { setPending(false); setStale(true); setActions({}); setError(message.message); navigationId.current = ''; return; }
        if (message.type === 'graphLoaded') {
          setPending(false);
          if (!validGraph(message.graph) || !message.actions || typeof message.actions !== 'object') { setError('图数据无效，请刷新重试。'); setGraph(undefined); setActions({}); return; }
          setStale(false);
          const nextLayout = message.mode === 'demo' ? initialLayout : layoutStructure(message.graph);
          baseLayout.current = nextLayout; setLayout({ ...nextLayout }); setCollapsed(message.mode === 'demo' ? new Set() : defaultCollapsed(message.graph)); setSelection(previous => previous && (message.graph.nodes.some((n: GraphNode) => n.id === previous.id) || message.graph.edges.some((e: Edge) => e.id === previous.id)) ? previous : undefined);
          setMode(message.mode); setGraphKey(message.requestId); setGraph(message.graph); setActions(message.actions); setError('');
        }
        if (message.type === 'analysisFailed') { setPending(false); setStale(true); setError(message.message); setGraph(undefined); setActions({}); }
      }
      if (message?.requestId === navigationId.current) {
        if (message.type === 'sourceRevealed') setNavigationStatus('已定位');
        if (message.type === 'navigationFailed') setNavigationStatus(message.message);
      }
    };
    window.addEventListener('message', listener); reload();
    return () => window.removeEventListener('message', listener);
  }, [reload]);
  useEffect(() => { navigationId.current = ''; setNavigationStatus(''); }, [selection]);
  const toggle = useCallback((id: string) => { setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const inspectPort = useCallback((id: string, port: string) => setSelection({ kind: 'port', id, port }), []);
  const trace = useMemo(() => {
    if (!graph || !selection) return;
    if (selection.kind === 'node') return traceData(graph, selection.id, mode === 'demo');
    if (selection.kind === 'edge' && graph.edges.some(e => e.id === selection.id && !isDataEdge(e))) return traceCallback(graph, selection.id, mode === 'demo');
  }, [graph, selection, mode]);
  useEffect(() => { if (!trace) setOnlyPath(false); }, [trace]);
  const filtered = useMemo(() => graph ? filterView(graph, query, onlyPath ? trace?.nodes ?? new Set<string>() : undefined) : undefined, [graph, query, onlyPath, trace]);
  const projected = useMemo(() => filtered ? projectGraph(filtered, query.trim() || onlyPath ? new Set() : collapsed) : undefined, [filtered, collapsed, query, onlyPath]);
  const highlighted = useMemo(() => {
  const highlighted = new Set(trace?.nodes);
  if (graph && trace) for (const node of graph.nodes) if (trace.nodes.has(node.id)) { let parent = node.parentId; while (parent) { highlighted.add(parent); parent = graph.nodes.find(n => n.id === parent)?.parentId; } }
  return highlighted;
  }, [graph, trace]);
  const displayLayout = useMemo(() => mode === 'structure' && filtered ? layoutStructure(filtered, query.trim() || onlyPath ? new Set() : collapsed) : layout, [mode, filtered, collapsed, layout, query, onlyPath]);
  const nodes: CanvasNode[] = useMemo(() => (projected?.nodes ?? []).map(model => {
    const summary: Port[] = [];
    for (const edge of projected!.edges) {
      if (edge.viewSource === model.id && edge.viewSource !== edge.source.nodeId) summary.push({ id: edge.sourceHandle!, name: '汇总 · 1', output: true });
      if (edge.viewTarget === model.id && edge.viewTarget !== edge.target.nodeId) summary.push({ id: edge.targetHandle!, name: '汇总 · 1', output: false });
    }
    const box = displayLayout[model.id] ?? { x: 0, y: 0, width: 340, height: 110 }; const isCollapsed = !(query.trim() || onlyPath) && collapsed.has(model.id);
    return { id: model.id, type: 'semantic', parentId: model.parentId, extent: model.parentId ? 'parent' : undefined,
      position: { x: box.x, y: box.y }, style: { width: isCollapsed ? Math.min(box.width, 300) : box.width, height: isCollapsed ? 110 : box.height, opacity: trace && !highlighted.has(model.id) ? 0.35 : 1 },
      zIndex: isContainer(model) ? 0 : 5, className: highlighted.has(model.id) ? 'traced' : '', selected: selection?.id === model.id,
      data: { model, collapsed: isCollapsed, toggle, inspectPort, ports: [...model.ports.map(p => ({ id: p.id, name: p.name, output: p.kind === 'value-out' || p.kind === 'callback' || p.kind === 'state-setter' })), ...summary] }
    };
  }), [projected, displayLayout, collapsed, trace, highlighted, selection, toggle, inspectPort, query, onlyPath]);
  useLayoutEffect(() => {
    const reset = appliedLayout.current !== layout;
    appliedLayout.current = layout;
    setCanvas(previous => reconcileCanvas(previous, nodes, reset));
  }, [nodes, layout]);
  const routes = useMemo(() => {
    const byId = new Map(canvas.nodes.map(n => [n.id, n])); const absolute = new Map<string, Point>();
    const origin = (id: string): Point => {
      if (absolute.has(id)) return absolute.get(id)!;
      const node = byId.get(id)!; const parent = node.parentId && byId.has(node.parentId) ? origin(node.parentId) : { x: 0, y: 0 };
      const point = { x: parent.x + node.position.x, y: parent.y + node.position.y }; absolute.set(id, point); return point;
    };
    const obstacles: Obstacle[] = canvas.nodes.map(n => ({ id: n.id, ...origin(n.id), width: Number(n.style?.width ?? 208), height: isContainer(n.data.model) && !n.data.collapsed ? 65 : Number(n.style?.height ?? 88) }));
    const endpoint = (id: string, port: string | undefined, source: boolean) => {
      const node = byId.get(id)!; const p = node.data.ports.find(p => p.id === port); const output = p?.output ?? source;
      const ports = node.data.ports.filter(p => p.output === output); const i = Math.max(0, ports.findIndex(p => p.id === port));
      const point = origin(id); return { x: point.x + (output ? Number(node.style?.width ?? 208) : 0), y: point.y + Number(node.style?.height ?? 88) * portPercent(isContainer(node.data.model), node.data.collapsed, i, Math.max(ports.length, 1)) / 100, output };
    };
    return routeEdges((projected?.edges ?? []).filter(e => byId.has(e.viewSource) && byId.has(e.viewTarget)).map(e => {
      const source = endpoint(e.viewSource, e.sourceHandle, true); return { id: e.id, source, target: endpoint(e.viewTarget, e.targetHandle, false), sourceSide: source.output ? 'right' as const : 'left' as const };
    }), obstacles);
  }, [canvas.nodes, projected]);
  const edges: RoutedEdge[] = (projected?.edges ?? []).map(edge => {
    const data = isDataEdge(edge); const active = trace?.edges.has(edge.id) || selection?.id === edge.id;
    const color = data ? 'var(--flow-data)' : 'var(--flow-event)';
    return { id: edge.id, source: edge.viewSource, target: edge.viewTarget, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle,
      type: 'dependency', zIndex: active ? 4 : 3, data: { route: routes[edge.id], caption: data ? undefined : edge.kind === 'callback-bind' ? '绑定' : '可更新', active },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 }, style: { stroke: color, strokeWidth: active ? 2.6 : 1.8, strokeDasharray: data ? undefined : '6 5', opacity: trace && !active ? 0.12 : active ? 1 : 0.82 },
      labelStyle: { fill: color }, labelBgStyle: { fill: 'var(--vscode-editor-background, #171c26)' }, interactionWidth: 18,
      ariaLabel: `${edge.kind}: ${edge.source.nodeId} → ${edge.target.nodeId}` };
  });
  const selectedNode = graph?.nodes.find(n => n.id === selection?.id);
  const selectedEdge = graph?.edges.find(e => e.id === selection?.id);
  const sourceActions = selection ? actions[selection.kind === 'port' ? `${selection.id}::${selection.port}` : selection.id] ?? [] : [];
  return <main><header><strong>UIFlow</strong><span className="badge">{mode === 'demo' ? '演示数据' : '静态依赖'}</span><div className="legend"><span>● 数据依赖</span><span>┄ 回调 / 潜在更新</span></div><input className="search" type="search" aria-label="搜索组件或变量" placeholder="搜索组件或变量" value={query} onChange={event => setQuery(event.target.value)} /><label className="path-filter"><input type="checkbox" disabled={!trace} checked={onlyPath} onChange={event => setOnlyPath(event.target.checked)} />仅追踪路径</label><button onClick={() => setCollapsed(new Set())}>全部展开</button><button onClick={reload} disabled={pending}>{mode === 'demo' ? '重新加载演示' : '刷新'}</button><button onClick={() => { setCollapsed(new Set()); setLayout({ ...baseLayout.current }); setSelection(undefined); }}>重置视图</button></header>
    <div className="workspace" aria-busy={pending}><section className="canvas" aria-label="组件与数据依赖画布">{graph ? projected?.nodes.length ? <ReactFlow<CanvasNode> key={graphKey} nodes={canvas.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.08 }} minZoom={0.05} maxZoom={2} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} onNodesChange={onNodesChange} onNodeClick={(_, n) => setSelection({ kind: 'node', id: n.id })} onNodeDoubleClick={(_, n) => { if (['component-use', 'jsx-region'].includes(n.data.model.kind) && n.id !== 'card') toggle(n.id); }} onEdgeClick={(_, e) => setSelection({ kind: 'edge', id: e.id })} onPaneClick={() => setSelection(undefined)}><FitVisibleGraph viewKey={`${query}|${onlyPath}|${[...collapsed].join(",")}|${graphKey}`} /><Background gap={28} size={1} color="var(--flow-grid)" /><Controls showInteractive={false} /></ReactFlow> : <p className="empty-state" role="status">{query.trim() || onlyPath ? "没有匹配的节点。" : "未找到可展示的组件结构。"}</p> : <p className="empty-state" role="status">{pending ? '正在分析…' : error || '暂无图数据。'}</p>}</section>
    <aside aria-label="所选元素详情"><h2>详情</h2>{pending && <p role="status">正在分析…</p>}{graph?.diagnostics.map((item, index) => <p className="diagnostic" key={index}>{item.message}</p>)}{error && <p role="alert">{error}</p>}{selection && (selectedNode || selectedEdge) ? <><h3>{selection.kind === 'port' ? `${selectedNode?.label}.${selection.port}` : selectedNode?.label ?? selectedEdge?.kind}</h3>{selectedNode?.notes?.map(note => <p key={note}>{note}</p>)}<dl><dt>类型</dt><dd>{selection.kind === 'port' ? 'port' : selectedNode?.kind ?? selectedEdge?.kind}</dd><dt>状态</dt><dd>{selectedNode?.confidence ?? selectedEdge?.confidence}{mode === 'demo' ? ' · 演示数据' : ''}</dd><dt>源码依据</dt><dd>{!stale && sourceActions.length ? sourceActions.map(action => <button className="relation" key={action.id} onClick={() => { navigationId.current = crypto.randomUUID(); setNavigationStatus('正在定位…'); vscode?.postMessage({ type: 'revealSource', sourceRefId: action.id, requestId: navigationId.current }); }}>{action.label}<small>{action.location}</small></button>) : '未关联'}</dd>{selectedNode && <><dt>归属</dt><dd>{graph?.nodes.find(n => n.id === selectedNode.parentId)?.label ?? '根组件'}</dd></>}{selectedEdge && <><dt>来源 → 去向</dt><dd>{graph?.nodes.find(n => n.id === selectedEdge.source.nodeId)?.label}.{selectedEdge.source.portId} → {graph?.nodes.find(n => n.id === selectedEdge.target.nodeId)?.label}.{selectedEdge.target.portId}</dd></>}</dl>{navigationStatus && <p role="status">{navigationStatus}</p>}{selectedNode && <><h4>入边 / 出边</h4>{graph?.edges.filter(e => e.source.nodeId === selectedNode.id || e.target.nodeId === selectedNode.id).map(e => <button className="relation" key={e.id} onClick={() => setSelection({ kind: 'edge', id: e.id })}>{graph?.nodes.find(n => n.id === e.source.nodeId)?.label} → {graph?.nodes.find(n => n.id === e.target.nodeId)?.label}<small>{e.kind}</small></button>)}</>}</> : <p className="empty">尚未选择元素</p>}</aside></div></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><CanvasErrorBoundary><ReactFlowProvider><App /></ReactFlowProvider></CanvasErrorBoundary></React.StrictMode>);
