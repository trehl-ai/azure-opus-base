import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Signature data types
// ---------------------------------------------------------------------------

export interface SignatureData {
  full_name: string;
  job_title: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  profile_image_url?: string;
  linkedin_url: string;
  twitter_url: string;
  whatsapp_url: string;
}

// ---------------------------------------------------------------------------
// Global template config (stored in workspace_settings)
// ---------------------------------------------------------------------------

export interface SignatureTemplateConfig {
  show_profile_image: boolean;
  show_phone: boolean;
  show_address: boolean;
  show_website: boolean;
  show_linkedin: boolean;
  show_twitter: boolean;
  show_whatsapp: boolean;
  primary_color: string;
  separator_color: string;
}

export const DEFAULT_TEMPLATE_CONFIG: SignatureTemplateConfig = {
  show_profile_image: true,
  show_phone: true,
  show_address: true,
  show_website: true,
  show_linkedin: true,
  show_twitter: true,
  show_whatsapp: true,
  primary_color: "#4F46E5",
  separator_color: "#E5E7EB",
};

// ---------------------------------------------------------------------------
// Render HTML signature
// ---------------------------------------------------------------------------

export function renderSignatureHtml(
  data: SignatureData,
  config: SignatureTemplateConfig = DEFAULT_TEMPLATE_CONFIG
): string {
  const { primary_color, separator_color } = config;

  const socialIcons: string[] = [];

  if (config.show_linkedin && data.linkedin_url) {
    socialIcons.push(
      `<a href="${escHtml(data.linkedin_url)}" target="_blank" style="display:inline-block;margin-right:8px;text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/3536/3536505.png" alt="LinkedIn" width="20" height="20" style="border:0;display:block;" />
      </a>`
    );
  }
  if (config.show_twitter && data.twitter_url) {
    socialIcons.push(
      `<a href="${escHtml(data.twitter_url)}" target="_blank" style="display:inline-block;margin-right:8px;text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/5968/5968830.png" alt="X/Twitter" width="20" height="20" style="border:0;display:block;" />
      </a>`
    );
  }
  if (config.show_whatsapp && data.whatsapp_url) {
    const waLink = data.whatsapp_url.startsWith("http")
      ? data.whatsapp_url
      : `https://wa.me/${data.whatsapp_url.replace(/[^0-9]/g, "")}`;
    socialIcons.push(
      `<a href="${escHtml(waLink)}" target="_blank" style="display:inline-block;margin-right:8px;text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733585.png" alt="WhatsApp" width="20" height="20" style="border:0;display:block;" />
      </a>`
    );
  }

  const contactLines: string[] = [];
  if (config.show_phone && data.phone) {
    contactLines.push(`<span style="color:#6B7280;font-size:13px;">📞 ${escHtml(data.phone)}</span>`);
  }
  if (data.email) {
    contactLines.push(`<span style="color:#6B7280;font-size:13px;">✉️ <a href="mailto:${escHtml(data.email)}" style="color:${primary_color};text-decoration:none;">${escHtml(data.email)}</a></span>`);
  }
  if (config.show_address && data.address) {
    contactLines.push(`<span style="color:#6B7280;font-size:13px;">📍 ${escHtml(data.address)}</span>`);
  }
  if (config.show_website && data.website) {
    const href = data.website.startsWith("http") ? data.website : `https://${data.website}`;
    contactLines.push(`<span style="color:#6B7280;font-size:13px;">🌐 <a href="${escHtml(href)}" target="_blank" style="color:${primary_color};text-decoration:none;">${escHtml(data.website)}</a></span>`);
  }

  const imageCell = config.show_profile_image && data.profile_image_url
    ? `<td style="vertical-align:top;padding-right:16px;">
        <img src="${escHtml(data.profile_image_url)}" alt="${escHtml(data.full_name)}" width="80" height="80" style="border-radius:50%;border:0;display:block;object-fit:cover;" />
      </td>`
    : "";

  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;border-collapse:collapse;">
  <tr>
    <td style="padding-top:16px;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td colspan="2" style="padding-bottom:12px;">
            <hr style="border:none;border-top:2px solid ${separator_color};margin:0;" />
          </td>
        </tr>
        <tr>
          ${imageCell}
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px 0;font-size:17px;font-weight:700;color:#1F2937;">${escHtml(data.full_name)}</p>
            ${data.job_title ? `<p style="margin:0 0 10px 0;font-size:13px;color:${primary_color};font-weight:500;">${escHtml(data.job_title)}</p>` : ""}
            <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              ${contactLines.map((line) => `<tr><td style="padding-bottom:3px;">${line}</td></tr>`).join("")}
            </table>
            ${socialIcons.length > 0 ? `<div style="margin-top:10px;">${socialIcons.join("")}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Load user signature from DB
// ---------------------------------------------------------------------------

export async function loadUserSignature(): Promise<{ data: SignatureData; config: SignatureTemplateConfig; html: string } | null> {
  const { data: sig, error } = await supabase
    .from("user_email_signatures")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !sig) return null;

  // Load template config from workspace_settings
  const { data: configRow } = await supabase
    .from("workspace_settings")
    .select("value")
    .eq("key", "signature_template_config")
    .maybeSingle();

  const config: SignatureTemplateConfig = configRow?.value
    ? { ...DEFAULT_TEMPLATE_CONFIG, ...JSON.parse(configRow.value) }
    : DEFAULT_TEMPLATE_CONFIG;

  // Build public URL for profile image
  let profileImageUrl: string | undefined;
  if (sig.profile_image_path) {
    const { data: urlData } = supabase.storage
      .from("signature-images")
      .getPublicUrl(sig.profile_image_path);
    profileImageUrl = urlData?.publicUrl;
  }

  const sigData: SignatureData = {
    full_name: sig.full_name || "",
    job_title: sig.job_title || "",
    phone: sig.phone || "",
    email: sig.email || "",
    address: sig.address || "",
    website: sig.website || "",
    profile_image_url: profileImageUrl,
    linkedin_url: sig.linkedin_url || "",
    twitter_url: sig.twitter_url || "",
    whatsapp_url: sig.whatsapp_url || "",
  };

  return {
    data: sigData,
    config,
    html: renderSignatureHtml(sigData, config),
  };
}
