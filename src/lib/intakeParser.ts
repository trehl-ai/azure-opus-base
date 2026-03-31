/**
 * Rule-based email body parser for intake messages.
 * No AI, no external API — pure regex/string matching.
 */

export interface IntakeParsedData {
  company_name: string;
  full_name: string;
  job_title: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  notes: string;
  suggested_pipeline: string;
  suggested_stage: string;
}

interface KeywordGroup {
  field: keyof IntakeParsedData;
  keywords: string[];
}

const KEYWORD_MAP: KeywordGroup[] = [
  { field: "company_name", keywords: ["firma:", "company:", "institution:", "unternehmen:", "organisation:"] },
  { field: "full_name", keywords: ["ansprechpartner:", "kontakt:", "name:", "kontaktperson:"] },
  { field: "job_title", keywords: ["position:", "jobtitel:", "rolle:", "funktion:", "titel:"] },
  { field: "email", keywords: ["e-mail:", "email:", "mail:"] },
  { field: "phone", keywords: ["telefon:", "tel:", "phone:", "tel.:", "mobil:", "fon:"] },
  { field: "address", keywords: ["adresse:", "straße:", "address:", "anschrift:"] },
  { field: "website", keywords: ["website:", "web:", "url:", "homepage:"] },
  { field: "notes", keywords: ["notiz:", "notizen:", "anmerkung:", "notes:", "bemerkung:", "kommentar:"] },
  { field: "suggested_pipeline", keywords: ["pipeline:"] },
  { field: "suggested_stage", keywords: ["stage:", "phase:", "stufe:"] },
];

/**
 * Parse an email body string and extract structured fields
 * using keyword-based line matching.
 */
export function parseEmailBody(body: string): IntakeParsedData {
  const result: IntakeParsedData = {
    company_name: "",
    full_name: "",
    job_title: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    notes: "",
    suggested_pipeline: "",
    suggested_stage: "",
  };

  if (!body || !body.trim()) return result;

  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;

    const lower = trimmed.toLowerCase();

    for (const group of KEYWORD_MAP) {
      for (const keyword of group.keywords) {
        if (lower.startsWith(keyword)) {
          const value = trimmed.substring(keyword.length).trim();
          // Remove surrounding brackets if present: [value]
          const cleaned = value.replace(/^\[(.+)\]$/, "$1").trim();
          if (cleaned && !result[group.field]) {
            result[group.field] = cleaned;
          }
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Split a full name into first_name and last_name.
 * Handles "Vorname Nachname" and "Nachname, Vorname".
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName.trim()) return { firstName: "", lastName: "" };

  // Handle "Nachname, Vorname"
  if (fullName.includes(",")) {
    const parts = fullName.split(",").map((p) => p.trim());
    return { firstName: parts[1] || "", lastName: parts[0] || "" };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];
  return { firstName, lastName };
}
