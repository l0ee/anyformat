import { describe, expect, it } from 'vitest';
import { readImageHeaderDimensions } from './imageHeader';

describe('readImageHeaderDimensions', () => {
  it('parses PNG dimensions from header', async () => {
    const buffer = new Uint8Array(32);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(8, 13); // IHDR length
    view.setUint32(12, 0x49484452); // IHDR
    view.setUint32(16, 1920); // width
    view.setUint32(20, 1080); // height

    const file = new File([buffer], 'test.png', { type: 'image/png' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });

  it('parses GIF dimensions from header', async () => {
    const buffer = new Uint8Array(16);
    buffer[0] = 0x47; // G
    buffer[1] = 0x49; // I
    buffer[2] = 0x46; // F
    buffer[3] = 0x38; // 8
    buffer[4] = 0x39; // 9
    buffer[5] = 0x61; // a
    const view = new DataView(buffer.buffer);
    view.setUint16(6, 640, true);
    view.setUint16(8, 480, true);

    const file = new File([buffer], 'test.gif', { type: 'image/gif' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toEqual({ width: 640, height: 480 });
  });

  it('parses BMP dimensions from header', async () => {
    const buffer = new Uint8Array(32);
    buffer[0] = 0x42; // B
    buffer[1] = 0x4d; // M
    const view = new DataView(buffer.buffer);
    view.setInt32(18, 800, true);
    view.setInt32(22, 600, true);

    const file = new File([buffer], 'test.bmp', { type: 'image/bmp' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it('parses JPEG dimensions from SOF marker', async () => {
    const buffer = new Uint8Array(32);
    buffer[0] = 0xff;
    buffer[1] = 0xd8; // SOI
    buffer[2] = 0xff;
    buffer[3] = 0xc0; // SOF0
    const view = new DataView(buffer.buffer);
    view.setUint16(4, 17); // marker length
    buffer[6] = 8; // precision
    view.setUint16(7, 1200); // height
    view.setUint16(9, 1600); // width

    const file = new File([buffer], 'test.jpg', { type: 'image/jpeg' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toEqual({ width: 1600, height: 1200 });
  });

  it('parses WebP VP8X dimensions from header', async () => {
    const buffer = new Uint8Array(32);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 0x52494646); // 'RIFF'
    view.setUint32(8, 0x57454250); // 'WEBP'
    buffer[12] = 0x56; // V
    buffer[13] = 0x50; // P
    buffer[14] = 0x38; // 8
    buffer[15] = 0x58; // X

    // width - 1 = 1023 (0x03FF)
    buffer[24] = 0xff;
    buffer[25] = 0x03;
    buffer[26] = 0x00;

    // height - 1 = 767 (0x02FF)
    buffer[27] = 0xff;
    buffer[28] = 0x02;
    buffer[29] = 0x00;

    const file = new File([buffer], 'test.webp', { type: 'image/webp' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toEqual({ width: 1024, height: 768 });
  });

  it('returns null for unparseable or corrupted bytes', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4]);
    const file = new File([buffer], 'unknown.bin', { type: 'application/octet-stream' });
    const dims = await readImageHeaderDimensions(file);
    expect(dims).toBeNull();
  });
});
