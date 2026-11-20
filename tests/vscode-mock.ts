import { vi } from 'vitest';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
export class Uri {
  constructor(public fsPath: string) {}
  scheme = 'file';
  static file(path: string) { return new Uri(resolve(path)); }
  static parse(uri: string) { return new Uri(fileURLToPath(uri)); }
  static joinPath(uri: Uri, ...parts: string[]) { return Uri.file(resolve(uri.fsPath, ...parts)); }
  toString() { return pathToFileURL(this.fsPath).toString(); }
}
export class Range { start: { line: number; character: number }; end: { line: number; character: number }; constructor(a: number, b: number, c: number, d: number) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; } }
export class Selection { constructor(public start: unknown, public end: unknown) {} }
export const ViewColumn = { Beside: 2 };
export const TextEditorRevealType = { InCenterIfOutsideViewport: 2 };
export const docs = new Map<string, { uri: Uri; version: number; text: string; getText(): string; lineCount: number; lineAt(line: number): { text: string } }>();
export const editor = { selection: undefined as unknown, revealRange: vi.fn() };
export const workspace = {
  getWorkspaceFolder: vi.fn(() => ({ uri: Uri.file('.') })),
  fs: { readFile: vi.fn(async (uri: Uri) => readFile(uri.fsPath)) },
  openTextDocument: vi.fn(async (uri: Uri) => {
    if (!docs.has(uri.fsPath)) {
      const text = await readFile(uri.fsPath, 'utf8');
      docs.set(uri.fsPath, { uri, version: 1, text, getText() { return this.text; }, get lineCount() { return this.text.split('\n').length; }, lineAt(line: number) { return { text: this.text.split('\n')[line] }; } });
    }
    return docs.get(uri.fsPath)!;
  })
};
export const window = { showTextDocument: vi.fn(async () => editor) };
