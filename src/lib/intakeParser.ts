/**
 * Rule-based email body parser for intake messages.
 * Supports structured keyword parsing AND signature block extraction
 * from forwarded emails. No AI, no external API — pure regex/string matching.
 */

export type ExtractionSource = "signature" | "keyword" | "manual";

export interface IntakeParsedData {
  company_name: string;
  full_name: string;
  job_title: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  website: string;
  notes: string;
  suggested_pipeline: string;
  suggested_stage: string;
  /** Where the data was extracted from */
  extraction_source: ExtractionSource;
  /** The email of the person who forwarded the message (if detected) */
  forwarder_email: string;
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
  { field: "phone", keywords: ["telefon:", "tel:", "phone:", "tel.:", "fon:"] },
  { field: "mobile", keywords: ["mobil:", "mobile:", "handy:"] },
  { field: "address", keywords: ["adresse:", "straße:", "address:", "anschrift:"] },
  { field: "website", keywords: ["website:", "web:", "url:", "homepage:"] },
  { field: "notes", keywords: ["notiz:", "notizen:", "anmerkung:", "notes:", "bemerkung:", "kommentar:"] },
  { field: "suggested_pipeline", keywords: ["pipeline:"] },
  { field: "suggested_stage", keywords: ["stage:", "phase:", "stufe:"] },
];

/** Patterns that indicate the start of a signature or forwarded-message block */
const SIGNATURE_SEPARATORS = [
  /^--\s*$/,                              // -- alone
  /^_{3,}\s*$/,                           // ___ underscores
  /^-{3,}\s*$/,                           // --- dashes
  /^mit freundlichen grüßen/i,
  /^mit besten grüßen/i,
  /^freundliche grüße/i,
  /^beste grüße/i,
  /^best regards/i,
  /^kind regards/i,
  /^regards,?\s*$/i,
  /^viele grüße/i,
  /^liebe grüße/i,
  /^herzliche grüße/i,
  /^mfg\s*$/i,
  /^gesendet von[: ]/i,
  /^sent from[: ]/i,
  /^von:\s+/i,
  /^from:\s+/i,
];

/** Patterns that indicate a forwarded message header */
const FORWARD_HEADER_PATTERNS = [
  /weitergeleitete nachricht/i,
  /forwarded message/i,
  /original message/i,
  /ursprüngliche nachricht/i,
];

/** Company suffixes to detect company lines */
const COMPANY_SUFFIXES = /\b(gmbh|ag|kg|kgaa|se|gbr|e\.?\s*v\.?|ohg|ug|ltd\.?|inc\.?|corp\.?|co\.?\s*kg|gmbh\s*&\s*co|mbh|stiftung|verein|verband|genossenschaft)\b/i;

/** Job title keywords */
const JOB_TITLE_KEYWORDS = /\b(geschäftsführer|geschäftsführerin|ceo|cto|cfo|coo|cmo|managing\s*director|director|vorstand|vorsitzender|vorsitzende|leiter|leiterin|manager|managerin|head\s+of|vp|vice\s*president|partner|inhaber|inhaberin|prokurist|prokuristin|referent|referentin|sachbearbeiter|sachbearbeiterin|assistent|assistentin|sekretär|sekretärin|berater|beraterin|consultant|koordinator|koordinatorin|projektleiter|projektleiterin|abteilungsleiter|abteilungsleiterin|präsident|präsidentin|schatzmeister|schatzmeisterin|kurator|kuratorin|stifter|stifterin)\b/i;

/** Email pattern */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

/** Phone pattern */
const PHONE_RE = /(?:\+\d{1,3}[\s\-]?|0\d{1,4}[\s\-]?)[\d\s\-/().]{5,}/;

/** URL pattern (not social) */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/i;

/** Social URL patterns to exclude */
const SOCIAL_URL_RE = /(?:linkedin\.com|xing\.com|twitter\.com|x\.com|facebook\.com|instagram\.com)/i;

/** Street + house number pattern (German/Austrian) */
const STREET_RE = /[A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|gasse|allee|platz|ring|damm|ufer|chaussee|promenade|steig|stieg|berg|feld|hof|grund|park|anger|markt)\s+\d+[a-zA-Z]?/i;

/** PLZ + City pattern (German/Austrian/Swiss — with optional country prefix like A-, D-, CH-) */
const PLZ_CITY_RE = /\b(?:[A-Z]{1,2}[\-\s])?\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)*\b/;

/**
 * Strip HTML tags and decode basic entities to get plain text.
 */
