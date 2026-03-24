import { useState, useEffect } from "react";
import { useRoadshowDetails } from "@/hooks/queries/useRoadshowDetails";
import { usePermission } from "@/hooks/usePermission";
import { computeRoadshowEignung, eignungColors } from "@/lib/roadshowEignung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const cardClass = "rounded-2xl border border-border bg-card p-6";

interface Props {
  dealId: string;
}

const ENUM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  hort_ganztag: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
    { value: "angeschlossen", label: "Angeschlossen" },
  ],
  schueler_kl23: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
  ],
  ausweichen_turnhalle: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
    { value: "nur_klassenzimmer", label: "Nur Klassenzimmer" },
  ],
  platzbedarf: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
  ],
  untergrund: [
    { value: "tbd", label: "Noch offen" },
    { value: "hartplatz", label: "Hartplatz" },
    { value: "rasen_ok", label: "Rasen (OK)" },
    { value: "rasen_problematisch", label: "Rasen (problematisch)" },
    { value: "teils_teils", label: "Teils/teils" },
  ],
  umzaeunung: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
  ],
  baustelle: [
    { value: "tbd", label: "Noch offen" },
    { value: "keine", label: "Keine" },
    { value: "kleine_baustelle", label: "Kleine Baustelle" },
    { value: "grosse_baustelle", label: "Große Baustelle" },
  ],
  strom: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
  ],
  zufahrt: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "eingeschraenkt", label: "Eingeschränkt" },
    { value: "machbar_schwierig", label: "Machbar, aber schwierig" },
    { value: "nein", label: "Nein" },
  ],
  intern_checkliste: [
    { value: "tbd", label: "Noch offen" },
    { value: "ja", label: "Ja" },
    { value: "nein", label: "Nein" },
  ],
};

const DEFAULT_FORM = {
  region: "",
  aufmerksam_geworden_durch: "",
  potential_notizen: "",
  erstkontakt_datum: undefined as Date | undefined,
  hort_ganztag: "tbd",
  schueler_kl23_ausreichend: "tbd",
  schueler_kl234_ausreichend: "tbd",
  ausweichen_turnhalle: "tbd",
  ausweichen_turnhalle_notiz: "",
  platzbedarf_erfuellt: "tbd",
  platzbedarf_details: "",
  untergrund: "tbd",
  untergrund_notiz: "",
  umzaeunung_aktionsflaeche: "tbd",
  baustelle_aktionszeitraum: "tbd",
  stromanschluss_230v: "tbd",
  zufahrt_fahrzeuge: "tbd",
  zufahrt_notiz: "",
  intern_tempo_kommunikation: "",
  intern_attraktivitaet_score: 5,
  intern_checkliste_ausgefuellt: "tbd",
};

type FormState = typeof DEFAULT_FORM;

