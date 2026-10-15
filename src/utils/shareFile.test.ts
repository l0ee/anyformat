import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, isSharing, shareFile } from './shareFile';

const file = new File(['converted bytes'], 'report_p2.pdf', { type: 'application/pdf' });
afterEach(() => vi.unstubAllGlobals());

describe('native file sharing', () => {
  it('checks both APIs and catches capability errors', () => {
    vi.stubGlobal('navigator', {});
    expect(canShareFile(file)).toBe(false);
    vi.stubGlobal('navigator', { canShare: () => true });
    expect(canShareFile(file)).toBe(false);
    vi.stubGlobal('navigator', { share: vi.fn() });
    expect(canShareFile(file)).toBe(false);
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => { throw new Error('blocked'); } });
    expect(canShareFile(file)).toBe(false);
  });

  it('checks the exact file and invokes sharing synchronously with only files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { canShare, share });
    const pending = shareFile(file);
    expect(share).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    expect(canShare).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    const payload = share.mock.calls[0][0].files[0] as File;
    expect(payload.name).toBe('report_p2.pdf');
    expect(payload.type).toBe('application/pdf');
    expect(await payload.text()).toBe('converted bytes');
    expect(await pending).toEqual({ status: 'handed-off' });
    expect(isSharing()).toBe(false);
  });

  it('does not invoke share for unsupported files', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { share, canShare: () => false });
    expect(await shareFile(file)).toEqual({ status: 'unsupported' });
    expect(share).not.toHaveBeenCalled();
  });

  it('prevents overlapping requests for different files across the application', async () => {
    let release!: () => void;
    const share = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const first = shareFile(file);
    expect(isSharing()).toBe(true);
    expect(await shareFile(new File(['png'], 'other.png', { type: 'image/png' }))).toEqual({ status: 'busy' });
    expect(share).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(isSharing()).toBe(false);
  });

  it.each(['AbortError', 'NotAllowedError', 'DataError', 'InvalidStateError'])('releases the lock after %s', async (name) => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new DOMException('error', name)) });
    const outcome = await shareFile(file);
    expect(outcome.status).toBe(name === 'AbortError' ? 'dismissed' : 'failed');
    expect(isSharing()).toBe(false);
  });

  it('also releases the lock after a synchronous exception', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => { throw new Error('failed'); } });
    expect((await shareFile(file)).status).toBe('failed');
    expect(isSharing()).toBe(false);
  });
});
