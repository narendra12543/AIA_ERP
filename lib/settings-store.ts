import { query } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export interface EffectiveSmtpConfig {
  enabled: boolean;
  provider: string;
  host: string;
  port: number;
  encryption: "SSL" | "TLS" | "STARTTLS";
  displayName: string;
  senderEmail: string;
  replyTo: string;
  username: string;
  password: string;
  defaultCc: string;
  defaultBcc: string;
  signatureHtml: string;
  lastTestResult?: string | null;
  lastTestAt?: string | null;
  lastTestError?: string | null;
  source: "database" | "environment";
}

export interface EffectiveAiConfig {
  enabled: boolean;
  allowExternalAi: boolean;
  provider: "auto" | "gemini" | "languagetool" | "local";
  geminiKey: string;
  geminiModel: string;
  languageToolEnabled: boolean;
  localFallbackEnabled: boolean;
  defaultTone: "grammar" | "professional" | "formal" | "concise" | "polite";
  dailyLimit: number;
}

async function readSettingJson<T>(key: string): Promise<T | null> {
  try {
    const res = await query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
    const raw = res?.rows[0]?.value;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeSettingJson(key: string, data: unknown, updatedBy: string): Promise<void> {
  await query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(data), updatedBy]
  );
}

export async function getEffectiveSmtpConfig(): Promise<EffectiveSmtpConfig> {
  const envEmail = (process.env.ZOHO_EMAIL || "").trim();
  const envPass = (process.env.ZOHO_APP_PASSWORD || "").trim();
  const envHost = (process.env.ZOHO_SMTP_HOST || "smtp.zoho.in").trim();
  const envPort = Number(process.env.ZOHO_SMTP_PORT || "465");
  const envFromName = (process.env.ZOHO_FROM_NAME || "AVEN Industrial Automation").trim();
  const envDefaultCc = (process.env.ZOHO_DEFAULT_CC || "").trim();

  const stored = await readSettingJson<Record<string, any>>("smtp_config");
  const storedPass = stored?.passwordEnc ? decryptSecret(stored.passwordEnc) : "";

  const host = (stored?.host || envHost).trim();
  const port = Number(stored?.port || envPort || 465);
  const senderEmail = (stored?.senderEmail || envEmail).trim();
  const username = (stored?.username || senderEmail || envEmail).trim();
  const password = storedPass || envPass;

  return {
    enabled: stored?.enabled !== undefined ? Boolean(stored.enabled) : true,
    provider: stored?.provider || "Zoho Mail",
    host,
    port,
    encryption: (stored?.encryption as "SSL" | "TLS" | "STARTTLS") || (port === 465 ? "SSL" : "STARTTLS"),
    displayName: (stored?.displayName || envFromName).trim(),
    senderEmail,
    replyTo: (stored?.replyTo || senderEmail).trim(),
    username,
    password,
    defaultCc: stored?.defaultCc !== undefined ? String(stored.defaultCc).trim() : envDefaultCc,
    defaultBcc: stored?.defaultBcc ? String(stored.defaultBcc).trim() : "",
    signatureHtml: stored?.signatureHtml ? String(stored.signatureHtml) : "",
    lastTestResult: stored?.lastTestResult || null,
    lastTestAt: stored?.lastTestAt || null,
    lastTestError: stored?.lastTestError || null,
    source: stored && stored.senderEmail ? "database" : "environment",
  };
}

export async function saveSmtpConfig(input: Record<string, any>, updatedBy: string): Promise<void> {
  const existing = (await readSettingJson<Record<string, any>>("smtp_config")) || {};
  const newPassRaw = typeof input.password === "string" ? input.password.trim() : "";
  const isMaskedPlaceholder = newPassRaw === "••••••••" || newPassRaw === "********";

  const payload = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled ?? true,
    provider: String(input.provider || existing.provider || "Zoho Mail").trim(),
    host: String(input.host || existing.host || "smtp.zoho.in").trim(),
    port: Number(input.port || existing.port || 465),
    encryption: String(input.encryption || existing.encryption || "SSL").trim(),
    displayName: String(input.displayName || existing.displayName || "AVEN Industrial Automation").trim(),
    senderEmail: String(input.senderEmail || existing.senderEmail || "").trim(),
    replyTo: String(input.replyTo || existing.replyTo || "").trim(),
    username: String(input.username || input.senderEmail || existing.username || "").trim(),
    passwordEnc:
      newPassRaw && !isMaskedPlaceholder ? encryptSecret(newPassRaw) : existing.passwordEnc || "",
    defaultCc: String(input.defaultCc ?? existing.defaultCc ?? "").trim(),
    defaultBcc: String(input.defaultBcc ?? existing.defaultBcc ?? "").trim(),
    signatureHtml: String(input.signatureHtml ?? existing.signatureHtml ?? ""),
    lastTestResult: existing.lastTestResult || null,
    lastTestAt: existing.lastTestAt || null,
    lastTestError: existing.lastTestError || null,
  };

  await writeSettingJson("smtp_config", payload, updatedBy);
}

