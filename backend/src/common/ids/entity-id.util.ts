import { randomBytes } from 'crypto';

const DEFAULT_RANDOM_LENGTH = 8;

const formatDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
};

const createRandomBase36 = (length = DEFAULT_RANDOM_LENGTH): string => {
  let value = '';

  while (value.length < length) {
    value += BigInt(`0x${randomBytes(6).toString('hex')}`).toString(36);
  }

  return value.slice(0, length);
};

const normalizeIdPrefix = (prefix: string): string =>
  prefix
    .trim()
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'entity';

export const createEntityId = (prefix: string): string => {
  const normalizedPrefix = normalizeIdPrefix(prefix);
  return `_${normalizedPrefix}_${formatDateKey()}_${createRandomBase36()}`;
};

export const createOpaqueCode = (prefix = '_code'): string =>
  createEntityId(prefix);

export const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
