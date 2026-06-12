// Aufbereitung von E-Mail-Texten (eingehende Replies / IMAP-HTML) in lesbaren
// Plaintext. Geteilt zwischen EmailHistory (E-Mail-Tab) und DealDetail
// (Aktivitäten-Tab), damit beide identisch parsen.

// Roh-HTML aus IMAP in lesbaren Plaintext wandeln.
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, "\n")
    .trim();
}

// MIME-encoded-words (=?utf-8?Q?…?=) aus alten manuell geloggten Subjects
// in lesbaren Text dekodieren.
export function decodeQuotedPrintable(str: string): string {
  return str.replace(/=\?utf-8\?[QqBb]\?([^?]+)\?=/gi, (_, encoded) => {
    try {
      return decodeURIComponent(encoded.replace(/=/g, "%").replace(/_/g, " "));
    } catch {
      return encoded;
    }
  });
}

// Lesbaren Text aus der description einer eingehenden Reply extrahieren.
// Zwei Formate kommen vor:
//   (1) Workflow:  "Kategorie: <x>\n\n<html>…"      → HTML-Teil nach der Zeile
//   (2) manuell:   "Subject: =?utf-8?…?= — <Text>"  → Klartext nach " — "
export function extractReadableText(description: string): string {
  if (!description) return "";

  // Typ 1: Kategorie-Prefix + HTML-Body
  const kategorieMatch = description.match(/^Kategorie:\s*\S+\s*\n+([\s\S]*)/);
  if (kategorieMatch) {
    return stripHtml(kategorieMatch[1])
      .replace(/-----Ursprüngliche Nachricht-----[\s\S]*/i, "")
      .replace(/Von:.*[\s\S]*/m, "")
      .trim();
  }

  // Typ 2: MIME-encoded Subject + " — " + Klartext
  const subjectSplit = description.indexOf(" — ");
  if (subjectSplit > -1) {
    return decodeQuotedPrintable(description.substring(subjectSplit + 3))
      .replace(/-----Ursprüngliche Nachricht-----[\s\S]*/i, "")
      .trim();
  }

  // Fallback: normales stripHtml
  return stripHtml(description)
    .replace(/-----Ursprüngliche Nachricht-----[\s\S]*/i, "")
    .trim();
}
