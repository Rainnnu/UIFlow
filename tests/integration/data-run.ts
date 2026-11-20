import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { loadStructure } from '../../apps/vscode-extension/src/structure';
import { traceData } from '../../packages/core/src/index';

export async function run() {
  const root = vscode.workspace.workspaceFolders![0].uri;
  const output = vscode.Uri.joinPath(root, '.test-output', 'm3-integration.json').fsPath;
  const target = vscode.Uri.joinPath(root, 'tests', 'fixtures', 'm1', 'ProductPage.tsx');
  const before = await readFile(target.fsPath);
  try {
    const { graph, actions, navigation } = await loadStructure(target);
    const keyword = graph.nodes.find(n => n.kind === 'state' && n.label === 'keyword')!;
    assert.ok(keyword);
    const trace = traceData(graph, keyword.id);
    const list = graph.nodes.find(n => n.kind === 'component-use' && n.label === 'ProductList')!;
    assert.ok(trace.nodes.has(list.id));
    assert.ok(graph.edges.some(e => e.kind === 'callback-bind'));
    assert.ok(graph.edges.some(e => e.kind === 'state-write'));
    const binding = graph.edges.find(e => e.kind === 'prop-pass' && e.target.nodeId === list.id && e.target.portId === 'products')!;
    assert.ok(binding && trace.edges.has(binding.id));
    const selections: string[] = [];
    for (const id of [keyword.id, binding.id, ...graph.edges.filter(e => e.confidence === 'confirmed').map(e => e.id)]) {
      assert.ok(actions[id]?.length);
      await navigation.reveal(actions[id][0].id);
      const editor = vscode.window.activeTextEditor!;
      const text = editor.document.getText(editor.selection); assert.ok(text.length); assert.equal(editor.document.isDirty, false);
      if (id === binding.id) assert.equal(text, 'products={filtered}');
      selections.push(text);
    }
    assert.deepEqual(await readFile(target.fsPath), before);
    await vscode.commands.executeCommand('uiflow.openGraph', target);
    await writeFile(output, JSON.stringify({ passed: true, nodes: graph.nodes.length, edges: graph.edges.length, tracedEdges: trace.edges.size, everyConfirmedEdgeRevealed: true, selections, sourceUnchanged: true }, null, 2));
  } catch (error) { await writeFile(output, JSON.stringify({ passed: false, error: String(error) })); throw error; }
}
