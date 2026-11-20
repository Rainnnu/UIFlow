import * as vscode from 'vscode';
import { analyzeFile } from '../../../packages/analyzer/src/index';
import { NavigationService } from './navigation';

export async function loadStructure(target: vscode.Uri, offset?: number, rootName?: string) {
  const folder = vscode.workspace.getWorkspaceFolder(target);
  if (!folder || target.scheme !== 'file' || !target.fsPath.endsWith('.tsx')) throw new Error('请打开工作区中的 TSX 文件后重试。');
  const overlays = new Map(vscode.workspace.textDocuments.filter(doc => doc.uri.scheme === 'file').map(doc => [doc.uri.fsPath, doc.getText()]));
  const { graph, captured } = analyzeFile(target.fsPath, folder.uri.fsPath, overlays, offset, rootName);
  const navigation = new NavigationService(folder.uri);
  const result = await navigation.registerGraph(graph, captured);
  return { ...result, navigation };
}
