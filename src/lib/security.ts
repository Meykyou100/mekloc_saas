const SCRIPT_TAG_REGEX = /<\s*\/?\s*script\b[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\son[a-z]+\s*=\s*(['"]).*?\1/gi;
const JS_URL_REGEX = /javascript:/gi;

function truncate(value: string, maxLength: number) {
  if (maxLength <= 0) return '';
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function normalizeText(value: string, maxLength = 500) {
  const normalized = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(normalized, maxLength);
}

export function sanitizeText(value: string, maxLength = 500) {
  const noScript = String(value ?? '')
    .replace(SCRIPT_TAG_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JS_URL_REGEX, '')
    .replace(/<[^>]+>/g, '');
  return normalizeText(noScript, maxLength);
}

export function validateEmail(value: string) {
  const email = normalizeText(value, 254).toLowerCase();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validatePhone(value: string) {
  const phone = normalizeText(value, 30).replace(/\s+/g, '');
  if (!phone) return false;
  return /^\+?[0-9]{6,15}$/.test(phone);
}

export function validatePositiveNumber(value: unknown, allowZero = false) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return false;
  return allowZero ? number >= 0 : number > 0;
}

export function validateDateRange(start: string, end: string) {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() > startDate.getTime();
}

type FileUploadOptions = {
  maxSizeMb: number;
  allowedMimeTypes: string[];
  allowedExtensions?: string[];
};

export function validateFileUpload(file: File, options: FileUploadOptions) {
  if (!file) return 'Fichier non autorisé';
  const { maxSizeMb, allowedMimeTypes, allowedExtensions = [] } = options;
  const mimeAllowed = Boolean(file.type && allowedMimeTypes.includes(file.type));
  const extension = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : '';
  const extensionAllowed = Boolean(extension && allowedExtensions.includes(extension));
  if (!mimeAllowed && !extensionAllowed) return 'Fichier non autorisé';
  const maxSize = maxSizeMb * 1024 * 1024;
  if (file.size > maxSize) return `Fichier trop volumineux (max ${maxSizeMb} MB)`;
  return null;
}

function sanitizePathSegment(segment: string) {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .toLowerCase();
}

export function safeStoragePath(agencyId: string, folder: string, filename: string) {
  const safeAgencyId = sanitizePathSegment(agencyId);
  const safeFolder = sanitizePathSegment(folder);
  const ext = filename.includes('.') ? filename.split('.').pop() || 'bin' : 'bin';
  const safeExt = sanitizePathSegment(ext) || 'bin';
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();
  return `${safeAgencyId}/${safeFolder}/${timestamp}-${random}.${safeExt}`;
}

export function escapeForPdf(value: string, maxLength = 1000) {
  const clean = sanitizeText(value, maxLength)
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-');
  return clean;
}
