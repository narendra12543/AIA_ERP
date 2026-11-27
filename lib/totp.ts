import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  const cleaned = (str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(email: string, issuer: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

export function computeTotpAtStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  counter.writeUInt32BE(step >>> 0, 4);

  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binCode % 1_000_000).padStart(6, "0");
}

/**
 * Verifies a 6-digit TOTP code with +/- 1 step (30s) clock skew and replay prevention.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  lastUsedStep?: number | null
): { valid: boolean; matchedStep?: number } {
  const cleanCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return { valid: false };

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    const step = currentStep + offset;
    if (lastUsedStep !== undefined && lastUsedStep !== null && step <= lastUsedStep) {
      continue; // Replay protection
    }
    const expected = computeTotpAtStep(secret, step);
    const a = Buffer.from(cleanCode, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { valid: true, matchedStep: step };
    }
  }
  return { valid: false };
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
  return `${salt}:${digest}`;
}

export function verifyAndConsumeRecoveryCode(
  code: string,
  storedHashes: string[]
): { valid: boolean; remainingHashes: string[] } {
  const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!normalized || !Array.isArray(storedHashes)) {
    return { valid: false, remainingHashes: storedHashes || [] };
  }
  for (let i = 0; i < storedHashes.length; i++) {
    const entry = storedHashes[i];
    if (!entry || !entry.includes(":")) continue;
    const [salt, expectedHex] = entry.split(":");
    const actualHex = crypto.createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
    if (
      actualHex.length === expectedHex.length &&
      crypto.timingSafeEqual(Buffer.from(actualHex, "hex"), Buffer.from(expectedHex, "hex"))
    ) {
      const remainingHashes = storedHashes.filter((_, idx) => idx !== i);
      return { valid: true, remainingHashes };
    }
  }
  return { valid: false, remainingHashes: storedHashes };
}
