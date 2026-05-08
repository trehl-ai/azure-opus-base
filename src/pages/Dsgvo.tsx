import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LegalDocument = {
  id: string;
  name: string;
  description: string | null;
  storage_path: string | null;
  version: string | null;
  status: string | null;
  signed_at: string | null;
  created_at: string | null;
};

type DataLocation = {
  icon: string;
  name: string;
  zweck: string;
  standort: string;
  badge: string;
  badgeColor: "gray" | "green" | "yellow";
};

const DATA_LOCATIONS: DataLocation[] = [
  {
    icon: "🌐",
    name: "Browser / Client",
    zweck: "App-Interface",
    standort: "Lokal beim Nutzer",
    badge: "Kein Transfer",
    badgeColor: "gray",
  },
  {
    icon: "☁️",
    name: "Vercel",
    zweck: "Statisches App-Hosting",
    standort: "USA",
    badge: "Nur HTML/JS/CSS",
    badgeColor: "gray",
  },
  {
    icon: "🗄️",
    name: "Supabase",
    zweck: "Datenbank, Auth, Storage",
    standort: "Frankfurt 🇩🇪",
    badge: "EU-Hosting",
    badgeColor: "green",
  },
  {
    icon: "⚙️",
    name: "n8n (Hetzner)",
    zweck: "Workflow-Automation",
    standort: "Nürnberg 🇩🇪",
    badge: "EU-Hosting",
    badgeColor: "green",
  },
  {
    icon: "🤖",
    name: "Gemini API",
    zweck: "KI-Scoring & Embeddings",
    standort: "EU-Region",
    badge: "SCCs",
    badgeColor: "yellow",
  },
  {
    icon: "📞",
    name: "CloudTalk",
    zweck: "Telefonie & Call-Logs",
    standort: "EU-Cloud 🇨🇿",
    badge: "SCCs",
    badgeColor: "yellow",
  },
  {
    icon: "📧",
    name: "Google Workspace",
    zweck: "E-Mail-Intake",
    standort: "EU-Region",
    badge: "SCCs",
    badgeColor: "yellow",
  },
];

const BADGE_TONES: Record<DataLocation["badgeColor"], string> = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
};

const DATA_FLOWS = [
  "E-Mail-Intake: sales@trehl-ai.com → n8n Nürnberg → Supabase Frankfurt",
  "Telefonie: CloudTalk → Webhook → n8n Nürnberg → Supabase Frankfurt",
  "KI-Scoring: Kontaktdaten → Gemini API (EU, SCCs) → Score in Supabase Frankfurt",
];

const PROCESSING_ROWS: Array<{
  kategorie: string;
  felder: string;
  rechtsgrundlage: string;
  speicherort: string;
  loeschfrist: string;
}> = [
  {
    kategorie: "Stammdaten",
    felder: "Name, Jobtitel, Unternehmen",
    rechtsgrundlage: "Art. 6 I lit. f",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "Mit Vertragsende",
  },
  {
    kategorie: "Kontaktdaten",
    felder: "E-Mail, Telefon, Adresse",
    rechtsgrundlage: "Art. 6 I lit. b/f",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "Mit Vertragsende",
  },
  {
    kategorie: "Kommunikation",
    felder: "E-Mail-Inhalte, Anruf-Logs",
    rechtsgrundlage: "Art. 6 I lit. b",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "2 Jahre",
  },
  {
    kategorie: "CRM-Daten",
    felder: "Deals, Pipeline, Aktivitäten",
    rechtsgrundlage: "Art. 6 I lit. b",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "Mit Vertragsende",
  },
  {
    kategorie: "KI-Daten",
    felder: "Embeddings (Vektoren)",
    rechtsgrundlage: "Art. 6 I lit. f",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "Mit Vertragsende",
  },
  {
    kategorie: "Technische Daten",
    felder: "IP (Auth-Log), Timestamps",
    rechtsgrundlage: "Art. 6 I lit. f",
    speicherort: "Supabase Frankfurt",
    loeschfrist: "90 Tage",
  },
];

