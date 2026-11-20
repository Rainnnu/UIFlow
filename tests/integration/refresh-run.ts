import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GraphSession, type SessionMessage } from '../../apps/vscode-extension/src/graph-session';
import { watchSession } from '../../apps/vscode-extension/src/watch-session';
import { loadStructure } from '../../apps/vscode-extension/src/structure';

// Only edits a fresh test-owned copy under .test-output, never the demo/business files.
export async function run() {
  const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const output = join(root, '.test-output', 'm4-integration.json');
  await mkdir(join(root, '.test-output'), { recursive: true });
  const temporary = await mkdtemp(join(root, '.test-output', 'refresh-'));
  for (const file of ['ProductPage.tsx','ProductList.tsx','ProductCard.tsx','SearchInput.tsx']) await copyFile(join(root, 'tests', 'fixtures', 'm1', file), join(temporary, file));
  const untouched = await readFile(join(root, 'tests', 'fixtures', 'm1', 'ProductPage.tsx'));
  const target = vscode.Uri.file(join(temporary, 'ProductPage.tsx'));
  const messages: SessionMessage[] = []; const waiting = new Set<() => void>(); let fail = false;
  const session = new GraphSession(target.fsPath, async () => { if (fail) throw new Error('test failure'); return loadStructure(target); }, message => { messages.push(message); waiting.forEach(notify => notify()); });
  const watcher = watchSession(session);
  const waitFor = (predicate: (message: SessionMessage) => boolean) => new Promise<SessionMessage>((resolve, reject) => {
    const check = () => { const found = [...messages].reverse().find(predicate); if (found) { clearTimeout(timer); waiting.delete(check); resolve(found); } };
    const timer = setTimeout(() => { waiting.delete(check); reject(new Error('Refresh did not finish')); }, 20000);
    waiting.add(check); check();
  });
  const replace = async (document: vscode.TextDocument, before: string, after: string) => {
    const start = document.getText().indexOf(before); assert.ok(start >= 0);
    const edit = new vscode.WorkspaceEdit(); edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(start + before.length)), after);
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  };
  try {
    await session.refresh('initial');
    const initial = await waitFor(m => m.type === 'graphLoaded');
    const keyword = initial.graph!.nodes.find(n => n.kind === 'state')!;
    const oldId = initial.actions![keyword.id][0].id;
    const document = await vscode.workspace.openTextDocument(target);
    await replace(document, 'products={filtered}', 'products={products}');
    await assert.rejects(session.reveal(oldId));
    assert.equal(await document.save(), true);
    const changed = await waitFor(m => m.type === 'graphLoaded' && m.revision > initial.revision && m.graph!.edges.some(e => e.kind === 'prop-pass' && m.graph!.nodes.find(n => n.id === e.source.nodeId)?.label === 'products' && m.graph!.nodes.find(n => n.id === e.target.nodeId)?.label === 'ProductList'));
    const filtered = changed.graph!.nodes.find(n => n.label === 'filtered' && n.kind === 'value')!;
    const deletedId = changed.actions![filtered.id][0].id;
    await replace(document, '  const filtered = products.filter(p => p.name.includes(keyword));\n', '');
    assert.equal(await document.save(), true);
    const deleted = await waitFor(m => m.type === 'graphLoaded' && m.revision > changed.revision && !m.graph!.nodes.some(n => n.label === 'filtered'));
    await assert.rejects(session.reveal(deletedId));
    await replace(document, document.getText(), '// no component\n'); await document.save();
    const empty = await waitFor(m => m.type === 'graphLoaded' && m.revision > deleted.revision && m.graph!.nodes.length === 0);
    fail = true; await session.refresh('failure');
    const failure = await waitFor(m => m.type === 'analysisFailed' && m.revision > empty.revision);
    fail = false; await session.refresh('recover');
    await waitFor(m => m.type === 'graphLoaded' && m.revision > failure.revision);
    assert.deepEqual(await readFile(join(root, 'tests', 'fixtures', 'm1', 'ProductPage.tsx')), untouched);
    await writeFile(output, JSON.stringify({ passed: true, automaticSaveRefresh: true, propBindingUpdated: true, deletedVariableRemoved: true, staleNavigationRejected: true, emptyGraph: true, failureRecovery: true, originalFixtureUnchanged: true, temporary }, null, 2));
  } catch (error) { await writeFile(output, JSON.stringify({ passed: false, error: String(error), events: messages.map(m => ({ type: m.type, revision: m.revision, message: m.message })) }, null, 2)); throw error; }
  finally { watcher.dispose(); session.dispose(); }
}