export function RoadshowChecklist({ dealId }: Props) {
  const { data, isLoading, save, isSaving } = useRoadshowDetails(dealId);
  const { canWrite, role } = usePermission();
  const canEdit = canWrite("deals");
  const showIntern = role === "admin" || role === "sales";

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(true);
  const [section3Open, setSection3Open] = useState(true);

  useEffect(() => {
    if (data) {
      setForm({
        region: data.region ?? "",
        aufmerksam_geworden_durch: data.aufmerksam_geworden_durch ?? "",
        potential_notizen: data.potential_notizen ?? "",
        erstkontakt_datum: data.erstkontakt_datum ? new Date(data.erstkontakt_datum) : undefined,
        hort_ganztag: data.hort_ganztag ?? "tbd",
        schueler_kl23_ausreichend: data.schueler_kl23_ausreichend ?? "tbd",
        schueler_kl234_ausreichend: data.schueler_kl234_ausreichend ?? "tbd",
        ausweichen_turnhalle: data.ausweichen_turnhalle ?? "tbd",
        ausweichen_turnhalle_notiz: data.ausweichen_turnhalle_notiz ?? "",
        platzbedarf_erfuellt: data.platzbedarf_erfuellt ?? "tbd",
        platzbedarf_details: data.platzbedarf_details ?? "",
        untergrund: data.untergrund ?? "tbd",
        untergrund_notiz: data.untergrund_notiz ?? "",
        umzaeunung_aktionsflaeche: data.umzaeunung_aktionsflaeche ?? "tbd",
        baustelle_aktionszeitraum: data.baustelle_aktionszeitraum ?? "tbd",
        stromanschluss_230v: data.stromanschluss_230v ?? "tbd",
        zufahrt_fahrzeuge: data.zufahrt_fahrzeuge ?? "tbd",
        zufahrt_notiz: data.zufahrt_notiz ?? "",
        intern_tempo_kommunikation: data.intern_tempo_kommunikation ?? "",
        intern_attraktivitaet_score: data.intern_attraktivitaet_score ?? 5,
        intern_checkliste_ausgefuellt: data.intern_checkliste_ausgefuellt ?? "tbd",
      });
    }
  }, [data]);

  const u = (field: keyof FormState, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const eignung = computeRoadshowEignung(form);
  const eignungInfo = eignungColors[eignung];

  const handleSave = () => {
    save({
      region: form.region || null,
      aufmerksam_geworden_durch: form.aufmerksam_geworden_durch || null,
      potential_notizen: form.potential_notizen || null,
      erstkontakt_datum: form.erstkontakt_datum ? format(form.erstkontakt_datum, "yyyy-MM-dd") : null,
      hort_ganztag: form.hort_ganztag,
      schueler_kl23_ausreichend: form.schueler_kl23_ausreichend,
      schueler_kl234_ausreichend: form.schueler_kl234_ausreichend,
      ausweichen_turnhalle: form.ausweichen_turnhalle,
      ausweichen_turnhalle_notiz: form.ausweichen_turnhalle_notiz || null,
      platzbedarf_erfuellt: form.platzbedarf_erfuellt,
      platzbedarf_details: form.platzbedarf_details || null,
      untergrund: form.untergrund,
      untergrund_notiz: form.untergrund_notiz || null,
      umzaeunung_aktionsflaeche: form.umzaeunung_aktionsflaeche,
      baustelle_aktionszeitraum: form.baustelle_aktionszeitraum,
      stromanschluss_230v: form.stromanschluss_230v,
      zufahrt_fahrzeuge: form.zufahrt_fahrzeuge,
      zufahrt_notiz: form.zufahrt_notiz || null,
      intern_tempo_kommunikation: form.intern_tempo_kommunikation || null,
      intern_attraktivitaet_score: form.intern_attraktivitaet_score,
      intern_checkliste_ausgefuellt: form.intern_checkliste_ausgefuellt,
    });
  };

  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-muted" />;

  const EnumField = ({ label, field, options }: { label: string; field: keyof FormState; options: { value: string; label: string }[] }) => (
    <div className="space-y-1.5">
      <Label className="text-[13px]">{label}</Label>
      <Select value={form[field] as string} onValueChange={(v) => u(field, v)} disabled={!canEdit}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const SectionHeader = ({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left">
      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      <span className="text-[14px] font-semibold text-foreground">{title}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Ampel Badge */}
      <div className={cn("flex items-center gap-3 rounded-xl px-5 py-3 border", eignungInfo.bg)}>
        <span className="text-xl">{eignungInfo.emoji}</span>
        <div>
          <p className={cn("text-[14px] font-semibold", eignungInfo.text)}>Roadshow-Eignung: {eignungInfo.label}</p>
          <p className="text-[12px] text-muted-foreground">
            {eignung === "grau" && "Pflichtkriterien noch nicht vollständig bewertet"}
            {eignung === "gruen" && "Alle Pflichtkriterien erfüllt + mindestens 2 Bonuskriterien"}
            {eignung === "gelb" && "Pflichtkriterien erfüllt, aber Einschränkungen vorhanden"}
            {eignung === "rot" && "Mindestens ein Pflichtkriterium nicht erfüllt"}
          </p>
        </div>
      </div>

      {/* Bereich 1: Basisdaten */}
      <div className={cardClass}>
        <Collapsible open={section1Open} onOpenChange={setSection1Open}>
          <CollapsibleTrigger asChild>
            <SectionHeader title="Schul-Basisdaten" open={section1Open} onToggle={() => setSection1Open(!section1Open)} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Region</Label>
                <Input value={form.region} onChange={(e) => u("region", e.target.value)} placeholder="z.B. Oberbayern" disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Erstkontakt-Datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !form.erstkontakt_datum && "text-muted-foreground")} disabled={!canEdit}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.erstkontakt_datum ? format(form.erstkontakt_datum, "dd.MM.yyyy") : "Datum wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.erstkontakt_datum} onSelect={(d) => u("erstkontakt_datum", d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Aufmerksam geworden durch</Label>
              <Input value={form.aufmerksam_geworden_durch} onChange={(e) => u("aufmerksam_geworden_durch", e.target.value)} placeholder="Empfehlung, Website, Messe…" disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Potenzial / Notizen</Label>
              <Textarea value={form.potential_notizen} onChange={(e) => u("potential_notizen", e.target.value)} rows={3} placeholder="KW-Planung, Bewerbungsstatus…" disabled={!canEdit} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bereich 2: Checkliste */}
      <div className={cardClass}>
        <Collapsible open={section2Open} onOpenChange={setSection2Open}>
          <CollapsibleTrigger asChild>
            <SectionHeader title="Vor-Ort-Checkliste" open={section2Open} onToggle={() => setSection2Open(!section2Open)} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnumField label="Hort/Ganztag angeschlossen" field="hort_ganztag" options={ENUM_OPTIONS.hort_ganztag} />
              <EnumField label="Ausreichend Schüler 2./3. Klasse" field="schueler_kl23_ausreichend" options={ENUM_OPTIONS.schueler_kl23} />
              <EnumField label="Ausreichend Schüler 2./3./4. Klasse" field="schueler_kl234_ausreichend" options={ENUM_OPTIONS.schueler_kl23} />
              <EnumField label="Ausweichen Turnhalle bei Schlechtwetter" field="ausweichen_turnhalle" options={ENUM_OPTIONS.ausweichen_turnhalle} />
            </div>
            {form.ausweichen_turnhalle !== "tbd" && form.ausweichen_turnhalle !== "ja" && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Turnhalle – Notiz</Label>
                <Input value={form.ausweichen_turnhalle_notiz} onChange={(e) => u("ausweichen_turnhalle_notiz", e.target.value)} disabled={!canEdit} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnumField label="Platzbedarf 2×200m² erfüllt" field="platzbedarf_erfuellt" options={ENUM_OPTIONS.platzbedarf} />
              <div className="space-y-1.5">
                <Label className="text-[13px]">Platzbedarf – Details</Label>
                <Input value={form.platzbedarf_details} onChange={(e) => u("platzbedarf_details", e.target.value)} placeholder="z.B. Wiese: 240m², Pausenhof: 160m²" disabled={!canEdit} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnumField label="Untergrund eben, befestigt" field="untergrund" options={ENUM_OPTIONS.untergrund} />
              <div className="space-y-1.5">
                <Label className="text-[13px]">Untergrund – Notiz</Label>
                <Input value={form.untergrund_notiz} onChange={(e) => u("untergrund_notiz", e.target.value)} disabled={!canEdit} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnumField label="Umzäunung Aktionsfläche (optional)" field="umzaeunung_aktionsflaeche" options={ENUM_OPTIONS.umzaeunung} />
              <EnumField label="Baustelle im Aktionszeitraum" field="baustelle_aktionszeitraum" options={ENUM_OPTIONS.baustelle} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EnumField label="Stromanschluss 2×230V (Schuko)" field="stromanschluss_230v" options={ENUM_OPTIONS.strom} />
              <EnumField label="Zufahrtswege Sprinter + LKW 7,5t" field="zufahrt_fahrzeuge" options={ENUM_OPTIONS.zufahrt} />
            </div>
            {(form.zufahrt_fahrzeuge === "eingeschraenkt" || form.zufahrt_fahrzeuge === "machbar_schwierig") && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Zufahrt – Notiz</Label>
                <Input value={form.zufahrt_notiz} onChange={(e) => u("zufahrt_notiz", e.target.value)} disabled={!canEdit} />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bereich 3: Interne Bewertung */}
      {showIntern && (
        <div className={cardClass}>
          <Collapsible open={section3Open} onOpenChange={setSection3Open}>
            <CollapsibleTrigger asChild>
              <SectionHeader title="Interne Bewertung" open={section3Open} onToggle={() => setSection3Open(!section3Open)} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">INTERN: Tempo & Qualität Kommunikation</Label>
                <Input value={form.intern_tempo_kommunikation} onChange={(e) => u("intern_tempo_kommunikation", e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">INTERN: Attraktivität der Location (1–10)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[form.intern_attraktivitaet_score]}
                    onValueChange={([v]) => u("intern_attraktivitaet_score", v)}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                    disabled={!canEdit}
                  />
                  <span className="text-[16px] font-semibold text-foreground w-8 text-center">{form.intern_attraktivitaet_score}</span>
                </div>
              </div>
              <EnumField label="Checkliste mit Institution ausgefüllt" field="intern_checkliste_ausgefuellt" options={ENUM_OPTIONS.intern_checkliste} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Save */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichern…" : "Checkliste speichern"}
          </Button>
        </div>
      )}
    </div>
  );
}
