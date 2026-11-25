import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useWiedervorlageSetzen } from "@/hooks/mutations";
import { ausKalendertag, berlinHeute, plusMonate, plusTage, wiedervorlageDe } from "@/lib/wiedervorlage";

/**
 * Aktion "Wiedervorlage" je Zeile in "Zu erledigen": in 14 Tagen, in 1 Monat oder Datum waehlen.
 * Danach verschwindet der Deal aus der Liste (get_aktionsliste blendet bis zum Datum aus);
 * der Toast bietet "Rueckgaengig" an und setzt den vorherigen Wert zurueck.
 */
export function WiedervorlageAktion({ dealId, titel }: { dealId: string; titel: string }) {
  const [offen, setOffen] = useState(false);
  const [kalender, setKalender] = useState(false);
  const { toast } = useToast();
  const setzen = useWiedervorlageSetzen();
  const heute = berlinHeute();

  const zuruecknehmen = (vorher: string | null) =>
    setzen.mutate(
      { dealId, datum: vorher },
      { onSuccess: () => toast({ title: "Wiedervorlage zurückgenommen", description: titel }) },
    );

  const speichern = (datum: string) =>
    setzen.mutate(
      { dealId, datum },
      {
        onSuccess: ({ vorher }) => {
          setOffen(false);
          setKalender(false);
          toast({
            title: `Wiedervorlage ab ${wiedervorlageDe(datum)}`,
            description: `${titel} – bis dahin nicht in ‚Zu erledigen‘`,
            action: (
              <ToastAction altText="Wiedervorlage rückgängig machen" onClick={() => zuruecknehmen(vorher)}>
                Rückgängig
              </ToastAction>
            ),
          });
        },
      },
    );

  return (
    <Popover open={offen} onOpenChange={(v) => { setOffen(v); if (!v) setKalender(false); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={setzen.isPending}>
          <CalendarClock className="h-3.5 w-3.5" /> Wiedervorlage
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => speichern(plusTage(heute, 14))}>
            in 14 Tagen <span className="ml-auto pl-3 text-muted-foreground">{wiedervorlageDe(plusTage(heute, 14))}</span>
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => speichern(plusMonate(heute, 1))}>
            in 1 Monat <span className="ml-auto pl-3 text-muted-foreground">{wiedervorlageDe(plusMonate(heute, 1))}</span>
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => setKalender((v) => !v)}>
            Datum wählen …
          </Button>
          {kalender && (
            <Calendar
              mode="single"
              onSelect={(d) => d && speichern(ausKalendertag(d))}
              disabled={(d) => ausKalendertag(d) <= heute}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
