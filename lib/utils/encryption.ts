import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Check if encryption is available (ENCRYPTION_KEY is set)
 */
export function isEncryptionAvailable(): boolean {
  return !!process.env.ENCRYPTION_KEY
}

/**
 * Get encryption key from environment variable
 * The key should be a 32-byte base64 encoded string
 */
function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set")
  }
  return Buffer.from(encryptionKey, "base64")
}

/**
 * Encrypt a string value using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string in base64 format
 */
export function encrypt(text: string): string {
  if (!text) {
    return ""
  }

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])

  const tag = cipher.getAuthTag()

  // Combine salt + iv + tag + encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted])

  return combined.toString("base64")
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * @param encryptedData - Encrypted string in base64 format
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return ""
  }

  const key = getKey()
  const combined = Buffer.from(encryptedData, "base64")

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
  const encrypted = combined.subarray(ENCRYPTED_POSITION)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

/**
 * Encrypt an object containing API keys
 * @param apiKeys - Object with API key values
 * @returns Object with encrypted values
 */
export function encryptApiKeys(
  apiKeys: Record<string, string>,
): Record<string, string> {
  const encrypted: Record<string, string> = {}

  for (const [key, value] of Object.entries(apiKeys)) {
    if (value && value.trim()) {
      encrypted[key] = encrypt(value)
    }
  }

  return encrypted
}

/**
 * Decrypt an object containing encrypted API keys
 * @param encryptedKeys - Object with encrypted values
 * @returns Object with decrypted values
 */
export function decryptApiKeys(
  encryptedKeys: Record<string, string>,
): Record<string, string> {
  const decrypted: Record<string, string> = {}

  for (const [key, value] of Object.entries(encryptedKeys)) {
    if (value && value.trim()) {
      try {
        decrypted[key] = decrypt(value)
      } catch (error) {
        console.error(`Failed to decrypt key: ${key}`, error)
        // Skip keys that fail to decrypt
      }
    }
  }

  return decrypted
}
