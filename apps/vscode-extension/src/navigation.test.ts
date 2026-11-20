import { beforeEach, describe, expect, it } from 'vitest';
import { docs, editor, Uri, window, workspace } from '../../../tests/vscode-mock';
import { NavigationService } from './navigation';
import { findSource, mappings } from './source-map';
import { parseViewRequest } from '../../../packages/core/src/messages';
import { analyzeFile } from '../../../packages/analyzer/src/index';
import { resolve } from 'node:path';
const service = () => new NavigationService(Uri.file('tests/fixtures/m1') as never);
beforeEach(() => { docs.clear(); window.showTextDocument.mockClear(); editor.revealRange.mockClear(); workspace.getWorkspaceFolder.mockReturnValue({ uri: Uri.file('.') }); });
describe('M1 navigation boundary', () => {
  it('maps definition, usage, declaration and binding to real demo text', async () => {
    const navigation = service(); const { graph, actions } = await navigation.load();
    expect(graph.definitions).toHaveLength(4);
    expect(actions.list.map(a => a.label)).toEqual(['跳转组件定义', '跳转 JSX 使用位置']);
    for (const [key, expected] of [['list', 'export function ProductList'], ['keyword', "const [keyword, setKeyword] = useState('');"], ['filtered-list', 'products={filtered}']]) {
      await navigation.reveal(actions[key][0].id);
      const selected = editor.selection as { start: { line: number; character: number }; end: { line: number; character: number } };
      const lastUri = [...docs.values()].find(d => d.uri.toString() === (key === 'list' ? graph.definitions.find(d => d.name === 'ProductList')!.source.uri : graph.nodes.find(n => n.id === 'keyword')!.sourceRefs[0].uri))!;
      expect(lastUri.lineAt(selected.start.line).text.slice(selected.start.character, selected.end.character)).toBe(expected);
    }
    expect(editor.revealRange).toHaveBeenCalledTimes(3);
    expect(graph.edges.every(edge => edge.confidence === 'partial')).toBe(true);
  });
  it('rejects unknown IDs and IDs from a previous snapshot', async () => {
    const navigation = service(); const first = await navigation.load();
    await expect(navigation.reveal('file:///C:/secret')).rejects.toThrow('引用已失效');
    await navigation.load(); await expect(navigation.reveal(first.actions.list[0].id)).rejects.toThrow('引用已失效');
    expect(window.showTextDocument).not.toHaveBeenCalled();
  });
  it('cancels a navigation invalidated while the editor is opening', async () => {
    const navigation = service(); const { actions } = await navigation.load();
    const selection = editor.selection;
    window.showTextDocument.mockImplementationOnce(async () => { navigation.invalidate(); return editor; });
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('旧定位已取消');
    expect(editor.selection).toBe(selection); expect(editor.revealRange).not.toHaveBeenCalled();
  });
  it('rejects content or version changes before opening the editor', async () => {
    const navigation = service(); const { actions } = await navigation.load();
    const page = [...docs.values()].find(d => d.uri.fsPath.endsWith('ProductPage.tsx'))!;
    page.version++;
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('源码已变化');
    page.version--; page.text = '//changed\n' + page.text;
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('源码已变化');
    expect(window.showTextDocument).not.toHaveBeenCalled();
  });
  it('checks current workspace membership at navigation time', async () => {
    const navigation = service(); const { actions } = await navigation.load();
    workspace.getWorkspaceFolder.mockReturnValue({ uri: Uri.file('packages') });
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('超出');
    expect(window.showTextDocument).not.toHaveBeenCalled();
  });
  it('rejects saved changes and missing files even when cached document text is unchanged', async () => {
    const navigation = service(); const { actions } = await navigation.load();
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('// externally changed'));
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('源码已变化');
    workspace.fs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(navigation.reveal(actions.keyword[0].id)).rejects.toThrow('ENOENT');
    expect(window.showTextDocument).not.toHaveBeenCalled();
  });
  it('fails on missing or ambiguous anchors instead of guessing offsets', () => {
    expect(() => findSource('unrelated', 'file:///demo', mappings[0])).toThrow('无法唯一定位');
    expect(() => findSource(`${mappings[0].anchor}\n${mappings[0].anchor}`, 'file:///demo', mappings[0])).toThrow('无法唯一定位');
    expect(findSource(`a\r\n${mappings[0].anchor}`, 'file:///demo', mappings[0]).start).toEqual({ line: 1, character: 0 });
  });
  it('accepts only bounded messages without arbitrary URI fields', () => {
    expect(parseViewRequest({ type: 'revealSource', requestId: 'a', sourceRefId: 'id' })?.type).toBe('revealSource');
    for (const value of [null, [], { type: 'requestGraph', requestId: '' }, { type: 'revealSource', requestId: 'a', sourceRefId: 'id', uri: 'file:///secret' }, { type: 'revealSource', requestId: 'a' }, { type: 'requestGraph', requestId: 'a'.repeat(101) }]) expect(parseViewRequest(value)).toBeUndefined();
  });
  // This test creates a real TypeScript Program and reads its file snapshots.
  it('registers AST sources and invalidates navigation when another dependency changes', async () => {
    const { graph, captured } = analyzeFile(resolve('tests/fixtures/m1/ProductPage.tsx'), resolve('.'));
    const navigation = new NavigationService(Uri.file('.') as never);
    const { actions } = await navigation.registerGraph(graph, captured);
    const list = graph.nodes.find(n => n.label === 'ProductList')!;
    expect(actions[list.id].map(a => a.label).sort()).toEqual(['跳转 JSX 使用位置', '跳转组件定义'].sort());
    await navigation.reveal(actions[list.id].find(a => a.label === '跳转组件定义')!.id);
    const page = [...docs.values()].find(d => d.uri.fsPath.endsWith('ProductPage.tsx'))!;
    page.text = '//changed dependency\n' + page.text;
    await expect(navigation.reveal(actions[list.id].find(a => a.label === '跳转组件定义')!.id)).rejects.toThrow('源码已变化');
  }, 15000);
});
