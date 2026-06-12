import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone, Mail, FileText, CheckSquare, Calendar,
  MessageSquare, Users, CheckCircle2, ExternalLink, X
} from "lucide-react";
import { format, isToday, isPast, isThisWeek, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type Filter = "all" | "today" | "overdue" | "week";

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  note: FileText,
  task: CheckSquare,
  meeting: Calendar,
  briefing: Users,
  casting: Users,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: "text-blue-500",
  email: "text-purple-500",
  note: "text-gray-500",
  task: "text-orange-500",
  meeting: "text-green-500",
  briefing: "text-pink-500",
  casting: "text-yellow-500",
};

export default function Activities() {
  const [activities, setActivities] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_my_activities");
    if (!error && data) setActivities(data);
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, []);

  const filtered = activities.filter(a => {
    const due = a.due_date ? parseISO(a.due_date) : null;
    if (filter === "today" && (!due || !isToday(due))) return false;
    if (filter === "overdue" && (!due || !isPast(due) || isToday(due))) return false;
    if (filter === "week" && (!due || !isThisWeek(due, { locale: de }))) return false;
    if (search && !`${a.title} ${a.deal_title} ${a.contact_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const markDone = async (id: string) => {
    await (supabase as any)
      .from("deal_activities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    setSelected(null);
    fetchActivities();
  };

  const Icon = (type: string) => {
    const C = ACTIVITY_ICONS[type] || MessageSquare;
    return <C className={`w-4 h-4 ${ACTIVITY_COLORS[type] || "text-gray-400"}`} />;
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "today", label: "Heute" },
    { key: "overdue", label: "Überfällig" },
    { key: "week", label: "Diese Woche" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Aktivitäten</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} Aktivitäten</span>
      </div>

      {/* Filter + Search */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <Input
          placeholder="Suchen..."
          className="ml-auto w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabelle */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="w-8 p-3"></th>
              <th className="p-3 text-left">Aktivität</th>
              <th className="p-3 text-left">Deal</th>
              <th className="p-3 text-left">Kontakt</th>
              <th className="p-3 text-left">Telefon</th>
              <th className="p-3 text-left">Fällig</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Lädt...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Keine Aktivitäten</td></tr>
            ) : filtered.map(a => {
              const due = a.due_date ? parseISO(a.due_date) : null;
              const overdue = due && isPast(due) && !isToday(due) && a.status !== "completed";
              return (
                <tr
                  key={a.id}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelected(a)}
                >
                  <td className="p-3">{Icon(a.activity_type)}</td>
                  <td className="p-3 font-medium max-w-xs truncate">{a.title}</td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate">{a.deal_title}</td>
                  <td className="p-3">{a.contact_name}</td>
                  <td className="p-3 font-mono text-xs">{a.contact_phone || "—"}</td>
                  <td className={`p-3 text-xs ${overdue ? "text-red-500 font-semibold" : ""}`}>
                    {due ? format(due, "dd.MM.yy HH:mm", { locale: de }) : "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant={
                      a.status === "completed" ? "default" :
                      a.status === "sent" ? "secondary" :
                      overdue ? "destructive" : "outline"
                    }>
                      {a.status === "completed" ? "Erledigt" :
                       a.status === "sent" ? "Gesendet" :
                       a.status === "open" ? "Offen" : a.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Popup */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
          <div className="bg-background w-full max-w-md h-full overflow-y-auto p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {Icon(selected.activity_type)}
                <span className="font-semibold text-lg">{selected.title}</span>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </div>

            {/* Kontakt-Block */}
            <div className="border rounded-lg p-4 flex flex-col gap-2">
              <div className="font-medium">{selected.contact_name || "—"}</div>
              {selected.contact_phone && (
                <a href={`tel:${selected.contact_phone}`} className="flex items-center gap-2 text-blue-500 hover:underline">
                  <Phone className="w-4 h-4" />{selected.contact_phone}
                </a>
              )}
              {selected.contact_email && (
                <a href={`mailto:${selected.contact_email}`} className="flex items-center gap-2 text-purple-500 hover:underline">
                  <Mail className="w-4 h-4" />{selected.contact_email}
                </a>
              )}
            </div>

            {/* Deal */}
            {selected.deal_title && (
              <div className="flex items-center justify-between border rounded-lg p-3">
                <span className="text-sm text-muted-foreground">{selected.deal_title}</span>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/deals/${selected.deal_id}`)}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Beschreibung */}
            {selected.description && (
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Notiz</div>
                <div className="text-sm whitespace-pre-wrap">{selected.description}</div>
              </div>
            )}

            {/* Mail-Entwurf */}
            {selected.mail_entwurf && (
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Mail-Entwurf</div>
                <div className="text-sm whitespace-pre-wrap">{selected.mail_entwurf}</div>
              </div>
            )}

            {/* Fällig */}
            {selected.due_date && (
              <div className="text-xs text-muted-foreground">
                Fällig: {format(parseISO(selected.due_date), "dd.MM.yyyy HH:mm", { locale: de })}
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto flex gap-2">
              {selected.status !== "completed" && (
                <Button className="flex-1" onClick={() => markDone(selected.id)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Erledigt
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/deals/${selected.deal_id}`)}>
                Deal öffnen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