const SUBPROCESSORS: Array<{
  anbieter: string;
  zweck: string;
  standort: string;
  rechtsgrundlage: string;
}> = [
  {
    anbieter: "Supabase Inc.",
    zweck: "Datenbank, Auth, Edge Functions",
    standort: "Frankfurt, Deutschland 🇩🇪",
    rechtsgrundlage: "EU-Standardvertragsklauseln",
  },
  {
    anbieter: "Hetzner Online GmbH",
    zweck: "n8n Workflow-Server (VPS)",
    standort: "Nürnberg, Deutschland 🇩🇪",
    rechtsgrundlage: "EU-Hosting (kein Drittlandtransfer)",
  },
  {
    anbieter: "CloudTalk a.s.",
    zweck: "Telefonie, Gesprächsprotokolle",
    standort: "EU-Cloud (Tschechien) 🇨🇿",
    rechtsgrundlage: "EU-Standardvertragsklauseln",
  },
  {
    anbieter: "Google LLC",
    zweck: "Gemini KI-API, Google Workspace E-Mail",
    standort: "EU-Region",
    rechtsgrundlage: "Google Cloud DPA / SCCs",
  },
  {
    anbieter: "Microsoft Corporation",
    zweck: "Outlook E-Mail via Graph API",
    standort: "EU-Region",
    rechtsgrundlage: "Microsoft EU DPA / SCCs",
  },
];

const TOM_TILES: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "🔐",
    title: "Verschlüsselung",
    body: "TLS 1.2+ in transit · AES-256 at rest (Supabase)",
  },
  {
    icon: "👤",
    title: "Zugriffskontrolle",
    body: "Row-Level Security (RLS) · Rollenbasierter Zugriff · Service Keys nur in n8n Secrets",
  },
  {
    icon: "📋",
    title: "Audit-Log",
    body: "Vollständiges Änderungsprotokoll (audit_log) für alle kritischen Entitäten",
  },
  {
    icon: "🏠",
    title: "EU-Hosting",
    body: "Primäre Systeme ausschließlich in Deutschland (Frankfurt + Nürnberg)",
  },
  {
    icon: "⚡",
    title: "Incident Response",
    body: "Meldung an Verantwortlichen binnen 24 Stunden nach Kenntniserlangung",
  },
  {
    icon: "🔑",
    title: "Pseudonymisierung",
    body: "Nutzer-IDs (UUIDs) statt Klarnamen in Logs und Auth-Tokens",
  },
];

const RIGHTS_ROWS: Array<{
  icon: string;
  recht: string;
  umsetzung: string;
  frist: string;
}> = [
  {
    icon: "👁️",
    recht: "Auskunft (Art. 15)",
    umsetzung: "CSV/JSON-Export auf Anfrage",
    frist: "5 Werktage",
  },
  {
    icon: "✏️",
    recht: "Berichtigung (Art. 16)",
    umsetzung: "Direkt im CRM durch Verantwortlichen",
    frist: "Sofort",
  },
  {
    icon: "🗑️",
    recht: "Löschung (Art. 17)",
    umsetzung: "Vollständige Datenlöschung auf dokumentierte Weisung",
    frist: "5 Werktage",
  },
  {
    icon: "⏸️",
    recht: "Einschränkung (Art. 18)",
    umsetzung: "Technische Sperrung auf Weisung",
    frist: "Sofort",
  },
  {
    icon: "📦",
    recht: "Datenübertragbarkeit (Art. 20)",
    umsetzung: "CSV/JSON-Export jederzeit verfügbar",
    frist: "Sofort",
  },
  {
    icon: "📧",
    recht: "Kontakt",
    umsetzung: "w.berchtold@eo-ipso.com · schwirkmann@trehl-ai.com",
    frist: "—",
  },
];

export default function Dsgvo() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <DsgvoContent />;
}

