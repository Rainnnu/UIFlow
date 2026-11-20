import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { NavigationService } from '../../apps/vscode-extension/src/navigation';
// Run inside Extension Development Host; no business-source modifications.
export async function run() {
  const root = vscode.workspace.workspaceFolders![0].uri;
  const output = vscode.Uri.joinPath(root, '.test-output', 'm1-integration.json').fsPath;
  try {
    const navigation = new NavigationService(vscode.Uri.joinPath(root, 'tests', 'fixtures', 'm1'));
    const { actions } = await navigation.load();
    const results: string[] = [];
    for (const [key, index, expected] of [
      ['list', 0, 'export function ProductList'],
      ['list', 1, '<ProductList products={filtered} />'],
      ['keyword', 0, "const [keyword, setKeyword] = useState('');"],
      ['filtered-list', 0, 'products={filtered}'],
      ['list::products', 0, 'products={filtered}']
    ] as const) {
      await navigation.reveal(actions[key][index].id);
      const editor = vscode.window.activeTextEditor!;
      assert.equal(editor.document.getText(editor.selection), expected);
      assert.equal(editor.document.isDirty, false);
      results.push(`${key}:${index}`);
    }
    await assert.rejects(navigation.reveal('unknown'));
    const stale = actions.keyword[0].id;
    await navigation.load(); await assert.rejects(navigation.reveal(stale));
    await vscode.commands.executeCommand('uiflow.openDemo');
    await writeFile(output, JSON.stringify({ passed: true, selections: results, invalidIdsRejected: true }, null, 2));
  } catch (error) {
    await writeFile(output, JSON.stringify({ passed: false, error: String(error) })); throw error;
  }
}
