import { storageBuckets, supabase } from './supabase';

export type ClientDocumentKind = 'image' | 'pdf' | 'file';

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const storageUrlPrefixes = [
  '/storage/v1/object/public/',
  '/storage/v1/object/sign/',
  '/storage/v1/object/authenticated/',
];

function decodePathPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeStoragePath(value: string) {
  const path = value
    .split('/')
    .map(decodePathPart)
    .filter(Boolean);

  if (!path.length || path.some((part) => part === '.' || part === '..' || /[\u0000-\u001f]/.test(part))) {
    return null;
  }

  return path.join('/');
}

function storagePathFromUrlPath(pathname: string) {
  const prefix = storageUrlPrefixes.find((candidate) => pathname.includes(candidate));
  if (!prefix) return null;

  const storageValue = pathname.slice(pathname.indexOf(prefix) + prefix.length);
  const [bucket, ...pathParts] = storageValue.split('/');
  if (decodePathPart(bucket) !== storageBuckets.clientDocuments) return null;
  return normalizeStoragePath(pathParts.join('/'));
}

export function getClientDocumentStoragePath(value?: string | null) {
  const source = value?.trim();
  if (!source || source.startsWith('blob:') || source.startsWith('data:')) return null;

  const relativeStoragePath = storagePathFromUrlPath(source.split(/[?#]/)[0]);
  if (relativeStoragePath) return relativeStoragePath;

  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return storagePathFromUrlPath(url.pathname);
  } catch {
    const withoutBucket = source.startsWith(`${storageBuckets.clientDocuments}/`)
      ? source.slice(storageBuckets.clientDocuments.length + 1)
      : source.replace(/^\/+/, '');
    return normalizeStoragePath(withoutBucket);
  }
}

export function getClientDocumentKind(value?: string | null, mimeType?: string): ClientDocumentKind {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';

  const source = value?.split(/[?#]/)[0] || '';
  const extension = source.split('.').pop()?.toLowerCase() || '';
  if (imageExtensions.has(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'file';
}

export async function resolveClientDocumentUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return null;
  if (source.startsWith('blob:') || source.startsWith('data:image/')) return source;

  const storagePath = getClientDocumentStoragePath(source);
  if (storagePath && supabase) {
    const { data, error } = await supabase.storage
      .from(storageBuckets.clientDocuments)
      .createSignedUrl(storagePath, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getClientDocumentDownload(value: string) {
  const storagePath = getClientDocumentStoragePath(value);
  if (storagePath && supabase) {
    const { data, error } = await supabase.storage
      .from(storageBuckets.clientDocuments)
      .download(storagePath);
    if (error) throw error;
    return { blob: data, filename: storagePath.split('/').pop() || 'document' };
  }

  const safeUrl = await resolveClientDocumentUrl(value);
  if (!safeUrl) throw new Error('Adresse du document invalide.');
  const response = await fetch(safeUrl);
  if (!response.ok) throw new Error('Téléchargement du document impossible.');
  const pathname = new URL(safeUrl).pathname;
  return { blob: await response.blob(), filename: decodePathPart(pathname.split('/').pop() || 'document') };
}