function DsgvoContent() {
  const { data: documents, isLoading: docsLoading } = useQuery<LegalDocument[]>({
    queryKey: ["legal_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select(
          "id, name, description, storage_path, version, status, signed_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LegalDocument[];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Datenschutz & Compliance</h1>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
            Stand: Mai 2026
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          DSGVO-Dokumentation · eo ipso Boost CRM · EIC-001
        </p>
      </header>

      {/* SECTION 1 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Wo leben die Daten?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DATA_LOCATIONS.map((loc) => (
            <div
              key={loc.name}
              className="rounded-[12px] border border-border bg-card shadow-sm p-4 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-xl shrink-0" aria-hidden>
                  {loc.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{loc.name}</p>
                  <p className="text-sm text-gray-500">{loc.zweck}</p>
                </div>
              </div>
              <p className="text-sm text-foreground">{loc.standort}</p>
              <span
                className={cn(
                  "inline-flex items-center self-start text-xs px-2 py-0.5 rounded",
                  BADGE_TONES[loc.badgeColor],
                )}
              >
                {loc.badge}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {DATA_FLOWS.map((flow) => (
            <div
              key={flow}
              className="text-sm bg-gray-50 rounded p-3 text-foreground"
            >
              → {flow}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Was wird verarbeitet?</h2>
        <div className="rounded-[12px] border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead>Felder</TableHead>
                <TableHead>Rechtsgrundlage</TableHead>
                <TableHead>Speicherort</TableHead>
                <TableHead>Löschfrist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROCESSING_ROWS.map((r) => (
                <TableRow key={r.kategorie}>
                  <TableCell className="font-medium">{r.kategorie}</TableCell>
                  <TableCell>{r.felder}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.rechtsgrundlage}
                  </TableCell>
                  <TableCell>{r.speicherort}</TableCell>
                  <TableCell>{r.loeschfrist}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-gray-500 italic">
          Besondere Kategorien personenbezogener Daten gem. Art. 9 DSGVO werden
          nicht verarbeitet.
        </p>
      </section>

      {/* SECTION 3 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Subauftragsverarbeiter (§ 5 AVV)
        </h2>
        <div className="rounded-[12px] border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anbieter</TableHead>
                <TableHead>Zweck</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Rechtsgrundlage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SUBPROCESSORS.map((sp) => (
                <TableRow key={sp.anbieter}>
                  <TableCell className="font-medium">{sp.anbieter}</TableCell>
                  <TableCell>{sp.zweck}</TableCell>
                  <TableCell>{sp.standort}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sp.rechtsgrundlage}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Technische & Organisatorische Maßnahmen (Art. 32 DSGVO)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOM_TILES.map((t) => (
            <div
              key={t.title}
              className="rounded-[12px] border border-border bg-card shadow-sm p-4 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {t.icon}
                </span>
                <p className="font-semibold">{t.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Auftragsverarbeitungsvertrag (Art. 28 DSGVO)
        </h2>
        {docsLoading ? (
          <Skeleton className="h-32 rounded-[12px]" />
        ) : !documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Dokumente hinterlegt.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((doc) => (
              <LegalDocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 6 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Betroffenenrechte (Art. 15–22 DSGVO)
        </h2>
        <div className="rounded-[12px] border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" aria-label="Icon" />
                <TableHead>Recht</TableHead>
                <TableHead>Umsetzung</TableHead>
                <TableHead className="text-right">Frist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RIGHTS_ROWS.map((r) => (
                <TableRow key={r.recht}>
                  <TableCell aria-hidden className="text-xl">
                    {r.icon}
                  </TableCell>
                  <TableCell className="font-medium">{r.recht}</TableCell>
                  <TableCell>{r.umsetzung}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.frist}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function LegalDocumentCard({ doc }: { doc: LegalDocument }) {
  const [downloading, setDownloading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const status = doc.status ?? "pending";
  const statusBadge =
    status === "signed"
      ? { tone: "bg-green-100 text-green-800", label: "🟢 Unterzeichnet" }
      : { tone: "bg-yellow-100 text-yellow-800", label: "🟡 Gegenzeichnung ausstehend" };

  const versionParts = [doc.version, doc.created_at?.slice(0, 10)].filter(
    Boolean,
  );

  const handleDownload = async () => {
    if (!doc.storage_path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("legal-documents")
        .download(doc.storage_path);
      if (error || !data) {
        console.error("AVV download failed:", error);
        return;
      }
      const url = URL.createObjectURL(data);
      setObjectUrl(url);
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-border bg-card shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{doc.name}</p>
          {versionParts.length > 0 && (
            <p className="text-sm text-gray-500">{versionParts.join(" · ")}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center text-xs px-2 py-1 rounded shrink-0",
            statusBadge.tone,
          )}
        >
          {statusBadge.label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        eo ipso Marke & Erlebnis GmbH × Trehl AI
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={!doc.storage_path || downloading}
        onClick={handleDownload}
      >
        {doc.storage_path
          ? downloading
            ? "📄 Lade…"
            : "📄 AVV herunterladen"
          : "Datei wird nachgereicht"}
      </Button>
    </div>
  );
}
