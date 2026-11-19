import crypto from "crypto";
import fs from "fs";
import path from "path";

const KEY_LENGTH = 32;
const KEY_FILE = "library.key";

function getKeyPath(libraryRoot) {
  return path.join(libraryRoot, KEY_FILE);
}

export function getPortableEncryptionKey(libraryRoot) {
  if (!libraryRoot) {
    throw new Error("Portable library folder is required.");
  }

  const root = path.resolve(libraryRoot);

  fs.mkdirSync(root, {
    recursive: true,
  });

  const keyPath = getKeyPath(root);

  // Existing portable key
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath);

    if (key.length !== KEY_LENGTH) {
      throw new Error(
        "Invalid portable encryption key."
      );
    }

    return key;
  }

  // Generate new 256-bit key
  const key = crypto.randomBytes(KEY_LENGTH);

  // Restrict file permissions where supported
  fs.writeFileSync(keyPath, key, {
    mode: 0o600,
  });

  console.log(
    "✅ New portable encryption key created."
  );

  return key;
}

export function portableKeyExists(libraryRoot) {
  if (!libraryRoot) {
    return false;
  }

  return fs.existsSync(
    getKeyPath(path.resolve(libraryRoot))
  );
}

export function getPortableKeyPath(libraryRoot) {
  return getKeyPath(path.resolve(libraryRoot));
}