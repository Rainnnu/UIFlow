import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, isAbsolute } from 'node:path';

// This driver imports no product source; commands are supplied by the installed VSIX.
export async function run() {
  const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const output = join(root, '.test-output', 'installed-integration.json');
  try {
    const extension = vscode.extensions.getExtension('uiflow-local.uiflow');
    assert.ok(extension); assert.ok(extension.extensionPath.replaceAll('\\','/').includes('/isolated-extensions/'));
    await extension.activate();
    const required = ['uiflow.openGraph','uiflow.openDemo','uiflow.refreshGraph'];
    const commands = await vscode.commands.getCommands(true); required.forEach(command => assert.ok(commands.includes(command)));
    const require = createRequire(join(extension.extensionPath, 'package.json'));
    const runtime = require.resolve('typescript');
    const within = relative(extension.extensionPath, runtime); assert.ok(!isAbsolute(within) && !within.startsWith('..'));
    const ts = require('typescript'); assert.equal(ts.version, '5.8.3');
    assert.ok(ts.sys.fileExists(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2022 })));
    await access(join(extension.extensionPath, 'dist/webview/main.js'));
    await access(join(extension.extensionPath, 'dist/webview/assets/index.css'));
    await access(join(extension.extensionPath, 'samples/demo-react/ProductPage.tsx'));
    const manifest = JSON.parse(await readFile(join(extension.extensionPath, 'package.json'), 'utf8'));
    assert.equal(manifest.version, '0.0.1');
    const target = vscode.Uri.file(join(root, 'tests/fixtures/m1/ProductPage.tsx'));
    const doc = await vscode.workspace.openTextDocument(target); await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('uiflow.openGraph', target);
    await writeFile(output, JSON.stringify({ passed: true, extensionPath: extension.extensionPath, installedRuntime: runtime, typescript: ts.version, resourcesPresent: true, commands: required, source: target.fsPath, note: 'Command activation and package resource checks; canvas verified separately', at: new Date().toISOString() }, null, 2));
    if (process.env.UIFLOW_KEEP_TEST_OPEN === '1') {
      const deadline = Date.now() + 600000;
      while (Date.now() < deadline) {
        try { await access(join(root, '.test-output', 'qa-done')); break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) { await writeFile(output, JSON.stringify({ passed: false, error: String(error) })); throw error; }
}
