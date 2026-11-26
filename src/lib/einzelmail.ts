/**
 * Bausteine fuer Einzelmails auf /aktionen: Signatur je Absender-Domain, Warnungen.
 * Die Signaturen entsprechen woertlich den bisher versendeten Einzelmails (gemessen 26.11.2026).
 */

export const ABMELDEZEILE = "Kein Interesse? Eine kurze Antwort genügt, dann schreiben wir Sie nicht wieder an.";

const SIGNATUR: Record<string, string> = {
  "werteraum-schule.de": [
    "Beste Grüße",
    "--",
    "Tomas Schwirkmann",
    "WerteRaum",
    "c/o eo ipso Marke & Erlebnis GmbH",
    "Talangerstr. 7, 82152 Krailling-München",
    "schwirkmann@werteraum-schule.de",
  ].join("\n"),
  "viktoria-roadshow.com": [
    "Mit freundlichen Grüßen",
    "Tomas Schwirkmann",
    "Viktoria Rebensburg Fit & Aktiv",
    "c/o eo ipso Marke & Erlebnis GmbH",
    "Talangerstr. 7, 82152 Krailling-München",
    "schwirkmann@viktoria-roadshow.com",
  ].join("\n"),
};

/** Vorbefuellter Mailtext: Anrede, Leerraum fuer den Inhalt, Signatur der Domain, Abmeldezeile.
 *  Unbekannte Domain -> keine Signatur (die DB laesst ohnehin nur die beiden Domains zu). */
export function mailtextVorlage(anrede: string | null, domain: string | null): string {
  const signatur = domain ? SIGNATUR[domain] : undefined;
  return [anrede ?? "", "", "", "", signatur ?? "", "", ABMELDEZEILE].join("\n");
}

/** Ersetzt die erste Zeile (Anrede), wenn sie noch die alte Anrede ist. Sonst unveraendert. */
export function anredeTauschen(text: string, alt: string | null, neu: string | null): string {
  if (!alt || !neu || alt === neu) return text;
  const [erste, ...rest] = text.split("\n");
  return erste === alt ? [neu, ...rest].join("\n") : text;
}

const FREEMAIL = /(^|\.)(gmx\.[a-z]+|web\.de|yahoo\.[a-z.]+|gmail\.com|googlemail\.com|t-online\.de|outlook\.[a-z.]+|hotmail\.[a-z.]+|icloud\.com)$/i;

/** Private Adresse (Freemail-Anbieter)? */
export function istFreemail(email: string | null | undefined): boolean {
  const domain = email?.split("@")[1]?.trim();
  return !!domain && FREEMAIL.test(domain);
}