function stripHtml(html: string): string {
  return html
    // Remove style/script blocks
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Replace <br>, <p>, <div>, <tr> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<(?:p|div|tr|li|h[1-6])[^>]*>/gi, "")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/gi, "Ä")
    .replace(/&Ouml;/gi, "Ö")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&szlig;/gi, "ß")
    // Collapse multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SignatureBlock {
  startIndex: number;
  lines: string[];
}

/**
 * Find all signature-like blocks in the text.
 * Returns them in order of appearance (last = deepest/original).
 */
function findSignatureBlocks(lines: string[]): SignatureBlock[] {
  const blocks: SignatureBlock[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    
    const isSeparator = SIGNATURE_SEPARATORS.some((re) => re.test(trimmed));
    if (isSeparator) {
      // Collect lines after the separator until the next separator or end
      const blockLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        // Stop if we hit another major separator (forwarded message header)
        if (FORWARD_HEADER_PATTERNS.some((re) => re.test(line))) break;
        // Stop if we hit another greeting separator (new sig block)
        if (SIGNATURE_SEPARATORS.some((re) => re.test(line)) && blockLines.length > 2) break;
        blockLines.push(line);
      }
      if (blockLines.filter((l) => l.length > 0).length >= 1) {
        blocks.push({ startIndex: i, lines: blockLines });
      }
    }
  }
  
  return blocks;
}

interface ExtractedSignatureData {
  full_name: string;
  job_title: string;
  company_name: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
}

/**
 * Extract structured data from a signature block's lines.
 */
