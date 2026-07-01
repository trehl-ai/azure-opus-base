import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Reine Darstellung: statische Mock-Daten, keine Supabase-Calls, keine echten Workflows.
type Step = { title: string; subtitle: string };
type SegmentKey = "bestandskunden" | "neukunden" | "partner";

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "bestandskunden", label: "Bestandskunden" },
  { key: "neukunden", label: "Neukunden" },
  { key: "partner", label: "Partner" },
];

const FLOWS: Record<SegmentKey, Step[]> = {
  bestandskunden: [
    { title: "Geburtstagswunsch telefonisch", subtitle: "Persönlicher Anruf zum Geburtstag der Kontaktperson" },
    { title: "Weihnachtskarte", subtitle: "Physische Grußkarte zum Jahresende" },
    { title: "Einladung PLSC Camp / Roadshow-Erlebnistag", subtitle: "Einladung zum Erlebnistag als Beziehungspflege" },
    { title: "Newsletter (Cases / Wirkungsnachweise)", subtitle: "Regelmäßige Cases und Wirkungsnachweise per Mail" },
    { title: "Jahresgespräch / Quartals-Check-in", subtitle: "Strukturierter Check-in zu Zielen und Bedarf" },
    { title: "Upsell nächste Staffel / neues Testimonial", subtitle: "Angebot der nächsten Staffel oder neues Testimonial" },
    { title: "Referral-Ask", subtitle: "Aktive Bitte um Weiterempfehlung" },
  ],
  neukunden: [
    { title: "LinkedIn-Connect", subtitle: "Vernetzung mit dem Entscheider auf LinkedIn" },
    { title: "Deep Research / Dossier", subtitle: "Recherche und Dossier zum Ziel-Account" },
    { title: "Pitch-Matching (Format × Testimonial × Ticket)", subtitle: "Passendes Format, Testimonial und Ticket zuordnen" },
    { title: "Erstgespräch 20 Min → Angebot 48 h", subtitle: "Kurzgespräch, Angebot binnen 48 Stunden" },
    { title: "Nachfassen 7 Tage", subtitle: "Follow-up nach einer Woche" },
    { title: "Camp / Roadshow-Einladung als Closer", subtitle: "Einladung zum Erlebnistag als Abschluss-Trigger" },
  ],
  partner: [
    { title: "Testimonial-Pflege (Lahm / Rebensburg)", subtitle: "Bestehende Testimonials aktuell halten" },
    { title: "Joint-Pitch eo ipso × spiel & sport team", subtitle: "Gemeinsamer Pitch mit dem Partner" },
    { title: "Stiftungs-Kooperation (VR)", subtitle: "Kooperation mit VR-Stiftungen abstimmen" },
    { title: "Roadshow-Logistik-Sync", subtitle: "Logistik der Roadshow gemeinsam planen" },
    { title: "Partner-Quartals-Sync / Co-Newsletter", subtitle: "Quartals-Sync und gemeinsamer Newsletter" },
  ],
};

export default function Leadflows() {
  const [segment, setSegment] = useState<SegmentKey>("bestandskunden");
  const steps = FLOWS[segment];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground">Leadflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kundenlebenszyklus je Segment — Darstellung, Workflows folgen.
          </p>
        </div>

        {/* Segment-Umschalter */}
        <div className="flex rounded-lg border border-border overflow-hidden self-start shrink-0">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              type="button"
              onClick={() => setSegment(seg.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors min-h-[44px]",
                segment === seg.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              )}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vertikale Schritt-Kette (Stepper) */}
      <div className="space-y-3 max-w-3xl">
        {steps.map((step, i) => (
          <div key={`${segment}-${i}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            <Card className="rounded-2xl flex-1 mb-1">
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.subtitle}</p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-transparent bg-slate-100 text-slate-500"
                >
                  Workflow folgt
                </Badge>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4 max-w-3xl">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Diese Ansicht zeigt die geplanten Lead-Journeys je Segment. Die einzelnen Schritte sind noch nicht als
          automatische Workflows hinterlegt — reine Darstellung.
        </p>
      </div>
    </div>
  );
}
