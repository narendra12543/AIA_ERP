import { sanitizeEmailHtml } from "./email-sanitizer";

export type SignatureTemplateKey =
  | "classic_corporate"
  | "premium_industrial"
  | "modern_minimal"
  | "executive_professional"
  | "compact_business";

export interface SignatureConfig {
  templateKey: SignatureTemplateKey;
  fullName: string;
  designation: string;
  department: string;
  companyName: string;
  email: string;
  mobile: string;
  telephone: string;
  website: string;
  address: string;
  logoUrl: string;
  profilePhotoUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappLink?: string;
  closingMessage: string;
  disclaimer?: string;
  fontFamily: string;
  fontSize: string;
  textColor: string;
  accentColor: string;
  logoSize: "sm" | "md" | "lg";
  logoHeightPx?: number;
  logoAlignment: "left" | "top";
  dividerStyle: "solid" | "dashed" | "none";
  showSocialIcons: boolean;
}

export const SIGNATURE_TEMPLATE_LIST: Array<{ key: SignatureTemplateKey; label: string; description: string }> = [
  { key: "classic_corporate", label: "Classic Corporate", description: "Traditional AVEN signature with clean logo and contact lines" },
  { key: "premium_industrial", label: "Premium Industrial", description: "Two-column layout with bold amber accent bar" },
  { key: "modern_minimal", label: "Modern Minimal", description: "Crisp horizontal contact strip with subtle divider" },
  { key: "executive_professional", label: "Executive Professional", description: "Left-aligned logo & executive hierarchy with disclaimer" },
  { key: "compact_business", label: "Compact Business", description: "Dense single-block format ideal for replies & mobile" },
];

