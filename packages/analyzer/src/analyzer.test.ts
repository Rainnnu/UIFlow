import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeProgram } from './index';
import { layoutStructure } from '../../graph-ui/src/layout';
function analyze(files: Record<string, string>, offset?: number, rootName?: string) {
  const root = resolve('.test-output/virtual');
  const sources = new Map(Object.entries(files).map(([name, text]) => [resolve(root, name), text]));
  const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noLib: true, types: [], noEmit: true };
  const host = ts.createCompilerHost(options);
  host.fileExists = file => sources.has(resolve(file));
  host.directoryExists = () => true;
  host.readFile = file => sources.get(resolve(file));
  host.getSourceFile = (file, languageVersion) => { const text = sources.get(resolve(file)); return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true); };
  const program = ts.createProgram([resolve(root, 'Page.tsx')], options, host);
  return analyzeProgram(program, resolve(root, 'Page.tsx'), root, offset, rootName);
}
describe('M2 component containment', () => {
  it('keeps the chosen root across shifted offsets and refuses renamed roots', () => {
    const text = 'export const A=()=> <main/>; export const B=()=> <section/>;';
    expect(analyze({ 'Page.tsx': text }, 15, 'B').nodes[0].label).toBe('B');
    expect(analyze({ 'Page.tsx': text }, 15, 'Removed').nodes).toEqual([]);
  });
  it('resolves import aliases; keeps uses separate and shares definitions', () => {
    const graph = analyze({ 'Page.tsx': "import { List as Alias } from './List'; export function Page(){ return <main><Alias/><Alias/></main> }", 'List.tsx': 'export const List = () => <section><span/></section>' });
    const uses = graph.nodes.filter(n => n.label === 'Alias');
    expect(uses).toHaveLength(2); expect(uses[0].id).not.toBe(uses[1].id); expect(uses[0].definitionId).toBe(uses[1].definitionId);
    expect(graph.definitions.map(d => d.name).sort()).toEqual(['List', 'Page']);
    expect(uses.every(n => n.confidence === 'confirmed' && n.sourceRefs.some(r => r.role === 'usage') && n.sourceRefs.some(r => r.role === 'definition'))).toBe(true);
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.find(n => n.id === uses[0].parentId)?.kind).toBe('jsx-region');
    const layout = layoutStructure(graph); const parent = layout[uses[0].parentId!];
    for (const use of uses) { const box = layout[use.id]; expect(box.x + box.width).toBeLessThanOrEqual(parent.width); expect(box.y + box.height).toBeLessThanOrEqual(parent.height); }
  });
  it('does not conflate equal names in different modules or local scopes', () => {
    const graph = analyze({
      'Page.tsx': "import { Card as A } from './A'; import { Card as B } from './B'; export function Page(){ const Card=()=> <article/>; return <><A/><B/><Card/></> }",
      'A.tsx': 'export function Card(){ return <main/> }', 'B.tsx': 'export function Card(){ return <section/> }'
    });
    const uses = graph.nodes.filter(n => ['A', 'B', 'Card'].includes(n.label));
    expect(new Set(uses.map(n => n.definitionId)).size).toBe(3);
  });
  it('labels map templates and conditional branches without runtime claims', () => {
    const graph = analyze({ 'Page.tsx': 'const Card=()=> <article/>; export function Page(){ return <>{items.map(x=><Card/>)}{ok && <Card/>}{ok ? <Card/> : <Card/>}</> }' }, 100);
    expect(graph.nodes.filter(n => n.label.includes('×N'))).toHaveLength(1);
    expect(graph.nodes.filter(n => n.label.includes('条件分支'))).toHaveLength(3);
  });
  it('ignores commented JSX and JSX in uncalled helper functions', () => {
    const text = 'const Card=()=> <article/>; export function Page(){ const unused=()=> <Card/>; return <main>{/* <Card/> */}<span/></main> }';
    const graph = analyze({ 'Page.tsx': text }, text.indexOf('const unused'));
    expect(graph.nodes.some(n => n.label === 'Card')).toBe(false);
    expect(graph.nodes.map(n => n.kind)).toEqual(['component-use', 'jsx-region']);
  });
  it('degrades HOCs and unknown tags and terminates recursive components', () => {
    const graph = analyze({ 'Page.tsx': 'const Wrapped=memo(()=> <div/>); export function Page(){ return <><Wrapped/><Missing/><Page/></> }' });
    expect(graph.nodes.find(n => n.label === 'Wrapped')?.confidence).toBe('unresolved');
    expect(graph.nodes.find(n => n.label === 'Missing')?.confidence).toBe('unresolved');
    expect(graph.diagnostics.some(d => d.code === 'RECURSION_PARTIAL')).toBe(true);
    expect(graph.nodes.length).toBeLessThan(10);
  });
  it('selects the component containing the cursor and reports ambiguous roots', () => {
    const text = 'export const A=()=> <main/>; export const B=()=> <section/>;';
    expect(analyze({ 'Page.tsx': text }).diagnostics[0].code).toBe('ROOT_UNRESOLVED');
    expect(analyze({ 'Page.tsx': text }, text.indexOf('B=')).nodes[0].label).toBe('B');
  });
  it('resolves direct default exports through checker symbols', () => {
    const graph = analyze({ 'Page.tsx': "import Alias from './Child'; export function Page(){ return <Alias/> }", 'Child.tsx': 'export default function Child(){ return <section/> }' });
    expect(graph.nodes.find(n => n.label === 'Alias')?.confidence).toBe('confirmed');
    expect(graph.definitions.some(d => d.name === 'Child')).toBe(true);
  });
  it('records prop binding locations but does not invent data edges', () => {
    const graph = analyze({ 'Page.tsx': 'const Card=()=> <article/>; export function Page(){ return <Card product={item}/> }' });
    const port = graph.nodes.find(n => n.label === 'Card')!.ports[0];
    expect(port.name).toBe('product'); expect(port.sourceRefs[0].role).toBe('binding'); expect(graph.edges).toEqual([]);
  });
  it('fails safely on syntax errors', () => {
    const graph = analyze({ 'Page.tsx': 'export function Page(){ return <main><Missing/></broken> }' });
    expect(graph.diagnostics.some(d => d.code === 'SYNTAX_ERROR')).toBe(true);
    expect(graph.nodes.filter(n => n.kind === 'component-use').every(n => n.confidence !== 'confirmed')).toBe(true);
  });
  it('does not confirm type-only imports or reassignable component variables', () => {
    const graph = analyze({ 'Page.tsx': "import type { Card } from './Child'; let Mutable=()=> <article/>; export function Page(){ return <><Card/><Mutable/></> }", 'Child.tsx': 'export function Card(){ return <section/> }' });
    expect(graph.nodes.filter(n => ['Card', 'Mutable'].includes(n.label)).every(n => n.confidence === 'unresolved')).toBe(true);
  });
});
