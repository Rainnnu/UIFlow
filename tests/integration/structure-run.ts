import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { loadStructure } from '../../apps/vscode-extension/src/structure';

export async function run() {
  const root = vscode.workspace.workspaceFolders![0].uri;
  const output = vscode.Uri.joinPath(root, '.test-output', 'm2-integration.json').fsPath;
  const target = vscode.Uri.joinPath(root, 'tests', 'fixtures', 'm1', 'ProductPage.tsx');
  const before = await readFile(target.fsPath);
  try {
    const { graph, actions, navigation } = await loadStructure(target);
    const list = graph.nodes.find(n => n.label === 'ProductList')!;
    assert.ok(list?.definitionId); assert.equal(list.confidence, 'confirmed');
    assert.ok(graph.nodes.some(n => n.label.includes('ProductCard ×N')));
    const selected: string[] = [];
    for (const action of actions[list.id]) {
      await navigation.reveal(action.id);
      const editor = vscode.window.activeTextEditor!;
      const text = editor.document.getText(editor.selection);
      assert.ok(text.includes('ProductList')); assert.equal(editor.document.isDirty, false);
      selected.push(action.label);
    }
    assert.deepEqual(selected.sort(), ['跳转 JSX 使用位置', '跳转组件定义'].sort());
    await navigation.reveal(actions[`${list.id}::products`][0].id);
    const editor = vscode.window.activeTextEditor!;
    assert.equal(editor.document.getText(editor.selection), 'products={filtered}');
    assert.deepEqual(await readFile(target.fsPath), before);
    await vscode.commands.executeCommand('uiflow.openGraph', target);
    await writeFile(output, JSON.stringify({ passed: true, nodeCount: graph.nodes.length, definitions: graph.definitions.map(d => d.name), selections: selected, portSelection: 'products={filtered}', sourceUnchanged: true }, null, 2));
  } catch (error) { await writeFile(output, JSON.stringify({ passed: false, error: String(error) })); throw error; }
}
