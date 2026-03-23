import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntitySearchSelectProps {
  entityType: "contact" | "deal";
  value: string | null;
  onChange: (id: string | null, entity?: any) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EntitySearchSelect({ entityType, value, onChange, placeholder, disabled }: EntitySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["entity-search-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .is("deleted_at", null)
        .order("first_name")
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: entityType === "contact",
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["entity-search-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, primary_contact_id, company:companies(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: entityType === "deal",
  });

  const items = useMemo(() => {
    if (entityType === "contact") {
      return contacts.map((c) => ({
        id: c.id,
        label: `${c.first_name} ${c.last_name}`,
        sub: c.email || "",
        raw: c,
      }));
    }
    return deals.map((d) => ({
      id: d.id,
      label: d.title,
      sub: (d.company as any)?.name || "",
      raw: d,
    }));
  }, [entityType, contacts, deals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(s) || i.sub.toLowerCase().includes(s));
  }, [items, search]);

  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn("w-full justify-between text-[14px] min-h-[44px]", !value && "text-muted-foreground")}
          >
            {selected ? selected.label : (placeholder || "Auswählen…")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Suchen…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Keine Ergebnisse.</CommandEmpty>
              <CommandGroup>
                {filtered.slice(0, 30).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onChange(item.id === value ? null : item.id, item.raw);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.label}</p>
                      {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