export async function recordSmtpTestResult(
  result: "success" | "failed",
  errorMessage: string | null,
  updatedBy: string
): Promise<void> {
  const existing = (await readSettingJson<Record<string, any>>("smtp_config")) || {};
  existing.lastTestResult = result;
  existing.lastTestAt = new Date().toISOString();
  existing.lastTestError = errorMessage;
  await writeSettingJson("smtp_config", existing, updatedBy);
}

export async function resetSmtpConfig(updatedBy: string): Promise<void> {
  await query(`DELETE FROM system_settings WHERE key = 'smtp_config'`, []);
  await writeSettingJson("smtp_config_reset_log", { resetAt: new Date().toISOString() }, updatedBy);
}

export async function getEffectiveAiConfig(): Promise<EffectiveAiConfig> {
  const envEnabled = (process.env.ENABLE_AI_ASSISTANT ?? "true").toLowerCase() !== "false";
  const envKey = (process.env.GEMINI_API_KEY || "").trim();
  const envModel = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();

  const [stored, legacyToggle] = await Promise.all([
    readSettingJson<Record<string, any>>("ai_config"),
    query(`SELECT value FROM system_settings WHERE key = 'ai_assistant_enabled'`, []).catch(() => ({ rows: [] })),
  ]);

  const legacyVal = legacyToggle?.rows[0]?.value;
  const enabled =
    stored?.enabled !== undefined
      ? Boolean(stored.enabled)
      : legacyVal !== undefined
      ? legacyVal === "true"
      : envEnabled;

  const storedKey = stored?.geminiKeyEnc ? decryptSecret(stored.geminiKeyEnc) : "";
  const envAllowExternal = (process.env.ALLOW_EXTERNAL_AI ?? "false").toLowerCase() === "true";
  return {
    enabled,
    allowExternalAi: stored?.allowExternalAi !== undefined ? Boolean(stored.allowExternalAi) : envAllowExternal,
    provider: (stored?.provider as EffectiveAiConfig["provider"]) || "auto",
    geminiKey: storedKey || envKey,
    geminiModel: String(stored?.geminiModel || envModel).trim(),
    languageToolEnabled: stored?.languageToolEnabled !== undefined ? Boolean(stored.languageToolEnabled) : true,
    localFallbackEnabled: stored?.localFallbackEnabled !== undefined ? Boolean(stored.localFallbackEnabled) : true,
    defaultTone: (stored?.defaultTone as EffectiveAiConfig["defaultTone"]) || "professional",
    dailyLimit: Math.min(200, Math.max(5, Number(stored?.dailyLimit || 50))),
  };
}

export async function saveAiConfig(input: Record<string, any>, updatedBy: string): Promise<void> {
  const existing = (await readSettingJson<Record<string, any>>("ai_config")) || {};
  const newKeyRaw = typeof input.geminiKey === "string" ? input.geminiKey.trim() : "";
  const isMasked = newKeyRaw === "••••••••" || newKeyRaw === "********";

  const payload = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled ?? true,
    allowExternalAi:
      input.allowExternalAi !== undefined ? Boolean(input.allowExternalAi) : existing.allowExternalAi ?? false,
    provider: String(input.provider || existing.provider || "auto"),
    geminiKeyEnc:
      newKeyRaw && !isMasked ? encryptSecret(newKeyRaw) : existing.geminiKeyEnc || "",
    geminiModel: String(input.geminiModel || existing.geminiModel || "gemini-2.0-flash").trim(),
    languageToolEnabled:
      input.languageToolEnabled !== undefined ? Boolean(input.languageToolEnabled) : existing.languageToolEnabled ?? true,
    localFallbackEnabled:
      input.localFallbackEnabled !== undefined ? Boolean(input.localFallbackEnabled) : existing.localFallbackEnabled ?? true,
    defaultTone: String(input.defaultTone || existing.defaultTone || "professional"),
    dailyLimit: Math.min(200, Math.max(5, Number(input.dailyLimit || existing.dailyLimit || 50))),
  };

  await writeSettingJson("ai_config", payload, updatedBy);
}
