import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export function generateKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

export function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format:
  // [IV][AUTH TAG][ENCRYPTED DATA]
  return Buffer.concat([
    iv,
    authTag,
    encrypted,
  ]);
}

export function decryptBuffer(encryptedBuffer, key) {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);

  const authTag = encryptedBuffer.subarray(
    IV_LENGTH,
    IV_LENGTH + 16
  );

  const encrypted = encryptedBuffer.subarray(
    IV_LENGTH + 16
  );

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}