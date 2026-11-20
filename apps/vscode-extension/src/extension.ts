import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { parseViewRequest } from '../../../packages/core/src/messages';
import { NavigationService } from './navigation';
import { loadStructure } from './structure';
import { GraphSession } from './graph-session';
import { watchSession } from './watch-session';
import { demoGraph } from '../../../packages/core/src/fixture';

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;
  let activeSession: GraphSession | undefined;
  const open = (demo: boolean, uri?: vscode.Uri) => {
    const editor = vscode.window.activeTextEditor;
    const target = uri ?? editor?.document.uri;
    if (!demo && (!target || target.scheme !== 'file' || !target.fsPath.endsWith('.tsx'))) { void vscode.window.showErrorMessage('请打开工作区中的 TSX 文件后重试。'); return; }
    const offset = target && editor?.document.uri.toString() === target.toString() ? editor.document.offsetAt(editor.selection.active) : undefined;
    panel?.dispose();
    const assets = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
    panel = vscode.window.createWebviewPanel('uiflow.graph', demo ? 'UIFlow · 演示' : 'UIFlow · 组件结构', vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [assets], retainContextWhenHidden: true });
    const view = panel.webview; const nonce = randomBytes(24).toString('hex');
    const js = view.asWebviewUri(vscode.Uri.joinPath(assets, 'main.js'));
    const css = view.asWebviewUri(vscode.Uri.joinPath(assets, 'assets', 'index.css'));
    panel.webview.html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${view.cspSource} 'unsafe-inline'; img-src ${view.cspSource} data:; font-src ${view.cspSource};"><link rel="stylesheet" href="${css}"></head><body><div id="root"></div><script nonce="${nonce}" type="module" src="${js}"></script></body></html>`;
    let rootName: string | undefined;
    const session = new GraphSession(target?.fsPath ?? context.extensionUri.fsPath, async () => {
      if (!demo) {
        const result = await loadStructure(target!, offset, rootName);
        const root = result.graph.nodes.find(node => result.graph.rootNodeIds.includes(node.id));
        if (root && rootName === undefined) rootName = root.label;
        return result;
      }
      let demoRoot = vscode.Uri.joinPath(context.extensionUri, 'samples', 'demo-react');
      try { await vscode.workspace.fs.stat(demoRoot); }
      catch { demoRoot = vscode.Uri.joinPath(context.extensionUri, '..', 'demo-react', 'src'); }
      const navigation = new NavigationService(demoRoot);
      if (!vscode.workspace.getWorkspaceFolder(demoRoot)) {
        const graph = structuredClone(demoGraph);
        graph.diagnostics.push({ code: 'DEMO_OUTSIDE_WORKSPACE', message: '示例源码不在当前工作区，源码定位不可用。' });
        return { graph, actions: {}, navigation };
      }
      return { ...await navigation.load(), navigation };
    }, message => view.postMessage(message), demo ? 'demo' : 'structure');
    activeSession = session;
    const watcher = watchSession(session);
    const receiver = view.onDidReceiveMessage(async (message: unknown) => {
      const request = parseViewRequest(message); if (!request) return;
      if (request.type === 'requestGraph') { await session.refresh(request.requestId); return; }
      try {
        await session.reveal(request.sourceRefId);
        await view.postMessage({ type: 'sourceRevealed', requestId: request.requestId });
      } catch (error) {
        await view.postMessage({ type: 'navigationFailed', requestId: request.requestId, message: error instanceof Error ? error.message : '定位失败，请刷新重试。' });
      }
    });
    panel.onDidDispose(() => { receiver.dispose(); watcher.dispose(); session.dispose(); if (activeSession === session) activeSession = undefined; panel = undefined; });
    context.subscriptions.push(panel);
  };
  context.subscriptions.push(vscode.commands.registerCommand('uiflow.openGraph', (uri?: vscode.Uri) => open(false, uri)));
  context.subscriptions.push(vscode.commands.registerCommand('uiflow.openDemo', () => open(true)));
  context.subscriptions.push(vscode.commands.registerCommand('uiflow.refreshGraph', () => activeSession?.refresh('manual-command')));
}
