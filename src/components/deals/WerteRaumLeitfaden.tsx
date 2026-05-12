import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

const WERTERAUM_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e";

interface Section {
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    title: "🎯 Ziel des Calls",
    content: (
      <p className="text-sm text-gray-700">
        Interesse wecken · Relevanz klar machen · Förderfähigkeit platzieren · Hürde senken · konkreten nächsten Schritt sichern.
      </p>
    ),
  },
  {
    title: "👤 Zielperson & Anrufzeiten",
    content: (
      <div className="text-sm text-gray-700 space-y-1">
        <p><strong>Primär:</strong> Schulleitung, Rektor/in, Konrektor/in</p>
        <p><strong>Alternativ:</strong> Schulsozialarbeit, Sozialpädagog/innen</p>
        <p className="mt-2"><strong>Beste Zeiten:</strong> 07:30 Uhr · ab 13:00 Uhr</p>
      </div>
    ),
  },
  {
    title: "⚡ Stärkste No-Brainer",
    content: (
      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
        <li>Förderfähig — Startchancenprogramm Säule 3</li>
        <li>Budget: ca. 30.000 € — passt in Förderlogiken</li>
        <li>Plug-and-Play — Aufbau, Durchführung, Abbau übernommen</li>
        <li>Eigene Zelte auf dem Schulhof — entlastend, keine Raumfrage</li>
        <li>Lehrplannah, 7–9 Jahre, 1 Woche, 9 Module</li>
        <li>Initiative des Bayerischen Sozialministeriums</li>
      </ul>
    ),
  },
  {
    title: "💬 Gesprächsstruktur A–F",
    content: (
      <div className="text-sm text-gray-700 space-y-3">
        <div>
          <p className="font-semibold text-gray-900">A. Einstieg</p>
          <p className="italic text-gray-600">„Guten Tag Frau/Herr [Name], mein Name ist [Name]. Ich melde mich wegen WerteRaum gegen Extremismus – einer Initiative des Bayerischen Sozialministeriums. Ein Präventionsprogramm für Grundschulen, Kinder 7–9 Jahre, Themen wie Respekt, Toleranz, Konfliktlösung. Haben Sie gerade 2 Minuten?“</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">B. Relevanz aufmachen</p>
          <p className="italic text-gray-600">„Viele Schulen suchen nach wirksamen, kindgerechten Formaten – ohne das Kollegium zusätzlich zu belasten.“</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">C. Kurzpitch</p>
          <p className="italic text-gray-600">„Einwöchige Intensivwoche, 9 Module, 2. und 3. Klassen. Offenheit, Gemeinschaft, Perspektivwechsel, Respekt, Selbstbehauptung.“</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">D. Aufwand klein machen</p>
          <p className="italic text-gray-600">„Eigene Zelte auf dem Schulhof, wir übernehmen operative Umsetzung weitgehend selbst. Plug-and-Play für die Schule.“</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">E. Förderung platzieren</p>
          <p className="italic text-gray-600">„Besonders spannend für Startchancenschulen — über Säule 3 sehr gut andockbar.“</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">F. Abschlussfrage</p>
          <p className="italic text-gray-600">„Ist das für Sie grundsätzlich ein Thema — inhaltlich oder im Hinblick auf verfügbare Fördermittel?“</p>
        </div>
      </div>
    ),
  },
  {
    title: "🎤 30-Sekunden-Pitch",
    content: (
      <p className="text-sm text-gray-700 italic bg-blue-50 p-3 rounded border-l-4 border-blue-400">
        „WerteRaum ist eine Initiative des Bayerischen Sozialministeriums und ein einwöchiges Präventionsprogramm für Grundschulen, das Kinder zwischen 7 und 9 Jahren spielerisch in Werten wie Respekt, Toleranz, Gleichberechtigung und Konfliktlösung stärkt. Eigene Zelte auf dem Schulhof, lehrplannah, entlastet das Kollegium — für Startchancenschulen besonders spannend über Säule 3.“
      </p>
    ),
  },
  {
    title: "❓ Qualifizierungsfragen",
    content: (
      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
        <li>Sind Sie bereits im Startchancenprogramm?</li>
        <li>Welche Rolle spielen Wertevermittlung / Konfliktlösung bei Ihnen aktuell?</li>
        <li>Wäre Schulleitung oder Schulsozialarbeit die richtige Stelle?</li>
        <li>Eher Projektwochen, externe Partner oder interne Formate?</li>
        <li>Eher dieses oder nächstes Schulhalbjahr realistisch?</li>
      </ul>
    ),
  },
  {
    title: "🛡️ Einwandbehandlung",
    content: (
      <div className="text-sm text-gray-700 space-y-2">
        {[
          ["„Keine Zeit.“", "Genau deshalb Plug-and-Play — wir übernehmen die operative Umsetzung."],
          ["„Kein Budget.“", "Genau deshalb Förderung aktiv ansprechen — Startchancenprogramm."],
          ["„Haben schon Angebote.“", "WerteRaum ist keine Einzel-Maßnahme, sondern komplette Themenwoche mit hoher Reichweite."],
          ["„Passt das für Grundschüler?“", "Genau dafür entwickelt: 7–9 Jahre, spielerisch, niedrigschwellig."],
          ["„Klingt aufwendig.“", "Eigenes Team, eigene Zelte, klare Struktur — wenig Zusatzaufwand."],
        ].map(([einwand, antwort]) => (
          <div key={einwand} className="bg-gray-50 p-2 rounded">
            <p className="font-medium text-gray-900">{einwand}</p>
            <p className="text-gray-600">→ {antwort}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "✅ Abschluss & nächster Schritt",
    content: (
      <div className="text-sm text-gray-700 space-y-1">
        <p className="font-semibold">Ziel: Nicht alles erklären — nur nächsten konkreten Schritt sichern.</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>„Ich schicke Ihnen kurz die Infos und wir vereinbaren einen kurzen Termin.“</li>
          <li>„Soll ich eine kompakte Übersicht schicken?“</li>
          <li>„Wer ist bei Ihnen der beste Ansprechpartner für förderfähige Präventionsformate?“</li>
        </ul>
      </div>
    ),
  },
  {
    title: "📝 CRM-Notizen nach Call",
    content: (
      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
        <li>Richtige Ansprechperson + Rolle</li>
        <li>Startchancen-Schule: ja / nein / unbekannt</li>
        <li>Interesse: hoch / mittel / niedrig</li>
        <li>Nächste Aktion + Timing</li>
        <li>Einwände + Förderbezug</li>
      </ul>
    ),
  },
];

interface WerteRaumLeitfadenButtonProps {
  pipelineId: string | null | undefined;
}

export function WerteRaumLeitfadenButton({ pipelineId }: WerteRaumLeitfadenButtonProps) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 4]));

  if (pipelineId !== WERTERAUM_PIPELINE_ID) return null;

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-green-600 text-green-700 hover:bg-green-50"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Gesprächsleitfaden
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-green-600" />
              Gesprächsleitfaden — WerteRaum gegen Extremismus
              <span className="text-xs font-normal text-gray-500 ml-auto">v3</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {sections.map((section, idx) => (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSection(idx)}
                >
                  <span className="font-medium text-sm text-gray-900">{section.title}</span>
                  {expandedSections.has(idx) ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {expandedSections.has(idx) && (
                  <div className="p-3 border-t bg-white">{section.content}</div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
