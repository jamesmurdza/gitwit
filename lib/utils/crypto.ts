import * as crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + 12 // Salt length + IV length
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Derives a key from the encryption key using PBKDF2
 */
function deriveKey(encryptionKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256")
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @param encryptionKey - The encryption key (should be stored in environment variables)
 * @returns Object containing encrypted text and IV
 */
export function encrypt(
  plaintext: string,
  encryptionKey: string
): { encrypted: string; iv: string } {
  if (!plaintext) {
    throw new Error("Plaintext is required for encryption")
  }

  if (!encryptionKey) {
    throw new Error("Encryption key is required")
  }

  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(encryptionKey, salt)
  const iv = crypto.randomBytes(12)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([salt, iv, tag, encrypted])

  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
  }
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param encryptedData - The encrypted text in base64
 * @param encryptionKey - The encryption key used for encryption
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string, encryptionKey: string): string {
  if (!encryptedData) {
    throw new Error("Encrypted data is required for decryption")
  }

  if (!encryptionKey) {
    throw new Error("Encryption key is required")
  }

  const combined = Buffer.from(encryptedData, "base64")

  if (combined.length < ENCRYPTED_POSITION) {
    throw new Error("Invalid encrypted data")
  }

  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
  const encrypted = combined.subarray(ENCRYPTED_POSITION)

  const key = deriveKey(encryptionKey, salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString("utf8")
  } catch (error) {
    throw new Error("Failed to decrypt data. Invalid key or corrupted data.")
  }
}

/**
 * Validates if an API key format is valid (basic validation)
 * @param apiKey - The API key to validate
 * @param provider - The provider type (anthropic or openai)
 * @returns boolean indicating if the key format is valid
 */
export function validateApiKeyFormat(
  apiKey: string,
  provider: "anthropic" | "openai"
): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false
  }

  // Basic format validation for known providers
  if (provider === "anthropic") {
    // Anthropic keys typically start with "sk-ant-"
    return apiKey.startsWith("sk-ant-") && apiKey.length > 10
  }

  if (provider === "openai") {
    // OpenAI keys typically start with "sk-"
    return apiKey.startsWith("sk-") && apiKey.length > 10
  }

  return false
}
