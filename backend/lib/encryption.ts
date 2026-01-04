import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// ============================================================================
// ENCRYPTION KEY DERIVATION
// Uses random salt per encryption operation to prevent rainbow table attacks
// ============================================================================

/**
 * Derive encryption key from the master key using PBKDF2
 * Uses random salt generated for each encryption operation
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Generate a random salt for key derivation
 */
function generateSalt(): Buffer {
  return crypto.randomBytes(32);
}

export function encrypt(plaintext: string): string {
  const masterKey = process.env.ENCRYPTION_KEY;
  
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for secure storage');
  }
  
  const salt = generateSalt();
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: salt:iv:tag:encrypted
  // Salt is included to allow decryption while still providing unique salts per operation
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const masterKey = process.env.ENCRYPTION_KEY;
  
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for secure storage');
  }
  
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const key = deriveKey(masterKey, salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  
  const prefix = key.substring(0, 4);
  const suffix = key.substring(key.length - 4);
  return `${prefix}${'*'.repeat(Math.min(key.length - 8, 20))}${suffix}`;
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}
