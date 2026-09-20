/**
 * Fast, zero-allocation image header dimension parser.
 * Reads only the first 64KB of an image file to determine original dimensions
 * without decoding the full raster bitmap into memory.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export async function readImageHeaderDimensions(file: File): Promise<ImageDimensions | null> {
  try {
    const slice = file.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    const length = buffer.byteLength;

    if (length < 10) return null;

    // 1. PNG: 8-byte signature, IHDR chunk
    if (
      view.getUint32(0) === 0x89504e47 &&
      view.getUint32(4) === 0x0d0a1a0a &&
      length >= 24
    ) {
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      if (width > 0 && height > 0) return { width, height };
    }

    // 2. GIF: GIF87a or GIF89a
    if (
      view.getUint8(0) === 0x47 &&
      view.getUint8(1) === 0x49 &&
      view.getUint8(2) === 0x46 &&
      length >= 10
    ) {
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      if (width > 0 && height > 0) return { width, height };
    }

    // 3. BMP: BM signature
    if (
      view.getUint8(0) === 0x42 &&
      view.getUint8(1) === 0x4d &&
      length >= 26
    ) {
      const width = Math.abs(view.getInt32(18, true));
      const height = Math.abs(view.getInt32(22, true));
      if (width > 0 && height > 0) return { width, height };
    }

    // 4. JPEG: 0xFFD8 signature followed by SOF markers
    if (view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8) {
      let offset = 2;
      while (offset < length - 8) {
        if (view.getUint8(offset) !== 0xff) {
          offset++;
          continue;
        }
        const marker = view.getUint8(offset + 1);
        if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS

        const markerLength = view.getUint16(offset + 2);
        const isSof =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSof && offset + 9 <= length) {
          const height = view.getUint16(offset + 5);
          const width = view.getUint16(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        offset += 2 + markerLength;
      }
    }

    // 5. WebP: RIFF ... WEBP
    if (
      length >= 30 &&
      view.getUint32(0) === 0x52494646 && // 'RIFF'
      view.getUint32(8) === 0x57454250    // 'WEBP'
    ) {
      const chunkType = String.fromCharCode(
        view.getUint8(12),
        view.getUint8(13),
        view.getUint8(14),
        view.getUint8(15)
      );

      if (chunkType === 'VP8X' && length >= 30) {
        const width = 1 + (view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16));
        const height = 1 + (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16));
        return { width, height };
      }

      if (chunkType === 'VP8 ' && length >= 30) {
        const width = view.getUint16(26, true) & 0x3fff;
        const height = view.getUint16(28, true) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }

      if (chunkType === 'VP8L' && length >= 25 && view.getUint8(20) === 0x2f) {
        const b0 = view.getUint8(21);
        const b1 = view.getUint8(22);
        const b2 = view.getUint8(23);
        const b3 = view.getUint8(24);
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      }
    }
  } catch {
    // If reading or parsing throws, fall back gracefully
  }

  return null;
}
