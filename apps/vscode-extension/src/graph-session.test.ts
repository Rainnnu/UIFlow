import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphSession, type AnalysisResult } from './graph-session';
import { demoGraph } from '../../../packages/core/src/fixture';

const result = (): AnalysisResult => ({ graph: structuredClone(demoGraph), actions: {}, navigation: { invalidate: vi.fn(), reveal: vi.fn(async () => {}), watchedFiles: () => ['/project/Child.tsx'] } });
const deferred = () => { let resolve!: (value: AnalysisResult) => void; let reject!: (error: Error) => void; const promise = new Promise<AnalysisResult>((yes,no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
afterEach(() => vi.useRealTimers());
describe('M4 analysis session', () => {
  it('does not publish late successes or failures from superseded requests', async () => {
    const first = deferred(); const second = deferred(); const third = deferred(); const fourth = deferred();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise).mockReturnValueOnce(fourth.promise);
    const send = vi.fn(); const session = new GraphSession('/project/Page.tsx', load, send);
    const a = session.refresh('first'); const b = session.refresh('second');
    second.resolve(result()); await b; const old = result(); first.resolve(old); await a;
    expect(send.mock.calls.filter(([message]) => message.type === 'graphLoaded').map(([message]) => message.requestId)).toEqual(['second']);
    expect(old.navigation.invalidate).toHaveBeenCalled();
    const c = session.refresh('third'); const d = session.refresh('fourth'); fourth.resolve(result()); await d; third.reject(new Error('old failure')); await c;
    expect(send.mock.calls.some(([message]) => message.type === 'analysisFailed')).toBe(false); session.dispose();
  });
  it('invalidates old navigation immediately and coalesces relevant saves', async () => {
    vi.useFakeTimers(); const send = vi.fn(); const loaded = result(); const load = vi.fn(async () => loaded);
    const session = new GraphSession('/project/Page.tsx', load, send); await session.refresh(); await session.reveal('id');
    session.saved('/other/irrelevant.tsx'); expect(load).toHaveBeenCalledTimes(1);
    session.invalidate(); await expect(session.reveal('id')).rejects.toThrow('失效');
    session.saved('/project/Child.tsx'); session.saved('/project/Child.tsx');
    await vi.advanceTimersByTimeAsync(200); expect(load).toHaveBeenCalledTimes(2); session.dispose();
  });
  it('recovers from failure and drops completions after disposal', async () => {
    const send = vi.fn(); const pending = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce(result()).mockReturnValueOnce(pending.promise);
    const session = new GraphSession('/project/Page.tsx', load, send);
    await session.refresh(); expect(send.mock.calls.some(([m]) => m.type === 'analysisFailed')).toBe(true);
    await session.refresh(); await session.reveal('id');
    const last = session.refresh(); session.dispose(); const count = send.mock.calls.length; pending.resolve(result()); await last;
    expect(send.mock.calls).toHaveLength(count);
  });
});
