export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:");
}

export function stripHtmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseEmailList(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]+/);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const valid: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (cleaned && emailRegex.test(cleaned) && !valid.includes(cleaned)) {
      valid.push(cleaned);
    }
  }
  return valid;
}

export function sanitizeSensitiveBusinessData(text: string): {
  sanitized: string;
  redactedCount: number;
} {
  let redactedCount = 0;
  let sanitized = text;

  // GSTIN (15-char Indian GSTIN)
  sanitized = sanitized.replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/gi, () => {
    redactedCount++;
    return "[REDACTED_GSTIN]";
  });
  // PAN (10-char Indian PAN)
  sanitized = sanitized.replace(/\b[A-Z]{5}\d{4}[A-Z]{1}\b/g, () => {
    redactedCount++;
    return "[REDACTED_PAN]";
  });
  // IFSC Code
  sanitized = sanitized.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, () => {
    redactedCount++;
    return "[REDACTED_IFSC]";
  });
  // Long bank account numbers (11-18 digits)
  sanitized = sanitized.replace(/\b\d{11,18}\b/g, () => {
    redactedCount++;
    return "[REDACTED_ACCOUNT]";
  });
  // Email addresses
  sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => {
    redactedCount++;
    return "[REDACTED_EMAIL]";
  });
  // Phone numbers (+91 / 10-digit Indian mobile / landline patterns)
  sanitized = sanitized.replace(/(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, () => {
    redactedCount++;
    return "[REDACTED_PHONE]";
  });
  // Commercial prices & currency amounts (₹ / Rs. / INR)
  sanitized = sanitized.replace(/(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?/gi, () => {
    redactedCount++;
    return "[REDACTED_PRICE]";
  });
  // Company / Customer organization names (M/s ... or ... Pvt Ltd / LLP / Industries / Enterprises)
  sanitized = sanitized.replace(/\bM\/s\.?\s+[A-Z][A-Za-z0-9 &.,-]{2,50}/g, () => {
    redactedCount++;
    return "[REDACTED_ORG]";
  });
  // Indian PIN codes (6 digits following dash/comma/space)
  sanitized = sanitized.replace(/(?:[-,\s])\b[1-9]\d{5}\b/g, () => {
    redactedCount++;
    return " [REDACTED_PIN]";
  });

  return { sanitized, redactedCount };
}

export interface DefaultEmailTemplateDef {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_html: string;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplateDef[] = [
  {
    id: "tpl_quotation_submission",
    name: "Quotation Submission",
    category: "Quotation",
    subject_template: "Quotation {{quotation_no}} for {{product_type}} - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>Thank you for your inquiry regarding <strong>{{product_type}}</strong>.</p><p>Please find attached our official Technical &amp; Commercial Quotation <strong>{{quotation_no}}</strong> dated <strong>{{date}}</strong> for your review and kind consideration.</p><p>Should you require any technical clarification or commercial discussion, please feel free to contact us.</p>`,
  },
  {
    id: "tpl_revised_quotation",
    name: "Revised Quotation Submission",
    category: "Quotation",
    subject_template: "Revised Quotation {{quotation_no}} for {{product_type}} - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>Further to our recent discussion, please find attached our revised Quotation <strong>{{quotation_no}}</strong> dated <strong>{{date}}</strong> for <strong>{{product_type}}</strong>.</p><p>We look forward to your confirmation and the opportunity to serve your organization.</p>`,
  },
  {
    id: "tpl_proforma_invoice",
    name: "Proforma Invoice (PI)",
    category: "Proforma Invoice",
    subject_template: "Proforma Invoice {{pi_no}} (Ref: {{quotation_no}}) - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>Thank you for your valued order confirmation.</p><p>Please find attached the Proforma Invoice <strong>{{pi_no}}</strong> against Quotation <strong>{{quotation_no}}</strong> for <strong>{{total_amount}}</strong>. Kindly process the advance payment as per the agreed terms to initiate manufacturing/dispatch.</p>`,
  },
  {
    id: "tpl_tax_invoice",
    name: "Tax Invoice (TI)",
    category: "Tax Invoice",
    subject_template: "Tax Invoice {{ti_no}} (Ref: {{quotation_no}}) - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>Please find attached our GST Tax Invoice <strong>{{ti_no}}</strong> dated <strong>{{date}}</strong> for <strong>{{product_type}}</strong> amounting to <strong>{{total_amount}}</strong>.</p><p>Kindly acknowledge receipt and arrange payment as per invoice terms.</p>`,
  },
  {
    id: "tpl_purchase_order",
    name: "Vendor Purchase Order (PO)",
    category: "Purchase Order",
    subject_template: "Purchase Order {{po_no}} - {{company_name}}",
    body_html: `<p>Dear Sir/Madam,</p><p>Please find attached our official Purchase Order <strong>{{po_no}}</strong> dated <strong>{{date}}</strong>.</p><p>Kindly confirm order acceptance, material availability, and expected delivery schedule at the earliest.</p>`,
  },
  {
    id: "tpl_quotation_followup",
    name: "Quotation Follow-up",
    category: "Follow-up",
    subject_template: "Follow-up: Quotation {{quotation_no}} for {{product_type}}",
    body_html: `<p>Dear {{client_contact}},</p><p>We hope this email finds you well. This is a gentle follow-up regarding our Quotation <strong>{{quotation_no}}</strong> dated <strong>{{date}}</strong> for <strong>{{product_type}}</strong>.</p><p>Please let us know if you need any additional technical details, site assessment, or revised commercial options.</p>`,
  },
  {
    id: "tpl_payment_reminder",
    name: "Payment Reminder",
    category: "Accounts",
    subject_template: "Payment Reminder: Invoice {{ti_no}} / {{pi_no}} - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>This is a polite reminder regarding the pending payment against our Invoice (Ref: <strong>{{quotation_no}}</strong>) for <strong>{{total_amount}}</strong>.</p><p>Kindly share the UTR/payment advice once processed, or let us know if you require any supporting documents.</p>`,
  },
  {
    id: "tpl_order_acknowledgement",
    name: "Order Acknowledgement",
    category: "Operations",
    subject_template: "Order Acknowledgement - Ref {{quotation_no}} - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>We are pleased to acknowledge receipt of your Purchase Order against our Quotation <strong>{{quotation_no}}</strong> for <strong>{{product_type}}</strong>.</p><p>Our engineering and production team has initiated the schedule, and we will keep you updated on dispatch and installation milestones.</p>`,
  },
  {
    id: "tpl_dispatch_installation",
    name: "Dispatch / Installation Update",
    category: "Operations",
    subject_template: "Dispatch & Installation Schedule - {{quotation_no}}",
    body_html: `<p>Dear {{client_contact}},</p><p>We are pleased to inform you that your material for <strong>{{product_type}}</strong> (Ref: <strong>{{quotation_no}}</strong>) is ready for dispatch/installation.</p><p>Kindly confirm site readiness and the point of contact for coordination.</p>`,
  },
  {
    id: "tpl_technical_clarification",
    name: "Technical Clarification",
    category: "Engineering",
    subject_template: "Technical Clarification - {{quotation_no}} ({{product_type}})",
    body_html: `<p>Dear {{client_contact}},</p><p>With reference to <strong>{{product_type}}</strong> under Quotation <strong>{{quotation_no}}</strong>, we would like to confirm the site dimensions, power supply availability, and civil foundation readiness prior to execution.</p><p>Please share your convenient time for a brief technical call.</p>`,
  },
  {
    id: "tpl_site_visit",
    name: "Site Visit Confirmation",
    category: "Engineering",
    subject_template: "Site Visit Confirmation - {{client_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>This is to confirm our technical engineer's site visit for <strong>{{client_name}}</strong> regarding <strong>{{product_type}}</strong>.</p><p>Please ensure gate/site access and availability of your site representative.</p>`,
  },
  {
    id: "tpl_vendor_rfq",
    name: "Vendor RFQ / Inquiry",
    category: "Procurement",
    subject_template: "Request for Quotation (RFQ) - {{company_name}}",
    body_html: `<p>Dear Sir/Madam,</p><p>We invite your best techno-commercial quotation for our upcoming industrial automation requirement. Kindly share unit rates, GST, lead time, and warranty terms at your earliest.</p>`,
  },
  {
    id: "tpl_amc_service",
    name: "AMC / Service Follow-up",
    category: "Service",
    subject_template: "Annual Maintenance & Service Support - {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>We hope your automation system is performing smoothly. Please reach out to us if you would like to schedule preventive maintenance or renew your Annual Maintenance Contract (AMC).</p>`,
  },
  {
    id: "tpl_thank_you",
    name: "General Thank-You / Support",
    category: "General",
    subject_template: "Thank You for Connecting with {{company_name}}",
    body_html: `<p>Dear {{client_contact}},</p><p>Thank you for your continued trust in <strong>{{company_name}}</strong>. Please let us know how we can assist you further.</p>`,
  },
];
