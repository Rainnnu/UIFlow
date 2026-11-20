import * as vscode from 'vscode';
import { createHash, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { relative, isAbsolute, resolve } from 'node:path';
import { demoGraph } from '../../../packages/core/src/fixture';
import type { SourceRef, ProjectGraph } from '../../../packages/core/src/index';
import type { SourceActions } from '../../../packages/core/src/messages';
import { findSource, mappings } from './source-map';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const fileKey = (uri: vscode.Uri) => process.platform === 'win32' ? resolve(uri.fsPath).toLowerCase() : resolve(uri.fsPath);
const within = (root: string, file: string) => { const rel = relative(root, file); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
interface Entry { source: SourceRef; hash: string; version: number; document: vscode.TextDocument; diskHash: string }
const labels: Record<SourceRef['role'], string> = { definition: '跳转组件定义', usage: '跳转 JSX 使用位置', declaration: '跳转声明', expression: '跳转表达式', binding: '跳转绑定' };
export class NavigationService {
  private registry = new Map<string, Entry>();
  private dependencies: Entry[] = [];
  private epoch = 0;
  invalidate() { this.epoch++; this.registry.clear(); }
  watchedFiles() { return [...new Set([...this.dependencies.map(entry => vscode.Uri.parse(entry.source.uri).fsPath), ...[...this.registry.values()].map(entry => vscode.Uri.parse(entry.source.uri).fsPath)])]; }
  constructor(private demoRoot: vscode.Uri) {}
  private async validateFile(uri: vscode.Uri) {
    if (uri.scheme !== 'file') throw new Error('仅支持工作区中的本地 demo 文件。');
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) throw new Error('请将 UIFlow 仓库或 demo 文件夹加入当前工作区。');
    const [file, root, demo] = await Promise.all([realpath(uri.fsPath), realpath(folder.uri.fsPath), realpath(this.demoRoot.fsPath)]);
    if (!within(root, file) || !within(demo, file)) throw new Error('源码引用超出 demo 或工作区范围。');
  }
  async load() {
    this.invalidate();
    const graph = structuredClone(demoGraph); const actions: SourceActions = {};
    const documents = new Map<string, vscode.TextDocument>();
    for (const file of new Set(mappings.map(m => m.file))) {
      const uri = vscode.Uri.joinPath(this.demoRoot, file);
      await this.validateFile(uri);
      documents.set(file, await vscode.workspace.openTextDocument(uri));
    }
    for (const mapping of mappings) {
      const document = documents.get(mapping.file)!;
      const source = findSource(document.getText(), document.uri.toString(), mapping);
      const id = randomUUID();
      const diskHash = digest(Buffer.from(await vscode.workspace.fs.readFile(document.uri)).toString('utf8'));
      this.registry.set(id, { source, hash: digest(document.getText()), version: document.version, document, diskHash });
      (actions[mapping.key] ??= []).push({ id, label: labels[source.role], location: `${mapping.file}:${source.start.line + 1}:${source.start.character + 1}` });
      const node = graph.nodes.find(n => n.id === mapping.key);
      if (node) {
        node.sourceRefs.push(source);
        if (source.role === 'definition') { node.definitionId = `definition:${node.id}`; graph.definitions.push({ id: node.definitionId, name: node.label, source }); }
      }
      const edge = graph.edges.find(e => e.id === mapping.key); if (edge) edge.sourceRefs.push(source);
      const [nodeId, portId] = mapping.key.split('::');
      if (portId) graph.nodes.find(n => n.id === nodeId)?.ports.find(p => p.id === portId)?.sourceRefs.push(source);
    }
    return { graph, actions };
  }
  async registerGraph(graph: ProjectGraph, captured: Map<string, string>) {
    this.invalidate(); this.dependencies = [];
    const actions: SourceActions = {};
    const entries = new Map<string, Omit<Entry, 'source'>>();
    for (const [file, text] of captured) {
      const uri = vscode.Uri.file(file); await this.validateFile(uri);
      const document = await vscode.workspace.openTextDocument(uri);
      if (document.getText() !== text) throw new Error('源码在分析期间发生变化，请刷新。');
      const entry = { hash: digest(text), version: document.version, document, diskHash: digest(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')) };
      entries.set(fileKey(uri), entry);
      this.dependencies.push({ ...entry, source: { uri: uri.toString(), start: { line: 0, character: 0 }, end: { line: 0, character: 0 }, role: 'definition' } });
    }
    const register = (key: string, sources: SourceRef[]) => {
      for (const source of sources) {
        const entry = entries.get(fileKey(vscode.Uri.parse(source.uri))); if (!entry) continue;
        const id = randomUUID(); this.registry.set(id, { ...entry, source });
        (actions[key] ??= []).push({ id, label: labels[source.role], location: `${relative(this.demoRoot.fsPath, vscode.Uri.parse(source.uri).fsPath)}:${source.start.line + 1}:${source.start.character + 1}` });
      }
    };
    graph.nodes.forEach(node => { register(node.id, node.sourceRefs); node.ports.forEach(port => register(`${node.id}::${port.id}`, port.sourceRefs)); });
    graph.edges.forEach(edge => register(edge.id, edge.sourceRefs));
    return { graph, actions };
  }
  private async validateSnapshot(entry: Entry) {
    const uri = vscode.Uri.parse(entry.source.uri); await this.validateFile(uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const diskHash = digest(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'));
    if (diskHash !== entry.diskHash || digest(document.getText()) !== entry.hash || (document === entry.document && document.version !== entry.version)) throw new Error('源码已变化，旧定位已失效，请刷新画布。');
  }
  async reveal(id: string) {
    const epoch = this.epoch;
    const current = () => { if (epoch !== this.epoch) throw new Error('源码已变化，旧定位已取消。'); };
    const entry = this.registry.get(id);
    if (!entry) throw new Error('源码引用已失效，请重新加载演示。');
    const uri = vscode.Uri.parse(entry.source.uri);
    await this.validateFile(uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const validate = async () => {
      const diskHash = digest(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'));
      if (diskHash !== entry.diskHash || digest(document.getText()) !== entry.hash || (document === entry.document && document.version !== entry.version)) throw new Error('源码已变化，旧定位已失效，请重新加载演示。');
    };
    for (const dependency of this.dependencies) await this.validateSnapshot(dependency);
    await validate();
    current();
    const { start, end } = entry.source;
    if ([start, end].some(p => !Number.isInteger(p.line) || !Number.isInteger(p.character) || p.line < 0 || p.character < 0 || p.line >= document.lineCount || p.character > document.lineAt(p.line).text.length)) throw new Error('源码范围无效，请重新加载演示。');
    const range = new vscode.Range(start.line, start.character, end.line, end.character);
    const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false, preview: true });
    await validate();
    for (const dependency of this.dependencies) await this.validateSnapshot(dependency);
    current();
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
}
