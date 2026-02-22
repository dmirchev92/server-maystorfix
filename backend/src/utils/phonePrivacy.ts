// Phone Privacy Utilities
// Masking for logs, AES-256-CBC encryption for database storage

import crypto from 'crypto';
import config from './config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment or derive from JWT_SECRET
 * Must be exactly 32 bytes for AES-256
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.PHONE_ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.slice(0, 32), 'utf8');
  }
  // Derive a stable 32-byte key from JWT_SECRET
  const secret = process.env.JWT_SECRET || 'default-fallback-key-change-me';
  return crypto.createHash('sha256').update(secret).digest();
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Mask a phone number for logging — keep first 3 + last 4 digits
 * Example: +359888123456 → +35*******3456
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '***';
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length <= 7) return '***';
  const first3 = cleaned.slice(0, 3);
  const last4 = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 7);
  return `${first3}${masked}${last4}`;
}

/**
 * Encrypt a phone number for database storage (AES-256-CBC)
 * Returns: iv:encrypted (hex encoded)
 */
export function encryptPhone(phone: string): string {
  if (!phone) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(phone, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a phone number from database (AES-256-CBC)
 * Input: iv:encrypted (hex encoded)
 * Returns the original phone number
 */
export function decryptPhone(encrypted: string): string {
  if (!encrypted) return '';
  // If it doesn't contain ':', it's likely a plaintext number (not yet encrypted)
  if (!encrypted.includes(':')) return encrypted;
  try {
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, return original (might be plaintext from before migration)
    return encrypted;
  }
}

/**
 * Check if a value looks like an encrypted phone (iv:hex format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || !value.includes(':')) return false;
  const parts = value.split(':');
  if (parts.length !== 2) return false;
  // IV should be 32 hex chars (16 bytes)
  return parts[0].length === 32 && /^[0-9a-f]+$/.test(parts[0]);
}
