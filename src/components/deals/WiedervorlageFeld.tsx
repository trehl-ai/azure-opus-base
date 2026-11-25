import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useWiedervorlageSetzen } from "@/hooks/mutations";
import { alsKalendertag, ausKalendertag, berlinHeute, wiedervorlageDe } from "@/lib/wiedervorlage";

/** Feld "Wiedervorlage am" auf der Deal-Detailseite (deals.wiedervorlage_am). */
export function WiedervorlageFeld({ dealId, wert }: { dealId: string; wert: string | null }) {
  const [offen, setOffen] = useState(false);
  const { toast } = useToast();
  const setzen = useWiedervorlageSetzen();
  const heute = berlinHeute();

  const speichern = (datum: string | null) =>
    setzen.mutate(
      { dealId, datum },
      {
        onSuccess: () => {
          setOffen(false);
          toast({ title: datum ? `Wiedervorlage ab ${wiedervorlageDe(datum)}` : "Wiedervorlage entfernt" });
        },
      },
    );

  return (
    <div>
      <p className="text-[12px] font-medium text-muted-foreground mb-0.5">Wiedervorlage am</p>
      <div className="flex items-center gap-1.5">
        <Popover open={offen} onOpenChange={setOffen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={setzen.isPending}>
              <CalendarClock className="h-3.5 w-3.5" />
              {wert ? wiedervorlageDe(wert) : "Datum wählen"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={wert ? alsKalendertag(wert) : undefined}
              onSelect={(d) => d && speichern(ausKalendertag(d))}
              disabled={(d) => ausKalendertag(d) < heute}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {wert && (
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => speichern(null)} disabled={setzen.isPending}>
            <X className="h-3.5 w-3.5" /> Löschen
          </Button>
        )}
      </div>
      {wert && wert > heute && (
        <p className="mt-1 text-[12px] text-amber-800">
          Wiedervorlage ab {wiedervorlageDe(wert)} – bis dahin nicht in ‚Zu erledigen‘
        </p>
      )}
      {wert && wert <= heute && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          Wiedervorlage seit {wiedervorlageDe(wert)} fällig – steht wieder in ‚Zu erledigen‘
        </p>
      )}
    </div>
  );
}
