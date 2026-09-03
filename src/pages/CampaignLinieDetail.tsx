import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditLinieSheet } from "@/components/campaigns/EditLinieSheet";
import { LinienAufgaben } from "@/components/campaigns/LinienAufgaben";
import { MailingListe } from "@/components/campaigns/MailingListe";
import { operativerPfad, useLinie, useZielgruppenregel, zahlF } from "@/components/campaigns/linienDaten";

const cardClass = "rounded-2xl border border-border bg-card p-6";

const PHASE_LABEL: Record<string, string> = {
  live: "Live",
  vorbereitung: "In Vorbereitung",
  backlog: "Backlog",
};

function Feld({ label, wert }: { label: string; wert: string | null }) {
  return (
    <div>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="text-body text-foreground">{wert ?? "–"}</p>
    </div>
  );
}

function Zahl({ label, wert }: { label: string; wert: number | null }) {
  return (
    <div>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="text-body text-foreground">{wert === null ? "–" : zahlF.format(wert)}</p>
    </div>
  );
}

export default function CampaignLinieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: linie, isLoading, error } = useLinie(id);
  const [bearbeiten, setBearbeiten] = useState(false);
  const { data: regel } = useZielgruppenregel(id);

  if (isLoading) {
    return <p className="p-6 text-label text-muted-foreground md:p-8">Wird geladen…</p>;
  }
  if (error) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-label text-foreground">Die Kampagne konnte nicht geladen werden.</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }
  if (!linie) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-label text-foreground">Diese Kampagne gibt es nicht.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const operativ = operativerPfad(linie);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Kampagnen
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">{linie.name}</h1>
          <Badge variant="secondary">{PHASE_LABEL[linie.phase] ?? linie.phase}</Badge>
          <div className="ml-auto flex items-center gap-2">
            {operativ && (
              <Button variant="outline" size="sm" asChild>
                <Link to={operativ} className="gap-1.5">
                  Versandsteuerung <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setBearbeiten(true)}>
              <Pencil className="h-3.5 w-3.5" /> Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* A) Stammdaten */}
      <div className={cardClass}>
        <h2 className="mb-4 text-body font-semibold text-foreground">Stammdaten</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Feld label="Verantwortlich" wert={linie.verantwortlich} />
          <Feld label="Zielgruppe" wert={linie.zielgruppe_text} />
          <Feld label="Ziel 2026" wert={linie.ziel_2026} />
          <Feld label="Ziel 2027" wert={linie.ziel_2027} />
          <div>
            <p className="text-label text-muted-foreground">Buchungslink</p>
            {linie.buchungslink ? (
              <a
                href={linie.buchungslink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-body text-primary hover:underline"
              >
                {linie.buchungslink} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-body text-foreground">–</p>
            )}
          </div>
          <Feld label="Notiz" wert={linie.notiz} />
        </div>

        {/* Die Zielgruppenregel ist ANZEIGE, nicht Eingabe: sie bestimmt die Zahlen
            aller Kacheln, eine beilaeufige Aenderung waere eine Auswertungsaenderung. */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-label text-muted-foreground">
            Zielgruppenregel — nur zur Ansicht, änderbar über die Datenbank
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3">
            <Feld label="Pipeline" wert={linie.pipeline_name} />
            <Feld label="Segmente" wert={regel?.segmente?.join(", ") ?? null} />
            <Feld label="Bundesland-Modus" wert={regel?.bundesland_modus ?? null} />
            <Feld label="Bundesländer" wert={regel?.bundeslaender?.join(", ") ?? null} />
          </div>
        </div>
      </div>

      {/* B) Mailings */}
      <div className={cardClass}>
        <MailingListe campaignId={linie.campaign_id} />
      </div>

      {/* C) Aufgaben */}
      <div className={cardClass}>
        <LinienAufgaben campaignId={linie.campaign_id} />
      </div>

      {/* D) Zahlen */}
      <div className={cardClass}>
        <h2 className="mb-4 text-body font-semibold text-foreground">Zahlen</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
          <Zahl label="Zielgruppe" wert={linie.zielgruppe} />
          <Zahl label="Angeschrieben" wert={linie.angeschrieben} />
          <Zahl label="Ausstehend" wert={linie.ausstehend} />
          <Zahl label="Nicht erreichbar" wert={linie.nicht_erreichbar} />
          <Zahl label="Antworten" wert={linie.antworten} />
          <Zahl label="Klicks" wert={linie.klicks} />
          <Zahl label="Bounces" wert={linie.bounces} />
          <Zahl label="Aufträge" wert={linie.auftraege} />
          <Zahl label="Auftragswert" wert={linie.auftraege_wert} />
          <Zahl label="Mailings gesamt" wert={linie.mailings_gesamt} />
          <Zahl label="Mailings versendet" wert={linie.mailings_versendet} />
          <Zahl label="Ohne Freigabe" wert={linie.mailings_ohne_freigabe} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4">
          <Feld label="Pipeline" wert={linie.pipeline_name} />
          <Feld label="Konzept" wert={linie.konzept_slug} />
          <Feld label="Themen" wert={linie.themen} />
        </div>
      </div>

      <EditLinieSheet linie={linie} open={bearbeiten} onOpenChange={setBearbeiten} />
    </div>
  );
}