function extractFromSignatureBlock(blockLines: string[], forwarderEmail?: string): ExtractedSignatureData {
  const result: ExtractedSignatureData = {
    full_name: "",
    job_title: "",
    company_name: "",
    email: "",
    phone: "",
    mobile: "",
    website: "",
    address: "",
  };
  
  const nonEmptyLines = blockLines.filter((l) => l.length > 0);
  let phoneCount = 0;
  const addressParts: string[] = [];
  
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    const lower = line.toLowerCase();
    
    // Skip very short or decorative lines
    if (line.length <= 1 || /^[|/\-=_*]+$/.test(line)) continue;
    
    // Email extraction
    if (!result.email) {
      const emailMatch = line.match(EMAIL_RE);
      if (emailMatch) {
        const foundEmail = emailMatch[0];
        // Skip if this is the forwarder's email
        if (!forwarderEmail || foundEmail.toLowerCase() !== forwarderEmail.toLowerCase()) {
          result.email = foundEmail;
        }
        // If this line is JUST an email, continue
        if (line.trim() === foundEmail) continue;
      }
    } else {
      // Check for additional emails (skip forwarder)
      const emailMatch = line.match(EMAIL_RE);
      if (emailMatch && forwarderEmail && emailMatch[0].toLowerCase() === forwarderEmail.toLowerCase()) {
        continue; // skip forwarder email lines
      }
    }
    
    // Phone extraction (with keyword prefixes)
    if (phoneCount < 2) {
      const hasPhoneKeyword = /(?:tel(?:efon)?|fon|phone|mob(?:il)?\.?|mobile|handy)[.:]\s*/i.test(line);
      const phoneMatch = line.match(PHONE_RE);
      if (hasPhoneKeyword && phoneMatch) {
        if (phoneCount === 0 && /(?:mob(?:il)?\.?|mobile|handy)/i.test(line)) {
          result.mobile = phoneMatch[0].trim();
        } else if (phoneCount === 0) {
          result.phone = phoneMatch[0].trim();
        } else {
          result.mobile = phoneMatch[0].trim();
        }
        phoneCount++;
        continue;
      }
      // Phone without keyword prefix (starts with + or contains phone-like pattern)
      if (phoneMatch && /^[\s]*[+0(]/.test(line) && !EMAIL_RE.test(line)) {
        if (phoneCount === 0) {
          result.phone = phoneMatch[0].trim();
        } else {
          result.mobile = phoneMatch[0].trim();
        }
        phoneCount++;
        continue;
      }
    }
    
    // Website extraction
    if (!result.website) {
      const urlMatch = line.match(URL_RE);
      if (urlMatch && !SOCIAL_URL_RE.test(urlMatch[0])) {
        result.website = urlMatch[0].replace(/[.,;)]+$/, "");
        // If the line is just the URL, continue
        if (line.trim() === result.website || line.replace(/^(?:web(?:site)?|url|homepage)[.:]\s*/i, "").trim() === result.website) continue;
      }
    }
    
    // Company detection (by suffix)
    if (!result.company_name && COMPANY_SUFFIXES.test(line)) {
      // Check if the line ALSO contains a job title keyword (e.g. "Vorsitzender der ... Stiftung")
      if (JOB_TITLE_KEYWORDS.test(line)) {
        // Extract company name from the line — look for the company suffix and grab surrounding words
        const companyMatch = line.match(/(?:[A-ZÄÖÜa-zäöüß.\-]+\s+)*[A-ZÄÖÜa-zäöüß.\-]*(?:gmbh|ag|kg|kgaa|se|gbr|e\.?\s*v\.?|ohg|ug|ltd\.?|inc\.?|corp\.?|co\.?\s*kg|gmbh\s*&\s*co|mbh|stiftung|verein|verband|genossenschaft)\b/i);
        if (companyMatch) {
          // Try to find a cleaner company name: from "der/des" or capitalized word before suffix
          const fullMatch = companyMatch[0].trim();
          // Look for patterns like "der XYZ Stiftung" or "des XYZ Vereins"
          const derMatch = line.match(/(?:der|des|die)\s+((?:[A-ZÄÖÜa-zäöüß.\-]+\s+)*[A-ZÄÖÜa-zäöüß.\-]*(?:gmbh|ag|kg|kgaa|se|gbr|e\.?\s*v\.?|ohg|ug|ltd\.?|inc\.?|corp\.?|stiftung|verein|verband|genossenschaft))\b/i);
          result.company_name = derMatch ? derMatch[1].trim() : fullMatch;
        }
        if (!result.job_title) {
          result.job_title = line.trim();
        }
        continue;
      }
      // Clean the line: remove pipe-separated parts that are job titles
      let companyLine = line;
      if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        const companyPart = parts.find((p) => COMPANY_SUFFIXES.test(p));
        if (companyPart) companyLine = companyPart;
      }
      result.company_name = companyLine.trim();
      continue;
    }
    
    // Address detection
    if (STREET_RE.test(line)) {
      addressParts.push(line.trim());
      continue;
    }
    if (PLZ_CITY_RE.test(line) && !COMPANY_SUFFIXES.test(line)) {
      addressParts.push(line.trim());
      continue;
    }
    // Combined street + PLZ in one line (e.g. "Musterstraße 1, 80333 München")
    if (STREET_RE.test(line) || (addressParts.length > 0 && PLZ_CITY_RE.test(line))) {
      addressParts.push(line.trim());
      continue;
    }
    
    // Job title detection
    if (!result.job_title && JOB_TITLE_KEYWORDS.test(line)) {
      // Handle "Name | Title" pattern
      if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        const titlePart = parts.find((p) => JOB_TITLE_KEYWORDS.test(p));
        if (titlePart) {
          result.job_title = titlePart;
          // The other part might be the name
          if (!result.full_name) {
            const namePart = parts.find((p) => p !== titlePart && !COMPANY_SUFFIXES.test(p) && !EMAIL_RE.test(p));
            if (namePart) result.full_name = namePart;
          }
          continue;
        }
      }
      result.job_title = line.trim();
      continue;
    }
    
    // Name detection: first meaningful non-keyword line
    if (!result.full_name && i < 3) {
      // Must look like a name: 2-4 words, capitalized, no special patterns
      const words = line.split(/[\s|/]+/).filter(Boolean);
      const looksLikeName = words.length >= 2 && words.length <= 5
        && /^[A-ZÄÖÜ]/.test(words[0])
        && !EMAIL_RE.test(line)
        && !PHONE_RE.test(line)
        && !URL_RE.test(line)
        && !COMPANY_SUFFIXES.test(line)
        && !/^(?:tel|fon|mob|fax|phone)/i.test(line);
      
      if (looksLikeName) {
        // Handle "Name | Title" or "Name | Company"
        if (line.includes("|")) {
          const parts = line.split("|").map((p) => p.trim());
          result.full_name = parts[0];
          if (parts[1] && !result.job_title && JOB_TITLE_KEYWORDS.test(parts[1])) {
            result.job_title = parts[1];
          }
        } else {
          result.full_name = line.trim();
        }
        continue;
      }
    }
  }
  
  // Combine address parts
  if (addressParts.length > 0) {
    result.address = addressParts.join(", ");
  }
  
  return result;
}

/**
 * Parse an email body string and extract structured fields.
 * 
 * Strategy:
 * 1. Try signature block extraction (for forwarded emails)
 * 2. Fall back to keyword-based line matching
 * 
 * @param body - Plain text email body
 * @param bodyHtml - Optional HTML body (will be stripped to text if body is empty)
 * @param forwarderEmail - Email of the person who forwarded (to exclude from contact data)
 */
