import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { sanitizeSensitiveBusinessData } from "@/lib/email-sanitizer";
import { getEffectiveAiConfig, EffectiveAiConfig } from "@/lib/settings-store";

type AiMode =
  | "grammar"
  | "professional"
  | "formal"
  | "concise"
  | "polite"
  | "followup"
  | "translate_en";

// Per-user in-memory rate limit + daily quota tracker
const minuteWindows = new Map<string, number[]>();
const dailyCounters = new Map<string, { date: string; count: number }>();

const MAX_PER_MINUTE = 10;

function checkAiQuota(
  userId: string,
  dailyLimit: number
): { allowed: boolean; remainingToday: number; error?: string } {
  const now = Date.now();
  const prev = (minuteWindows.get(userId) || []).filter((t) => now - t < 60_000);
  if (prev.length >= MAX_PER_MINUTE) {
    return {
      allowed: false,
      remainingToday: 0,
      error: "AI Assistant rate limit reached (max 10 requests/minute). Please wait a moment.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayState = dailyCounters.get(userId);
  const usedToday = dayState && dayState.date === today ? dayState.count : 0;
  if (usedToday >= dailyLimit) {
    return {
      allowed: false,
      remainingToday: 0,
      error: `Daily AI Assistant quota reached (${dailyLimit}/day).`,
    };
  }

  prev.push(now);
  minuteWindows.set(userId, prev);
  dailyCounters.set(userId, { date: today, count: usedToday + 1 });
  return { allowed: true, remainingToday: dailyLimit - (usedToday + 1) };
}

async function callGeminiFreeTier(
  mode: AiMode,
  text: string,
  aiCfg: EffectiveAiConfig,
  contextSubject?: string
): Promise<string | null> {
  if (!aiCfg.allowExternalAi) return null;
  const apiKey = aiCfg.geminiKey;
  if (!apiKey || aiCfg.provider === "local" || aiCfg.provider === "languagetool") return null;

  const model = aiCfg.geminiModel || "gemini-2.0-flash";
  const modePromptMap: Record<AiMode, string> = {
    grammar: "Fix all grammar, spelling, punctuation, and capitalization errors while keeping the original meaning and B2B tone.",
    professional: "Rewrite this B2B industrial engineering email so it is clear, crisp, and professionally worded.",
    formal: "Rewrite this email in a formal corporate tone suitable for senior procurement and engineering clients.",
    concise: "Make this email concise and direct while preserving all key details, dates, and action items.",
    polite: "Rewrite this email to sound warm, courteous, and customer-centric while remaining professional.",
    followup: "Generate a polite, action-oriented B2B follow-up email based on the provided notes or draft.",
    translate_en: "Translate any Marathi, Hindi, or mixed-language text into clear, professional B2B English.",
  };

  const instruction = `${modePromptMap[mode]} Return ONLY the improved email body text without markdown fences or commentary.${
    contextSubject ? ` Subject context: ${contextSubject}` : ""
  }`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${instruction}\n\nText:\n${text}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
        }),
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof output === "string" && output.trim() ? output.trim() : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function callLanguageToolGrammar(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const params = new URLSearchParams({ text, language: "en-US" });
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.matches) || data.matches.length === 0) return null;

    // Apply non-overlapping replacements from end to start
    let corrected = text;
    const matches = [...data.matches].sort((a, b) => b.offset - a.offset);
    for (const m of matches) {
      const rep = m?.replacements?.[0]?.value;
      if (typeof rep === "string" && typeof m.offset === "number" && typeof m.length === "number") {
        corrected = corrected.slice(0, m.offset) + rep + corrected.slice(m.offset + m.length);
      }
    }
    return corrected;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function localRuleBasedTransform(mode: AiMode, text: string, contextSubject?: string): string {
  let out = text.trim();

  // Basic cleanup & common B2B typo corrections
  const commonFixes: Array<[RegExp, string]> = [
    [/\bpls\b/gi, "please"],
    [/\bplz\b/gi, "please"],
    [/\bkindly find attached\b/gi, "Please find attached"],
    [/\bpfa\b/gi, "Please find attached"],
    [/\bteh\b/gi, "the"],
    [/\brecieve\b/gi, "receive"],
    [/\bseperate\b/gi, "separate"],
    [/\bqoutation\b/gi, "quotation"],
    [/\bquotaton\b/gi, "quotation"],
    [/\binvoce\b/gi, "invoice"],
    [/\bregading\b/gi, "regarding"],
    [/\brequirment\b/gi, "requirement"],
    [/\bavailble\b/gi, "available"],
    [/\bthanking you\b/gi, "Thank you"],
    [/\bi\b/g, "I"],
  ];
  for (const [pattern, replacement] of commonFixes) {
    out = out.replace(pattern, replacement);
  }

  // Normalize spacing and sentence capitalization
  out = out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`);

  if (mode === "translate_en") {
    const phraseMap: Array<[RegExp, string]> = [
      [/namaskar|नमस्कार/gi, "Dear Sir/Madam,"],
      [/kripaya|कृपया/gi, "please"],
      [/dhanyavad|धन्यवाद/gi, "Thank you."],
      [/quotation pathavle ahe|quotation पाठवले आहे/gi, "We have shared the quotation for your review."],
      [/payment kela ahe|payment केले आहे/gi, "The payment has been processed."],
      [/bheja hai|भेजा है/gi, "has been sent."],
    ];
    for (const [rx, rep] of phraseMap) {
      out = out.replace(rx, rep);
    }
    return out;
  }

  if (mode === "followup") {
    const topic = contextSubject ? ` regarding "${contextSubject}"` : "";
    return `Dear Sir/Madam,\n\nI hope this email finds you well. This is a gentle follow-up${topic}.\n\n${
      out ? `${out}\n\n` : ""
    }Please let us know if you require any additional technical details or commercial clarification. We look forward to your feedback.\n\nWarm regards,`;
  }

  if (mode === "formal") {
    if (!/^dear\s/i.test(out)) {
      out = `Dear Sir/Madam,\n\n${out}`;
    }
    if (!/(regards|sincerely|thank you)/i.test(out)) {
      out = `${out}\n\nThank you for your time and consideration.`;
    }
    return out;
  }

  if (mode === "polite") {
    if (!/thank you/i.test(out)) {
      out = `${out}\n\nThank you for your continued support and cooperation. Please feel free to reach out if we can assist further.`;
    }
    return out;
  }

  if (mode === "concise") {
    const lines = out
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.join("\n");
  }

  // grammar / professional
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const aiCfg = await getEffectiveAiConfig();
  const today = new Date().toISOString().slice(0, 10);
  const dayState = dailyCounters.get(auth.user.id);
  const usedToday = dayState && dayState.date === today ? dayState.count : 0;

  return NextResponse.json({
    enabled: aiCfg.enabled,
    providerMode: aiCfg.geminiKey ? "gemini_free_with_local_fallback" : "languagetool_and_local_fallback",
    dailyLimit: aiCfg.dailyLimit,
    usedToday,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.settings" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    await query(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ('ai_assistant_enabled', $1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [enabled ? "true" : "false", auth.user.email]
    );
    await logAudit(
      "AI_ASSISTANT_TOGGLED",
      auth.user.email,
      `ai_assistant_enabled=${enabled}`,
      { actorName: auth.user.name, module: "ai", recordRef: "ai_assistant_enabled", outcome: "success" }
    );
    return NextResponse.json({ success: true, enabled });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update AI Assistant setting." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.compose" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const aiCfg = await getEffectiveAiConfig();
  if (!aiCfg.enabled) {
    return NextResponse.json(
      { error: "AI Email Assistant is currently disabled by the Administrator." },
      { status: 403 }
    );
  }

  const quota = checkAiQuota(auth.user.id, aiCfg.dailyLimit);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.error }, { status: 429 });
  }

  try {
    const body = await req.json();
    const mode = (body.mode || aiCfg.defaultTone || "grammar") as AiMode;
    const rawText = String(body.text || "").trim().slice(0, 6000);
    const contextSubject = body.subject ? String(body.subject).trim().slice(0, 200) : undefined;

    if (!rawText && mode !== "followup") {
      return NextResponse.json({ error: "Please enter draft text first." }, { status: 400 });
    }

    // Privacy sanitization before sending to any external AI provider
    const { sanitized, redactedCount } = sanitizeSensitiveBusinessData(rawText);

    let improvedText: string | null = await callGeminiFreeTier(mode, sanitized, aiCfg, contextSubject);
    let providerUsed = "gemini_free";

    if (!improvedText && aiCfg.allowExternalAi && mode === "grammar" && aiCfg.languageToolEnabled && aiCfg.provider !== "local") {
      improvedText = await callLanguageToolGrammar(sanitized);
      providerUsed = "languagetool";
    }

    if (!improvedText) {
      if (!aiCfg.localFallbackEnabled) {
        return NextResponse.json(
          { error: "No external AI provider responded and local fallback is disabled." },
          { status: 503 }
        );
      }
      improvedText = localRuleBasedTransform(mode, sanitized, contextSubject);
      providerUsed = "local_b2b_engine";
    }

    await logAudit(
      "AI_EMAIL_ASSIST",
      auth.user.email,
      `mode=${mode}, provider=${providerUsed}, redacted=${redactedCount}`,
      { actorName: auth.user.name, module: "ai", recordRef: mode, outcome: "success" }
    );

    return NextResponse.json({
      improvedText,
      providerUsed,
      mode,
      redactedCount,
      remainingToday: quota.remainingToday,
    });
  } catch (err: any) {
    console.error("AI email assist error:", err);
    return NextResponse.json({ error: "Failed to process AI email assist request." }, { status: 500 });
  }
}
