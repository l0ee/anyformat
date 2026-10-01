/** A synthetic RGBA fixture; it does not exercise a browser file decoder. */
export function quadrantImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const colors = [
    [255, 0, 0],
    [0, 0, 255],
    [0, 0, 0],
    [255, 255, 255],
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = colors[(y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1)];
      const offset = (y * width + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}
