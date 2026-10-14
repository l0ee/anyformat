const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
]);

export function getClipboardImages(
  event: ClipboardEvent,
  extensionByMimeType: Readonly<Record<string, string>>,
  fileNamePrefix = 'pasted-image'
): File[] {
  if (!event.clipboardData || isEditableContext(event.target)) return [];

  const clipboardData = event.clipboardData;
  const candidates = Array.from(clipboardData.items)
    .filter(item => item.kind === 'file')
    .flatMap(item => {
      const file = item.getAsFile();
      return file ? [{ file, mimeType: normalizeMimeType(item.type) || normalizeMimeType(file.type) }] : [];
    });

  const availableFiles = candidates.length > 0
    ? candidates
    : Array.from(clipboardData.files).map(file => ({
        file,
        mimeType: normalizeMimeType(file.type)
      }));

  const supportedFiles = availableFiles.filter(({ file, mimeType }) =>
    file.size > 0 && Boolean(extensionByMimeType[mimeType])
  );

  let unnamedFileIndex = 0;
  return supportedFiles.map(({ file, mimeType }) => {
    const extension = extensionByMimeType[mimeType];
    const originalName = file.name.trim();
    const extensionSeparator = originalName.lastIndexOf('.');
    const originalExtension = extensionSeparator > 0
      ? originalName.slice(extensionSeparator + 1).toLowerCase()
      : '';
    if (originalExtension === extension || (extension === 'jpg' && originalExtension === 'jpeg')) return file;

    let baseName = originalName
      ? extensionSeparator > 0
        ? originalName.slice(0, extensionSeparator)
        : originalName.startsWith('.')
          ? ''
          : originalName
      : '';
    if (!baseName) {
      unnamedFileIndex += 1;
      const suffix = unnamedFileIndex === 1 ? '' : `-${unnamedFileIndex}`;
      baseName = `${fileNamePrefix}${suffix}`;
    }

    return new File([file], `${baseName}.${extension}`, {
      type: mimeType,
      lastModified: file.lastModified
    });
  });
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

function isEditableContext(target: EventTarget | null): boolean {
  return isEditableElement(target) || isEditableElement(document.activeElement);
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const element = target as HTMLElement;
  if (element.isContentEditable || element.closest('[role="textbox"]')) return true;
  if (element.closest('textarea, select')) return true;

  const input = element.closest('input');
  if (!input) return false;
  return !NON_TEXT_INPUT_TYPES.has((input as HTMLInputElement).type.toLowerCase());
}
