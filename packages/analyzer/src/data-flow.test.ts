import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeProgram } from './index';
import { traceData, type ProjectGraph } from '../../core/src/index';

const reactTypes = 'export declare function useState<T>(initial:T): [T, (value:T)=>void];';
function analyze(page: string, extra: Record<string, string> = {}) {
  const root = resolve('.test-output/data-virtual');
  const files = { 'Page.tsx': page, 'node_modules/react/index.d.ts': reactTypes, ...extra };
  const sources = new Map(Object.entries(files).map(([name, text]) => [resolve(root, name), text]));
  const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noLib: true, types: [], noEmit: true };
  const host = ts.createCompilerHost(options);
  host.fileExists = file => sources.has(resolve(file)); host.directoryExists = () => true;
  host.readFile = file => sources.get(resolve(file));
  host.getSourceFile = (file, version) => { const text = sources.get(resolve(file)); return text === undefined ? undefined : ts.createSourceFile(file, text, version, true); };
  const program = ts.createProgram([resolve(root, 'Page.tsx')], options, host);
  return analyzeProgram(program, resolve(root, 'Page.tsx'), root);
}
const page = `import {useState} from 'react';
import {List} from './List';
const initialProducts=[{name:'a'}];
const Input=()=> <input/>;
export function Page(){
 const [keyword,setKeyword]=useState('');
 const products=initialProducts;
 const filtered=products.filter(p=>p.name.includes(keyword));
 return <main><Input value={keyword} onChange={setKeyword}/><List products={filtered}/></main>;
}`;
const label = (graph: ProjectGraph, id: string) => graph.nodes.find(n => n.id === id)!.label;
describe('M3 static data evidence', () => {
  it('builds the exact supported path and distinct callback/update semantics', () => {
    const graph = analyze(page, { 'List.tsx': 'export function List({products}) { return <section/> }' });
    const keyword = graph.nodes.find(n => n.kind === 'state' && n.label === 'keyword')!;
    expect(keyword).toBeDefined();
    const trace = traceData(graph, keyword.id);
    expect([...trace.edges].map(id => graph.edges.find(e => e.id === id)!).map(e => [e.kind, label(graph, e.source.nodeId), label(graph, e.target.nodeId)])).toEqual([
      ['data-read', 'keyword', 'filter()'], ['prop-pass', 'keyword', 'Input'],
      ['derive', 'filter()', 'filtered'], ['prop-pass', 'filtered', 'List'], ['data-read', 'List', 'products']
    ]);
    expect(graph.edges.filter(e => e.kind === 'callback-bind')).toHaveLength(1);
    expect(graph.edges.filter(e => e.kind === 'state-write')).toHaveLength(1);
    expect(graph.edges.every(e => e.confidence === 'confirmed' && e.sourceRefs.length > 0)).toBe(true);
    expect([...trace.nodes].some(id => label(graph, id) === 'setKeyword')).toBe(false);
  });
  it('uses symbols for same-named values and callback parameter shadowing', () => {
    const graph = analyze(`import {useState} from 'react'; const Child=()=>{const [keyword,setKeyword]=useState('child'); return <span/>}; export function Page(){const [keyword,setKeyword]=useState(''); const list=[1]; const filtered=list.filter(keyword=>keyword>0); return <Child/>}`);
    const states = graph.nodes.filter(n => n.kind === 'state'); expect(states).toHaveLength(2);
    for (const state of states) expect(traceData(graph, state.id).edges.size).toBe(0);
    expect(new Set(states.map(n => n.id)).size).toBe(2);
  });
  it('rejects local fake useState and supports imported aliases and namespace imports', () => {
    const fake = analyze(`const useState=x=>[x,x]; export function Page(){const [keyword,setKeyword]=useState(''); return <main/>}`);
    expect(fake.nodes.some(n => n.kind === 'state')).toBe(false);
    for (const [importText, call] of [["import {useState as hook} from 'react';", 'hook'], ["import * as React from 'react';", 'React.useState']]) {
      const graph = analyze(`${importText} export function Page(){const [x,setX]=${call}(0); return <main/>}`);
      expect(graph.edges.filter(e => e.kind === 'state-write')).toHaveLength(1);
    }
    const missing = analyze(`import {useState} from 'react'; export function Page(){const [x,setX]=useState(0);return <main/>}`, { 'node_modules/react/index.d.ts': '' });
    expect(missing.edges.some(e => e.kind === 'state-write')).toBe(false);
  });
  it('does not invent state writes for ordinary handlers or aliases', () => {
    const graph = analyze(`import {useState} from 'react'; const Child=()=> <div/>; export function Page(){ const [x,setX]=useState(0); const someHandler=()=>setX(1); const alias=setX; return <><Child onChange={someHandler}/><Child onChange={alias}/></> }`);
    expect(graph.edges.filter(e => e.kind === 'state-write')).toHaveLength(1);
    const handler = graph.nodes.find(n => n.label === 'someHandler')!;
    expect(handler.ports.some(p => p.kind === 'state-setter')).toBe(false);
    expect(graph.edges.some(e => e.kind === 'state-write' && e.source.nodeId === handler.id)).toBe(false);
    expect(graph.edges.filter(e => e.kind === 'callback-bind')).toHaveLength(1);
    expect(graph.diagnostics.some(d => d.message.includes('回调别名'))).toBe(true);
  });
  it('does not generate confirmed paths for dynamic access or spread overrides', () => {
    const graph = analyze(`import {useState} from 'react'; const Child=()=> <div/>; export function Page(){const [key,setKey]=useState(''); const store={}; const result=store[key]; return <><Child value={result}/><Child value={key} {...other}/></> }`);
    expect(graph.edges.filter(e => ['data-read','derive','prop-pass'].includes(e.kind))).toEqual([]);
    expect(graph.diagnostics.some(d => d.code === 'DATA_UNRESOLVED')).toBe(true);
  });
  it('continues only through the matching component prop, not unrelated inputs', () => {
    const graph = analyze(`import {useState} from 'react'; import {Child} from './Child'; const initial=[1]; export function Page(){const [keyword,setKeyword]=useState('');const products=initial;return <Child a={keyword} b={products}/>}`, { 'Child.tsx': 'const Leaf=()=> <div/>; export function Child({a,b}){return <><Leaf value={a}/><Leaf value={b}/></>}' });
    const state = graph.nodes.find(n => n.kind === 'state')!; const trace = traceData(graph, state.id);
    const leaves = graph.nodes.filter(n => n.kind === 'component-use' && n.label === 'Leaf');
    expect(leaves.filter(n => trace.nodes.has(n.id))).toHaveLength(1);
    expect([...trace.nodes].map(id => label(graph,id))).not.toContain('b');
  });
  it('does not fabricate map item aliases into repeated child props', () => {
    const graph = analyze(`import {useState} from 'react'; const Card=()=> <article/>;export function Page(){const [items,setItems]=useState([]);return <section>{items.map(item=><Card value={item}/>)}</section>}`);
    expect(graph.edges.some(e => e.kind === 'prop-pass')).toBe(false);
    expect(graph.diagnostics.some(d => d.message.includes('Props 来源'))).toBe(true);
  });
  it('does not confirm props edges into unresolved components', () => {
    const graph = analyze(`import {useState} from 'react'; export function Page(){const [x,setX]=useState(0);return <Missing value={x}/>}`);
    expect(graph.nodes.find(n => n.label === 'Missing')?.confidence).toBe('unresolved');
    expect(graph.edges.some(e => e.kind === 'prop-pass')).toBe(false);
  });
});
