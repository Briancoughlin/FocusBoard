import crypto from 'crypto';
import os from 'os';

function deriveKey() {
  const raw = os.hostname() + os.userInfo().username + 'focusboard-v1';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptConfig(data) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: true,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

export function decryptConfig(encObj) {
  const key = deriveKey();
  const iv = Buffer.from(encObj.iv, 'hex');
  const authTag = Buffer.from(encObj.authTag, 'hex');
  const encryptedData = Buffer.from(encObj.data, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