export function parseEmailBody(
  body: string,
  bodyHtml?: string,
  forwarderEmail?: string,
): IntakeParsedData {
  const result: IntakeParsedData = {
    company_name: "",
    full_name: "",
    job_title: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    website: "",
    notes: "",
    suggested_pipeline: "",
    suggested_stage: "",
    extraction_source: "manual",
    forwarder_email: forwarderEmail ?? "",
  };

  // Determine the text to parse
  let text = body?.trim() ?? "";
  if (!text && bodyHtml) {
    text = stripHtml(bodyHtml);
  }
  if (!text) return result;

  const lines = text.split(/\r?\n/);

  // ── Step 1: Try keyword-based extraction first ──
  const keywordResult = parseByKeywords(lines);
  const keywordFieldCount = countFilledFields(keywordResult);

  // ── Step 2: Try signature-based extraction ──
  const sigBlocks = findSignatureBlocks(lines);
  let bestSigResult: ExtractedSignatureData | null = null;
  let bestSigScore = 0;

  // Prefer the LAST (deepest) signature block with the most data
  for (let i = sigBlocks.length - 1; i >= 0; i--) {
    const extracted = extractFromSignatureBlock(sigBlocks[i].lines, forwarderEmail);
    const score = scoreExtraction(extracted);
    if (score > bestSigScore) {
      bestSigScore = score;
      bestSigResult = extracted;
    }
  }

  // ── Step 3: Decide which source to use ──
  if (bestSigResult && bestSigScore >= 2) {
    // Signature extraction has useful data
    result.full_name = bestSigResult.full_name;
    result.job_title = bestSigResult.job_title;
    result.company_name = bestSigResult.company_name;
    result.email = bestSigResult.email;
    result.phone = bestSigResult.phone;
    result.mobile = bestSigResult.mobile;
    result.website = bestSigResult.website;
    result.address = bestSigResult.address;
    result.extraction_source = "signature";
    
    // Merge any keyword data that signature didn't find
    if (!result.company_name && keywordResult.company_name) result.company_name = keywordResult.company_name;
    if (!result.full_name && keywordResult.full_name) result.full_name = keywordResult.full_name;
    if (!result.job_title && keywordResult.job_title) result.job_title = keywordResult.job_title;
    if (!result.email && keywordResult.email) result.email = keywordResult.email;
    if (!result.phone && keywordResult.phone) result.phone = keywordResult.phone;
    if (!result.website && keywordResult.website) result.website = keywordResult.website;
    if (!result.address && keywordResult.address) result.address = keywordResult.address;
    result.notes = keywordResult.notes;
    result.suggested_pipeline = keywordResult.suggested_pipeline;
    result.suggested_stage = keywordResult.suggested_stage;
  } else if (keywordFieldCount > 0) {
    // Fall back to keyword extraction
    result.company_name = keywordResult.company_name;
    result.full_name = keywordResult.full_name;
    result.job_title = keywordResult.job_title;
    result.email = keywordResult.email;
    result.phone = keywordResult.phone;
    result.address = keywordResult.address;
    result.website = keywordResult.website;
    result.notes = keywordResult.notes;
    result.suggested_pipeline = keywordResult.suggested_pipeline;
    result.suggested_stage = keywordResult.suggested_stage;
    result.extraction_source = "keyword";
  }
  // else: extraction_source stays "manual"

  // Filter out forwarder email if it slipped through
  if (forwarderEmail && result.email.toLowerCase() === forwarderEmail.toLowerCase()) {
    result.email = "";
  }

  return result;
}

/** Count how many key fields have values */
function countFilledFields(data: { company_name: string; full_name: string; email: string; phone: string }): number {
  let count = 0;
  if (data.company_name) count++;
  if (data.full_name) count++;
  if (data.email) count++;
  if (data.phone) count++;
  return count;
}

/** Score how good a signature extraction is (higher = better) */
function scoreExtraction(data: ExtractedSignatureData): number {
  let score = 0;
  if (data.full_name) score += 2;
  if (data.email) score += 2;
  if (data.company_name) score += 1;
  if (data.phone) score += 1;
  if (data.job_title) score += 1;
  if (data.website) score += 1;
  if (data.address) score += 1;
  return score;
}

/** Original keyword-based parsing */
function parseByKeywords(lines: string[]) {
  const result = {
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;
    const lower = trimmed.toLowerCase();

    for (const group of KEYWORD_MAP) {
      if (group.field === "mobile" || group.field === "extraction_source" || group.field === "forwarder_email") continue;
      for (const keyword of group.keywords) {
        if (lower.startsWith(keyword)) {
          const value = trimmed.substring(keyword.length).trim();
          const cleaned = value.replace(/^\[(.+)\]$/, "$1").trim();
          const field = group.field as keyof typeof result;
          if (cleaned && field in result && !result[field]) {
            result[field] = cleaned;
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
