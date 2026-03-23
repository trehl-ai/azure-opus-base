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
  const font = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";

  // --- Social icons row ---
  const socialLinks: string[] = [];
  if (config.show_linkedin && data.linkedin_url) {
    socialLinks.push(
      `<td style="padding-right:10px;"><a href="${esc(data.linkedin_url)}" target="_blank" style="text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/24/3536/3536505.png" alt="LinkedIn" width="18" height="18" style="border:0;display:block;" /></a></td>`
    );
  }
  if (config.show_twitter && data.twitter_url) {
    socialLinks.push(
      `<td style="padding-right:10px;"><a href="${esc(data.twitter_url)}" target="_blank" style="text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/24/5968/5968830.png" alt="X" width="18" height="18" style="border:0;display:block;" /></a></td>`
    );
  }
  if (config.show_whatsapp && data.whatsapp_url) {
    const waLink = data.whatsapp_url.startsWith("http")
      ? data.whatsapp_url
      : `https://wa.me/${data.whatsapp_url.replace(/[^0-9]/g, "")}`;
    socialLinks.push(
      `<td style="padding-right:10px;"><a href="${esc(waLink)}" target="_blank" style="text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/24/733/733585.png" alt="WhatsApp" width="18" height="18" style="border:0;display:block;" /></a></td>`
    );
  }

  // --- Contact detail rows ---
  const details: string[] = [];
  if (config.show_phone && data.phone) {
    details.push(`<tr><td style="padding:0 0 4px 0;${font}font-size:13px;line-height:18px;color:#555555;">&#9742;&nbsp; ${esc(data.phone)}</td></tr>`);
  }
  if (data.email) {
    details.push(`<tr><td style="padding:0 0 4px 0;${font}font-size:13px;line-height:18px;color:#555555;">&#9993;&nbsp; <a href="mailto:${esc(data.email)}" style="color:${primary_color};text-decoration:none;">${esc(data.email)}</a></td></tr>`);
  }
  if (config.show_address && data.address) {
    details.push(`<tr><td style="padding:0 0 4px 0;${font}font-size:13px;line-height:18px;color:#555555;">&#128205;&nbsp; ${esc(data.address)}</td></tr>`);
  }
  if (config.show_website && data.website) {
    const href = data.website.startsWith("http") ? data.website : `https://${data.website}`;
    details.push(`<tr><td style="padding:0 0 4px 0;${font}font-size:13px;line-height:18px;color:#555555;">&#127760;&nbsp; <a href="${esc(href)}" target="_blank" style="color:${primary_color};text-decoration:none;">${esc(data.website)}</a></td></tr>`);
  }

  // --- Profile image cell ---
  const hasImage = config.show_profile_image && data.profile_image_url;
  const imgCell = hasImage
    ? `<td width="80" valign="top" style="padding-right:18px;vertical-align:top;">
        <img src="${esc(data.profile_image_url!)}" alt="${esc(data.full_name)}" width="72" height="72" style="width:72px;height:72px;border-radius:50%;border:0;display:block;object-fit:cover;" />
      </td>`
    : "";

  // --- Separator accent bar ---
  const accentBar = `<td colspan="${hasImage ? 2 : 1}" style="padding-bottom:14px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td width="40" style="border-bottom:3px solid ${primary_color};line-height:0;font-size:0;">&nbsp;</td>
        <td style="border-bottom:1px solid ${separator_color};line-height:0;font-size:0;">&nbsp;</td>
      </tr>
    </table>
  </td>`;

  // --- Job title ---
  const titleHtml = data.job_title
    ? `<p style="margin:0 0 10px 0;padding:0;${font}font-size:13px;line-height:16px;color:${primary_color};font-weight:500;letter-spacing:0.3px;">${esc(data.job_title)}</p>`
    : "";

  // --- Social row ---
  const socialRow = socialLinks.length > 0
    ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:10px;"><tr>${socialLinks.join("")}</tr></table>`
    : "";

  return `<!--[if mso]><table cellpadding="0" cellspacing="0" border="0" width="480"><tr><td><![endif]-->
<table cellpadding="0" cellspacing="0" border="0" style="${font}max-width:480px;width:100%;border-collapse:collapse;color:#333333;" width="480">
  <tr>${accentBar}</tr>
  <tr>
    ${imgCell}
    <td valign="top" style="vertical-align:top;">
      <p style="margin:0 0 2px 0;padding:0;${font}font-size:17px;line-height:22px;font-weight:700;color:#1a1a1a;">${esc(data.full_name)}</p>
      ${titleHtml}
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        ${details.join("")}
      </table>
      ${socialRow}
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->`.trim();
}

function esc(str: string): string {
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
