import { detectCfbf } from '@file-type/cfbf';
import { FileTypeParser } from 'file-type';

export const MATERIAL_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'audio/mpeg',
  'video/mp4',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
] as const;

const knownMimes = new Set<string>(MATERIAL_MIME_TYPES);
const genericMime = 'application/octet-stream';
const textMime = 'text/plain';
const maxParserReadBytes = 8 * 1024 * 1024;

export function supportsUploadMime(mime: string): boolean {
  const normalized = mime.toLowerCase();
  return normalized === genericMime || knownMimes.has(normalized);
}

function isPlainText(bytes: Uint8Array, signal: AbortSignal): boolean {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunkSize = 64 * 1024;
  let prefix = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    signal.throwIfAborted();
    const end = offset + chunkSize;
    const chunk = decoder.decode(bytes.subarray(offset, end), { stream: end < bytes.length });
    if (prefix.length < 64)
      prefix += (prefix ? chunk : chunk.trimStart()).slice(0, 64 - prefix.length);
    for (let index = 0; index < chunk.length; index++) {
      const code = chunk.charCodeAt(index);
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) return false;
    }
  }
  return !/^<(?:!doctype\b|\?xml\b|html\b|svg\b|script\b)/i.test(prefix);
}

export async function matchesUploadFormat(
  bytes: Uint8Array,
  contentType: string,
  signal: AbortSignal,
): Promise<boolean> {
  const declared = contentType.toLowerCase();
  if (!supportsUploadMime(declared) || bytes.length === 0) return false;
  try {
    const detected = await new FileTypeParser({
      customDetectors: [detectCfbf],
      signal,
      maxBufferSize: maxParserReadBytes,
    }).fromBuffer(bytes);
    const observed = detected?.mime === 'image/apng' ? 'image/png' : detected?.mime;
    if (!observed)
      return (declared === textMime || declared === genericMime) && isPlainText(bytes, signal);
    return knownMimes.has(observed) && (observed === declared || declared === genericMime);
  } catch {
    signal.throwIfAborted();
    return false;
  }
}
