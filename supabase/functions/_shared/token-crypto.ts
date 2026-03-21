// supabase/functions/_shared/token-crypto.ts
// ---------------------------------------------------------------------------
// AES-256-GCM token encryption/decryption for OAuth tokens.
// Uses Web Crypto API (available in Deno runtime).
//
// Key derivation: PBKDF2 from EMAIL_TOKEN_ENCRYPTION_KEY → 256-bit AES key
// Format: base64( IV[12] || ciphertext || authTag[16] )
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const KEY_SALT = new TextEncoder().encode("lovable-crm-email-tokens-v1");

/**
 * Derive a 256-bit AES-GCM key from a passphrase using PBKDF2.
 */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: KEY_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext token string.
 * Returns: base64( IV[12] || ciphertext || authTag )
 */
export async function encryptToken(
  plaintext: string,
  encryptionKey: string
): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Combine IV + ciphertext (which includes the auth tag in Web Crypto)
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an encrypted token string.
 * Expects: base64( IV[12] || ciphertext || authTag )
 */
export async function decryptToken(
  encrypted: string,
  encryptionKey: string
): Promise<string> {
  const key = await deriveKey(encryptionKey);

  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  if (combined.length < 13) {
    throw new Error("Invalid encrypted token: too short");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}
