import crypto from "crypto";
import dns from "dns";
import net from "net";

function getEncryptionKey(): Buffer {
  const explicitKey = (process.env.SETTINGS_ENCRYPTION_KEY || "").trim();

  if (process.env.NODE_ENV === "production") {
    if (!explicitKey || explicitKey.length < 32) {
      throw new Error(
        "CRITICAL SECURITY ERROR: Independent 32-byte SETTINGS_ENCRYPTION_KEY is required in production."
      );
    }
    return crypto.createHash("sha256").update(`aven-erp-aes256:${explicitKey}`).digest();
  }

  const devFallback = explicitKey || "aven-erp-local-dev-encryption-key-v1";
  return crypto.createHash("sha256").update(`aven-erp-aes256:${devFallback}`).digest();
}

export function isEncryptionKeyExplicitlySet(): boolean {
  const k = (process.env.SETTINGS_ENCRYPTION_KEY || "").trim();
  return k.length >= 32;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string | undefined | null): string {
  if (!payload) return "";
  if (!payload.startsWith("enc:v1:")) return "";
  try {
    const parts = payload.split(":");
    if (parts.length !== 5) return "";
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const ciphertext = Buffer.from(parts[4], "base64");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function isPrivateIpAddress(ip: string): boolean {
  const h = (ip || "").trim().toLowerCase();
  const ipVersion = net.isIP(h);
  if (ipVersion === 4) {
    const [a, b] = h.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a >= 224) return true; // multicast / reserved
  } else if (ipVersion === 6) {
    if (
      h === "::1" ||
      h === "::" ||
      h.startsWith("fe80:") ||
      h.startsWith("fc") ||
      h.startsWith("fd") ||
      h.startsWith("::ffff:127.") ||
      h.startsWith("::ffff:10.") ||
      h.startsWith("::ffff:192.168.") ||
      h.startsWith("::ffff:169.254.")
    ) {
      return true;
    }
  }
  return false;
}

export function isPrivateOrBlockedSmtpHost(host: string): boolean {
  const h = (host || "").trim().toLowerCase();
  if (!h) return true;
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localhost") ||
    h === "::1" ||
    h === "0.0.0.0"
  ) {
    return true;
  }
  if (net.isIP(h) !== 0) {
    return isPrivateIpAddress(h);
  }
  return false;
}

/**
 * Resolves SMTP hostname via DNS and verifies every returned IP is public
 * to prevent private-network SSRF and DNS rebinding attacks.
 */
export async function resolveAndValidateSmtpHost(host: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  if (isPrivateOrBlockedSmtpHost(host)) {
    return { safe: false, reason: "Blocked internal, loopback, or private SMTP hostname/IP." };
  }
  if (net.isIP(host) !== 0) {
    return { safe: true };
  }
  try {
    const records = await dns.promises.lookup(host.trim(), { all: true });
    if (!records || records.length === 0) {
      return { safe: false, reason: "SMTP hostname could not be resolved." };
    }
    for (const rec of records) {
      if (isPrivateIpAddress(rec.address)) {
        return {
          safe: false,
          reason: `SMTP hostname resolved to a blocked private/internal IP (${rec.address}).`,
        };
      }
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: "DNS lookup failed for SMTP hostname." };
  }
}
