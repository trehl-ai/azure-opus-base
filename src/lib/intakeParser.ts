/**
 * Rule-based email body parser for intake messages.
 * Supports structured keyword parsing AND signature block extraction
 * from forwarded emails. No AI, no external API — pure regex/string matching.
 */

export type ExtractionSource = "forwarded" | "signature" | "keyword" | "manual";

export interface IntakeParsedData {
  company_name: string;
  full_name: string;
  first_name: string;
  last_name: string;
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

/** Patterns that indicate the start of a forwarded message block */
const FORWARD_HEADER_PATTERNS = [
  /^-{5,}\s*forwarded\s*message\s*-{5,}/i,
  /^-{5,}\s*weitergeleitete\s*nachricht\s*-{4,}/i,
  /^begin forwarded message/i,
  /weitergeleitete nachricht/i,
  /forwarded message/i,
  /original message/i,
  /ursprüngliche nachricht/i,
];

/** Greeting patterns that indicate start of signature */
const GREETING_PATTERNS = [
  /^mit freundlichen grüßen/i,
  /^mit besten grüßen/i,
  /^freundliche grüße/i,
  /^beste grüße/i,
  /^best regards/i,
  /^kind regards/i,
  /^regards,?\s*$/i,
  /^viele grüße/i,
  /^liebe grüße/i,
  /^lieben gruß/i,
  /^herzliche grüße/i,
  /^mfg\s*$/i,
];

/** Signature separator patterns */
const SIGNATURE_SEPARATORS = [
  /^--\s*$/,
  /^_{3,}\s*$/,
  /^-{3,}\s*$/,
  ...GREETING_PATTERNS,
  /^gesendet von[: ]/i,
  /^sent from[: ]/i,
];

/** Company suffixes to detect company lines */
const COMPANY_SUFFIXES = /\b(gmbh|ag|kg|kgaa|se|gbr|e\.?\s*v\.?|ohg|ug|ltd\.?|inc\.?|corp\.?|co\.?\s*kg|gmbh\s*&\s*co|mbh|stiftung|verein|verband|genossenschaft|group)\b/i;

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

/** PLZ + City pattern */
const PLZ_CITY_RE = /\b(?:[A-Z]{1,2}[\-\s])?\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)*\b/;

/**
 * Strip HTML tags and decode basic entities to get plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<(?:p|div|tr|li|h[1-6])[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Forwarded Message Extraction ──

interface ForwardedInfo {
  name: string;
  email: string;
  /** Lines after the forwarded header block (the original message body) */
  bodyLines: string[];
}

/**
 * Parse a forwarded message block to extract sender name + email from the "Von:" line.
 */
