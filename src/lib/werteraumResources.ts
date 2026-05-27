import { supabaseEIC } from "@/lib/supabaseEIC";

// Shared WerteRaum resource logic. Extracted from the (removed) WerteRaumRessourcen
// deal-detail panel so the Kanban DealCard can reuse the exact same signed-URL flow.
export const WERTERAUM_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e";
export const WERTERAUM_WEBSITE_URL = "https://werteraum-schule.de";

// Storage lives in the EIC project (ttgvhqygmgtnjgwunuwz) "project-files" bucket —
// intentionally supabaseEIC, NOT the main @/integrations/supabase/client.
const STORAGE_BUCKET = "project-files";
const SIGNED_URL_TTL = 3600;
const LEITFADEN_PATH = "werteraum/leitfaden/Gespraechsleitfaden_Werteraum_Calls_v3.docx";

const viewerUrl = (signedUrl: string) =>
  `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=false`;

// Generates a short-lived signed URL for the Gesprächsleitfaden and opens it in the
// Google Docs viewer (new tab). Returns false on failure so callers can toast.
export async function openWerteraumLeitfaden(): Promise<boolean> {
  const { data, error } = await supabaseEIC.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(LEITFADEN_PATH, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return false;
  window.open(viewerUrl(data.signedUrl), "_blank", "noopener,noreferrer");
  return true;
}