function esc(val?: string): string {
  return String(val || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(raw?: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("/assets/")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {}
  return "";
}

export function resolveSignaturePlaceholders(html: string, context: { email?: string; name?: string; designation?: string; companyName?: string }): string {
  return String(html || "")
    .replace(/\{\{\s*email\s*\}\}/gi, esc(context.email || "sales@avenautomation.in"))
    .replace(/\{\{\s*name\s*\}\}/gi, esc(context.name || "Aven Industrial Automation"))
    .replace(/\{\{\s*designation\s*\}\}/gi, esc(context.designation || ""))
    .replace(/\{\{\s*company\s*\}\}/gi, esc(context.companyName || "Aven Industrial Automation"));
}

export function generateSignatureHtml(cfg: SignatureConfig): string {
  const customPx = Number(cfg.logoHeightPx || 0);
  const logoH =
    customPx >= 24 && customPx <= 160
      ? `${Math.round(customPx)}px`
      : cfg.logoSize === "sm"
      ? "44px"
      : cfg.logoSize === "lg"
      ? "84px"
      : "64px";
  const logoSrc = safeUrl(cfg.logoUrl) || "https://erp.avenautomation.in/assets/logo.png";
  const photoSrc = safeUrl(cfg.profilePhotoUrl);
  const webHref = safeUrl(cfg.website) || "https://avenautomation.in";
  const dividerCss =
    cfg.dividerStyle === "dashed"
      ? `border-top: 1px dashed ${esc(cfg.accentColor)};`
      : cfg.dividerStyle === "solid"
      ? `border-top: 2px solid ${esc(cfg.accentColor)};`
      : "";

  const socials: string[] = [];
  if (cfg.showSocialIcons) {
    if (safeUrl(cfg.linkedinUrl)) socials.push(`<a href="${esc(safeUrl(cfg.linkedinUrl))}" style="color:${esc(cfg.accentColor)};text-decoration:none;margin-right:8px;">LinkedIn</a>`);
    if (safeUrl(cfg.facebookUrl)) socials.push(`<a href="${esc(safeUrl(cfg.facebookUrl))}" style="color:${esc(cfg.accentColor)};text-decoration:none;margin-right:8px;">Facebook</a>`);
    if (safeUrl(cfg.instagramUrl)) socials.push(`<a href="${esc(safeUrl(cfg.instagramUrl))}" style="color:${esc(cfg.accentColor)};text-decoration:none;margin-right:8px;">Instagram</a>`);
    if (safeUrl(cfg.whatsappLink)) socials.push(`<a href="${esc(safeUrl(cfg.whatsappLink))}" style="color:#16a34a;text-decoration:none;">WhatsApp</a>`);
  }

  const contactLines = [
    cfg.mobile ? `Mobile: ${esc(cfg.mobile)}` : "",
    cfg.telephone ? `Tel: ${esc(cfg.telephone)}` : "",
    cfg.email ? `Email: <a href="mailto:${esc(cfg.email)}" style="color:#1d4ed8;text-decoration:none;">${esc(cfg.email)}</a>` : "",
    `Web: <a href="${esc(webHref)}" style="color:#1d4ed8;text-decoration:none;">${esc(webHref.replace(/^https?:\/\//, ""))}</a>`,
  ]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");

  const disclaimerBlock = cfg.disclaimer
    ? `<p style="margin:8px 0 0 0;font-size:8pt;color:#6b7280;line-height:1.35;">${esc(cfg.disclaimer)}</p>`
    : "";

  const baseStyle = `font-family:${esc(cfg.fontFamily || "Verdana")},Geneva,sans-serif;font-size:${esc(cfg.fontSize || "10pt")};line-height:1.45;color:${esc(cfg.textColor || "#1f2937")};`;

  let inner = "";
  if (cfg.templateKey === "premium_industrial" || cfg.templateKey === "executive_professional") {
    const borderSide = cfg.templateKey === "premium_industrial" ? `border-left:3px solid ${esc(cfg.accentColor)};padding-left:12px;` : "";
    inner = `
      <p style="margin:0 0 6px 0;">${esc(cfg.closingMessage || "Regards,")}</p>
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${baseStyle}">
        <tr>
          <td style="vertical-align:top;padding-right:12px;">
            ${photoSrc ? `<img src="${esc(photoSrc)}" alt="${esc(cfg.fullName)}" style="height:${logoH};width:${logoH};border-radius:50%;object-fit:cover;display:block;margin-bottom:4px;" />` : ""}
            <img src="${esc(logoSrc)}" alt="${esc(cfg.companyName)}" style="height:${logoH};width:auto;display:block;" />
          </td>
          <td style="vertical-align:top;${borderSide}">
            <div style="font-weight:bold;font-size:10.5pt;color:${esc(cfg.textColor)};">${esc(cfg.fullName || cfg.companyName)}</div>
            ${cfg.designation || cfg.department ? `<div style="font-size:9pt;color:#4b5563;">${esc([cfg.designation, cfg.department].filter(Boolean).join(" • "))}</div>` : ""}
            <div style="font-weight:bold;color:${esc(cfg.accentColor)};margin-top:2px;">${esc(cfg.companyName)}</div>
            <div style="font-size:9pt;margin-top:4px;">${contactLines}</div>
            ${cfg.address ? `<div style="font-size:8.5pt;color:#6b7280;margin-top:2px;">${esc(cfg.address)}</div>` : ""}
            ${socials.length > 0 ? `<div style="font-size:8.5pt;margin-top:4px;">${socials.join("")}</div>` : ""}
          </td>
        </tr>
      </table>
      ${disclaimerBlock}`;
  } else if (cfg.templateKey === "compact_business") {
    inner = `
      <p style="margin:0 0 4px 0;">${esc(cfg.closingMessage || "Regards,")} <strong>${esc(cfg.fullName || cfg.companyName)}</strong>${cfg.designation ? ` (${esc(cfg.designation)})` : ""}</p>
      <div style="font-size:9pt;${dividerCss}padding-top:4px;">
        <strong>${esc(cfg.companyName)}</strong> &bull; ${contactLines}
      </div>
      ${disclaimerBlock}`;
  } else {
    // classic_corporate & modern_minimal
    inner = `
      <p style="margin:0 0 4px 0;">${esc(cfg.closingMessage || "Regards,")}</p>
      ${cfg.fullName ? `<p style="margin:0 0 2px 0;"><strong>${esc(cfg.fullName)}</strong>${cfg.designation ? ` — ${esc(cfg.designation)}` : ""}</p>` : ""}
      <p style="margin:0 0 6px 0;"><strong style="color:${cfg.templateKey === "modern_minimal" ? esc(cfg.accentColor) : esc(cfg.textColor)};">${esc(cfg.companyName)}</strong></p>
      <div style="${dividerCss}padding-top:4px;font-size:9.5pt;">
        ${cfg.mobile ? `<p style="margin:0 0 2px 0;">Phone: ${esc(cfg.mobile)}${cfg.telephone ? ` | ${esc(cfg.telephone)}` : ""}</p>` : ""}
        ${cfg.email ? `<p style="margin:0 0 2px 0;">Email: <a href="mailto:${esc(cfg.email)}" style="color:#1d4ed8;text-decoration:none;">${esc(cfg.email)}</a></p>` : ""}
        <p style="margin:0 0 6px 0;">Website: <a href="${esc(webHref)}" style="color:#1d4ed8;text-decoration:none;">${esc(webHref)}</a></p>
        ${cfg.address ? `<p style="margin:0 0 6px 0;font-size:8.5pt;color:#6b7280;">${esc(cfg.address)}</p>` : ""}
        ${socials.length > 0 ? `<p style="margin:0 0 6px 0;font-size:8.5pt;">${socials.join("")}</p>` : ""}
      </div>
      <img src="${esc(logoSrc)}" alt="${esc(cfg.companyName)}" style="height:${logoH};width:auto;display:block;" />
      ${disclaimerBlock}`;
  }

  return sanitizeEmailHtml(`<div data-aven-sig="true" style="${baseStyle}">${inner}</div>`);
}

export function stripExistingAvenSignature(bodyHtml: string): string {
  return String(bodyHtml || "")
    .replace(/<div[^>]*data-aven-sig=["']true["'][^>]*>[\s\S]*?<\/div>\s*$/i, "")
    .trim();
}
