export type MobilePlatform = 'ios' | 'android' | 'other';

/** Best-effort wording hint only. File-sharing support is checked separately. */
export function getMobilePlatform(device: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): MobilePlatform {
  if (!device) return 'other';
  if (/Android/i.test(device.userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(device.userAgent)
    || (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1)) return 'ios';
  return 'other';
}

export function isPhotoImage(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg';
}
