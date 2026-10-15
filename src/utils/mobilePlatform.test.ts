import { describe, expect, it } from 'vitest';
import { getMobilePlatform, isPhotoImage } from './mobilePlatform';

describe('mobile save guidance', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 5, 'ios'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 8)', 5, 'android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 10, 'other'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0, 'other'],
  ])('classifies %s for wording only', (userAgent, maxTouchPoints, expected) => {
    expect(getMobilePlatform({ userAgent, maxTouchPoints })).toBe(expected);
  });
  it.each(['image/png', 'image/jpeg'])('offers photo-saving guidance for %s', (mime) => {
    expect(isPhotoImage(mime)).toBe(true);
  });
  it.each(['application/pdf', 'image/svg+xml', 'image/webp', ''])('does not promise Photos support for %s', (mime) => {
    expect(isPhotoImage(mime)).toBe(false);
  });
});