function extractForwardedInfo(lines: string[]): ForwardedInfo | null {
  let headerStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (FORWARD_HEADER_PATTERNS.some((re) => re.test(trimmed))) {
      headerStart = i;
      break;
    }
  }

  if (headerStart === -1) return null;

  let name = "";
  let email = "";

  // Scan lines after the header marker for "Von:" / "From:" line
  for (let i = headerStart + 1; i < Math.min(headerStart + 10, lines.length); i++) {
    const trimmed = lines[i].trim();
    const vonMatch = trimmed.match(/^(?:Von|From)\s*:\s*(.+)/i);
    if (vonMatch) {
      const vonLine = vonMatch[1];
      // Pattern: "Name <email>" or just "email"
      const angleMatch = vonLine.match(/^(.+?)\s*<([^>]+)>/);
      if (angleMatch) {
        name = angleMatch[1].replace(/^["']|["']$/g, "").trim();
        email = angleMatch[2].trim();
      } else {
        const emailMatch = vonLine.match(EMAIL_RE);
        if (emailMatch) {
          email = emailMatch[0];
          name = vonLine.replace(email, "").replace(/[<>]/g, "").trim();
        }
      }
      break;
    }
  }

  // Find where the actual body starts (after the header block, usually after an empty line)
  let bodyStart = headerStart + 1;
  for (let i = headerStart + 1; i < Math.min(headerStart + 15, lines.length); i++) {
    const trimmed = lines[i].trim();
    // Skip header lines (Von:, Date:, Subject:, To:, etc.)
    if (/^(?:Von|From|Date|Datum|Subject|Betreff|To|An|Cc|Bcc)\s*:/i.test(trimmed)) {
      bodyStart = i + 1;
      continue;
    }
    // Skip empty lines right after headers
    if (!trimmed && i === bodyStart) {
      bodyStart = i + 1;
      continue;
    }
    // Non-header, non-empty line → body starts here
    if (trimmed && !/^-{3,}/.test(trimmed)) {
      bodyStart = i;
      break;
    }
  }

  return {
    name,
    email,
    bodyLines: lines.slice(bodyStart),
  };
}

/**
 * Derive a company name suggestion from an email domain.
 * E.g. "stefan@mavigroup.de" → "Mavigroup"
 */
function companyFromDomain(email: string): string {
  if (!email) return "";
  const domain = email.split("@")[1];
  if (!domain) return "";
  const base = domain.split(".")[0];
  // Skip generic providers
  const generic = ["gmail", "yahoo", "outlook", "hotmail", "gmx", "web", "t-online", "aol", "icloud", "posteo", "mailbox", "protonmail", "proton"];
  if (generic.includes(base.toLowerCase())) return "";
  // Capitalize first letter
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Signature Block Extraction ──

interface SignatureBlock {
  startIndex: number;
  lines: string[];
}

function findSignatureBlocks(lines: string[]): SignatureBlock[] {
  const blocks: SignatureBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const isSeparator = SIGNATURE_SEPARATORS.some((re) => re.test(trimmed));
    if (isSeparator) {
      const blockLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (FORWARD_HEADER_PATTERNS.some((re) => re.test(line))) break;
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

    if (line.length <= 1 || /^[|/\-=_*]+$/.test(line)) continue;

    // Email extraction
    if (!result.email) {
      const emailMatch = line.match(EMAIL_RE);
      if (emailMatch) {
        const foundEmail = emailMatch[0];
        if (!forwarderEmail || foundEmail.toLowerCase() !== forwarderEmail.toLowerCase()) {
          result.email = foundEmail;
        }
        if (line.trim() === foundEmail) continue;
      }
    } else {
      const emailMatch = line.match(EMAIL_RE);
      if (emailMatch && forwarderEmail && emailMatch[0].toLowerCase() === forwarderEmail.toLowerCase()) {
        continue;
      }
    }

    // Phone extraction
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
        if (line.trim() === result.website || line.replace(/^(?:web(?:site)?|url|homepage)[.:]\s*/i, "").trim() === result.website) continue;
      }
    }

    // Company detection
    if (!result.company_name && COMPANY_SUFFIXES.test(line)) {
      if (JOB_TITLE_KEYWORDS.test(line)) {
        const suffixPattern = /(?:gmbh|ag|kg|kgaa|se|gbr|e\.?\s*v\.?|ohg|ug|ltd\.?|inc\.?|corp\.?|co\.?\s*kg|gmbh\s*&\s*co|mbh|stiftung|verein|verband|genossenschaft|group)\b/i;
        const suffixMatch = line.match(suffixPattern);
        if (suffixMatch && suffixMatch.index !== undefined) {
          const endPos = suffixMatch.index + suffixMatch[0].length;
          const beforeSuffix = line.substring(0, endPos);
          const articleMatches = [...beforeSuffix.matchAll(/\b(?:der|des|die)\s+/gi)];
          if (articleMatches.length > 0) {
            const lastArticle = articleMatches[articleMatches.length - 1];
            const afterArticle = beforeSuffix.substring(lastArticle.index! + lastArticle[0].length);
            const cleaned = afterArticle.replace(/^[a-zäöüß]+\s+/g, "");
            result.company_name = cleaned.trim();
          }
        }
        if (!result.job_title) {
          result.job_title = line.trim();
        }
        continue;
      }
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
    if (STREET_RE.test(line) || (addressParts.length > 0 && PLZ_CITY_RE.test(line))) {
      addressParts.push(line.trim());
      continue;
    }

    // Job title detection
    if (!result.job_title && JOB_TITLE_KEYWORDS.test(line)) {
      if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        const titlePart = parts.find((p) => JOB_TITLE_KEYWORDS.test(p));
        if (titlePart) {
          result.job_title = titlePart;
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

    // Name detection: first meaningful non-keyword line in first 3 lines
    if (!result.full_name && i < 3) {
      const words = line.split(/[\s|/]+/).filter(Boolean);
      const looksLikeName = words.length >= 2 && words.length <= 5
        && /^[A-ZÄÖÜ]/.test(words[0])
        && !EMAIL_RE.test(line)
        && !PHONE_RE.test(line)
        && !URL_RE.test(line)
        && !COMPANY_SUFFIXES.test(line)
        && !/^(?:tel|fon|mob|fax|phone)/i.test(line);

      if (looksLikeName) {
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

  if (addressParts.length > 0) {
    result.address = addressParts.join(", ");
  }

  return result;
}

/** Score how good a signature extraction is */
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

/** Count how many key fields have values */
function countFilledFields(data: { company_name: string; full_name: string; email: string; phone: string }): number {
  let count = 0;
  if (data.company_name) count++;
  if (data.full_name) count++;
  if (data.email) count++;
  if (data.phone) count++;
  return count;
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
      if (group.field === "mobile" || group.field === "extraction_source" || group.field === "forwarder_email" || group.field === "first_name" || group.field === "last_name") continue;
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
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName.trim()) return { firstName: "", lastName: "" };

  // Handle "Nachname, Vorname"
  if (fullName.includes(",")) {
    const parts = fullName.split(",").map((p) => p.trim());
    return { firstName: parts[1] || "", lastName: parts[0] || "" };
  }

  // Handle academic titles
  const cleaned = fullName.replace(/^(?:Prof\.\s*|Dr\.\s*|Dipl\.\s*[-\w]*\s*)+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];
  return { firstName, lastName };
}

/**
 * Clean a subject line by removing forwarding/reply prefixes.
 */
export function cleanSubject(subject: string | null): string {
  if (!subject) return "";
  return subject.replace(/^(Fwd?|Fw|WG|AW|Re|Aw|RE):\s*/gi, "").trim();
}

/**
 * Parse an email body string and extract structured fields.
 *
 * Strategy:
 * 1. Detect forwarded message → extract Von: line for contact data
 * 2. Search for signature block after greeting
 * 3. Fall back to keyword-based line matching
 * 4. Derive company from email domain as fallback
 */
export function parseEmailBody(
  body: string,
  bodyHtml?: string,
  forwarderEmail?: string,
): IntakeParsedData {
  const result: IntakeParsedData = {
    company_name: "",
    full_name: "",
    first_name: "",
    last_name: "",
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

  // ── Step 1: Try forwarded message extraction ──
  const forwarded = extractForwardedInfo(lines);
  let sigSearchLines = forwarded ? forwarded.bodyLines : lines;

  if (forwarded && forwarded.email) {
    result.email = forwarded.email;
    result.forwarder_email = forwarderEmail ?? "";
    if (forwarded.name) {
      result.full_name = forwarded.name;
      const { firstName, lastName } = splitFullName(forwarded.name);
      result.first_name = firstName;
      result.last_name = lastName;
    }
    result.extraction_source = "forwarded";

    // Derive company from domain
    const domainCompany = companyFromDomain(forwarded.email);
    if (domainCompany) {
      result.company_name = domainCompany;
    }
  }

  // ── Step 2: Try signature extraction from the body (or forwarded body) ──
  const sigBlocks = findSignatureBlocks(sigSearchLines);
  let bestSigResult: ExtractedSignatureData | null = null;
  let bestSigScore = 0;

  for (let i = sigBlocks.length - 1; i >= 0; i--) {
    const extracted = extractFromSignatureBlock(sigBlocks[i].lines, forwarderEmail);
    const score = scoreExtraction(extracted);
    if (score > bestSigScore) {
      bestSigScore = score;
      bestSigResult = extracted;
    }
  }

  if (bestSigResult && bestSigScore >= 2) {
    // Signature data overrides/enriches forwarded data
    if (bestSigResult.full_name) {
      result.full_name = bestSigResult.full_name;
      const { firstName, lastName } = splitFullName(bestSigResult.full_name);
      result.first_name = firstName;
      result.last_name = lastName;
    }
    if (bestSigResult.job_title) result.job_title = bestSigResult.job_title;
    if (bestSigResult.company_name) result.company_name = bestSigResult.company_name;
    if (bestSigResult.email && (!result.email || result.extraction_source === "forwarded")) {
      // Prefer signature email if it's different from forwarder
      if (!forwarderEmail || bestSigResult.email.toLowerCase() !== forwarderEmail.toLowerCase()) {
        result.email = bestSigResult.email;
      }
    }
    if (bestSigResult.phone) result.phone = bestSigResult.phone;
    if (bestSigResult.mobile) result.mobile = bestSigResult.mobile;
    if (bestSigResult.website) result.website = bestSigResult.website;
    if (bestSigResult.address) result.address = bestSigResult.address;

    if (result.extraction_source === "manual") {
      result.extraction_source = "signature";
    }
  }

  // ── Step 3: Try keyword-based extraction as additional source ──
  const keywordResult = parseByKeywords(lines);
  const keywordFieldCount = countFilledFields(keywordResult);

  if (keywordFieldCount > 0) {
    if (!result.company_name && keywordResult.company_name) result.company_name = keywordResult.company_name;
    if (!result.full_name && keywordResult.full_name) {
      result.full_name = keywordResult.full_name;
      const { firstName, lastName } = splitFullName(keywordResult.full_name);
      result.first_name = firstName;
      result.last_name = lastName;
    }
    if (!result.job_title && keywordResult.job_title) result.job_title = keywordResult.job_title;
    if (!result.email && keywordResult.email) result.email = keywordResult.email;
    if (!result.phone && keywordResult.phone) result.phone = keywordResult.phone;
    if (!result.website && keywordResult.website) result.website = keywordResult.website;
    if (!result.address && keywordResult.address) result.address = keywordResult.address;
    result.notes = keywordResult.notes || result.notes;
    result.suggested_pipeline = keywordResult.suggested_pipeline || result.suggested_pipeline;
    result.suggested_stage = keywordResult.suggested_stage || result.suggested_stage;

    if (result.extraction_source === "manual") {
      result.extraction_source = "keyword";
    }
  }

  // ── Step 4: Domain-based company fallback ──
  if (!result.company_name && result.email) {
    result.company_name = companyFromDomain(result.email);
  }

  // Ensure first/last name are set
  if (result.full_name && !result.first_name) {
    const { firstName, lastName } = splitFullName(result.full_name);
    result.first_name = firstName;
    result.last_name = lastName;
  }

  // Filter out forwarder email if it slipped through
  if (forwarderEmail && result.email.toLowerCase() === forwarderEmail.toLowerCase()) {
    result.email = "";
  }

  return result;
}
