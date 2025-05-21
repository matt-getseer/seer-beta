import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Encryption key and initialization vector - should be stored securely
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-at-least-32-chars';
const IV_LENGTH = 16; // For AES, this is always 16

export class EncryptionService {
  /**
   * Encrypt a string using AES-256-CBC
   * @param text Text to encrypt
   * @returns Encrypted string in format: iv:encryptedData (hex encoded)
   */
  static encrypt(text: string): string {
    // Ensure we have a 32-byte key by hashing the original key
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypt a string using AES-256-CBC
   * @param text Encrypted text in format: iv:encryptedData (hex encoded)
   * @returns Decrypted string
   */
  static decrypt(text: string): string {
    // Ensure we have a 32-byte key by hashing the original key
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    
    const textParts = text.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
} 