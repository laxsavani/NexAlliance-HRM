const crypto = require('crypto');

// AES-256-GCM Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const TAG_LENGTH = 16; // 128-bit auth tag

// 256-bit encryption key (32 bytes)
const getEncryptionKey = () => {
  const envKey = process.env.FIELD_ENCRYPTION_KEY || 'nexalliance_secure_field_encryption_key_2026_32b';
  // Ensure key is exactly 32 bytes using SHA-256 hash
  return crypto.createHash('sha256').update(String(envKey)).digest();
};

/**
 * Encrypt plain text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string|null} - Formatted as iv:authTag:encryptedData (hex)
 */
const encrypt = (text) => {
  if (text === null || text === undefined || text === '') return null;
  const stringText = String(text);
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(stringText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt cipher text using AES-256-GCM
 * @param {string} cipherText - Formatted as iv:authTag:encryptedData (hex)
 * @returns {string|null} - Decrypted plain text
 */
const decrypt = (cipherText) => {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText || null;
  }
  
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      return cipherText;
    }
    
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
};

/**
 * Mask a bank account number (e.g. "123456789012" -> "XXXXXXXX9012")
 */
const maskBankAccount = (accountNo) => {
  if (!accountNo) return null;
  const str = String(accountNo).trim();
  if (str.length <= 4) return 'XXXX' + str;
  return 'X'.repeat(str.length - 4) + str.slice(-4);
};

/**
 * Mask a PAN number (e.g. "ABCDE1234F" -> "XXXXX1234X" or "XXXXX1234X")
 */
const maskPan = (pan) => {
  if (!pan) return null;
  const str = String(pan).trim();
  if (str.length !== 10) return 'XXXXX' + str.slice(-4);
  return 'XXXXX' + str.slice(5, 9) + 'X';
};

/**
 * Mask an Aadhaar number (e.g. "123456789012" -> "XXXXXXXX9012")
 */
const maskAadhaar = (aadhaar) => {
  if (!aadhaar) return null;
  const clean = String(aadhaar).replace(/\s+/g, '');
  if (clean.length <= 4) return 'XXXXXXXX' + clean;
  return 'X'.repeat(Math.max(0, clean.length - 4)) + clean.slice(-4);
};

// ==========================================
// TOTP (RFC 6238) Implementation in Node.js
// ==========================================

const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const generateBase32Secret = (length = 20) => {
  const bytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += base32Chars[bytes[i] % 32];
  }
  return secret;
};

const base32ToBuffer = (base32) => {
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = base32Chars.indexOf(cleanBase32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

/**
 * Generate TOTP Token for a given secret and counter
 */
const generateTotpToken = (secret, timeStep = 30, timeOffset = 0) => {
  const counter = Math.floor((Date.now() / 1000 + timeOffset) / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  
  const keyBuffer = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', keyBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
};

/**
 * Verify TOTP Token with +/- 1 time step window for clock drift
 */
const verifyTotpToken = (token, secret, timeStep = 30) => {
  if (!token || !secret) return false;
  const candidate = String(token).trim();
  
  // Check windows: current, -1, +1
  for (let offset of [0, -30, 30]) {
    const validCode = generateTotpToken(secret, timeStep, offset);
    if (candidate === validCode) {
      return true;
    }
  }
  return false;
};

module.exports = {
  encrypt,
  decrypt,
  maskBankAccount,
  maskPan,
  maskAadhaar,
  generateBase32Secret,
  generateTotpToken,
  verifyTotpToken
};
