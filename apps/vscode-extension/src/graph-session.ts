import type { ProjectGraph } from '../../../packages/core/src/index';
import type { SourceActions } from '../../../packages/core/src/messages';

export interface SessionNavigation { invalidate(): void; reveal(id: string): Promise<void>; watchedFiles(): string[] }
export interface AnalysisResult { graph: ProjectGraph; actions: SourceActions; navigation: SessionNavigation }
export interface SessionMessage { type: string; revision: number; requestId?: string; graph?: ProjectGraph; actions?: SourceActions; message?: string; mode?: string }
export const pathKey = (path: string) => process.platform === 'win32' ? path.replaceAll('\\', '/').toLowerCase() : path;

// One session owns one target. Every invalidation revokes navigation and all older async work.
export class GraphSession {
  private revision = 0;
  private disposed = false;
  private navigation?: SessionNavigation;
  private files = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private target: string, private loader: () => Promise<AnalysisResult>, private send: (message: SessionMessage) => unknown, private mode = 'structure') {
    this.files.add(pathKey(target));
  }
  watches(file: string) { return this.files.has(pathKey(file)); }
  invalidate(message = '源码已变化，请保存或刷新画布。') {
    this.revision++; this.navigation?.invalidate(); this.navigation = undefined;
    if (!this.disposed) this.send({ type: 'graphInvalidated', revision: this.revision, message });
  }
  async refresh(requestId = 'auto') {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.invalidate();
    const current = this.revision;
    this.send({ type: 'graphLoading', revision: current, requestId });
    try {
      const result = await this.loader();
      if (this.disposed || current !== this.revision) { result.navigation.invalidate(); return; }
      this.navigation = result.navigation;
      this.files = new Set([this.target, ...result.navigation.watchedFiles()].map(pathKey));
      this.send({ type: 'graphLoaded', revision: current, requestId, graph: result.graph, actions: result.actions, mode: this.mode });
    } catch (error) {
      if (!this.disposed && current === this.revision) this.send({ type: 'analysisFailed', revision: current, requestId, message: error instanceof Error ? error.message : '分析失败，请刷新重试。' });
    }
  }
  saved(file: string) {
    if (this.disposed || !this.watches(file)) return;
    this.invalidate('正在刷新…');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.refresh(); }, 180);
  }
  async reveal(id: string) {
    const current = this.revision; const navigation = this.navigation;
    if (!navigation) throw new Error('图已失效或尚未加载，请保存或刷新后重试。');
    await navigation.reveal(id);
    if (this.disposed || current !== this.revision) throw new Error('源码已变化，旧定位已取消。');
  }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.invalidate(); }
}
