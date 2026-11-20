import * as vscode from 'vscode';
import type { GraphSession } from './graph-session';

export function watchSession(session: GraphSession): vscode.Disposable {
  const files = vscode.workspace.createFileSystemWatcher('**/*.{tsx,ts,json}');
  const listeners = [
    files,
    files.onDidChange(uri => session.saved(uri.fsPath)),
    files.onDidCreate(uri => session.saved(uri.fsPath)),
    files.onDidDelete(uri => session.saved(uri.fsPath)),
    vscode.workspace.onDidChangeTextDocument(event => { if (event.contentChanges.length && session.watches(event.document.uri.fsPath)) session.invalidate(); }),
    vscode.workspace.onDidSaveTextDocument(document => session.saved(document.uri.fsPath)),
    vscode.workspace.onDidDeleteFiles(event => { for (const uri of event.files) session.saved(uri.fsPath); }),
    vscode.workspace.onDidRenameFiles(event => { for (const file of event.files) session.saved(file.oldUri.fsPath); })
  ];
  return new vscode.Disposable(() => listeners.forEach(listener => listener.dispose()));
}
