import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Phone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WERTERAUM_SCHULEN_PIPELINE_ID = "61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e";
const PROJECT_FILES_BUCKET = "project-files";

interface DealCardData {
  id: string;
  title: string;
  company_name: string | null;
  value_amount: number | null;
  currency: string | null;
  priority: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  phone?: string | null;
  pipeline_id?: string | null;
  gespraechsleitfaden_url?: string | null;
  gespraechsleitfaden_name?: string | null;
}

const priorityDot: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-warning",
  high: "bg-destructive",
};

export function DealCard({
  deal,
  onDragStart,
  onGespraechsleitfadenChange,
}: {
  deal: DealCardData;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onGespraechsleitfadenChange?: (
    dealId: string,
    next: { url: string | null; name: string | null },
  ) => void;
}) {
  const navigate = useNavigate();

  const formatCurrency = (v: number | null, c: string | null) =>
    v != null
      ? new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: c || "EUR",
          maximumFractionDigits: 0,
        }).format(v)
      : "";

  const initials =
    deal.owner_first_name && deal.owner_last_name
      ? `${deal.owner_first_name[0]}${deal.owner_last_name[0]}`.toUpperCase()
      : null;

  const showGespraechsleitfaden =
    deal.pipeline_id === WERTERAUM_SCHULEN_PIPELINE_ID;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => navigate(`/deals/${deal.id}`)}
      className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-2 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-foreground truncate leading-tight">{deal.title}</p>
          {deal.company_name && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{deal.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {deal.priority && (
            <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[deal.priority] ?? priorityDot.medium)} />
          )}
        </div>
      </div>
      {deal.phone && (
        <a
          href={`tel:${deal.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors truncate"
        >
          <Phone className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{deal.phone}</span>
        </a>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        {deal.value_amount ? (
          <span className="text-[11px] font-semibold text-foreground">{formatCurrency(deal.value_amount, deal.currency)}</span>
        ) : <span />}
        {initials && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-semibold text-primary">
            {initials}
          </span>
        )}
      </div>
      {showGespraechsleitfaden && (
        <GespraechsleitfadenRow
          dealId={deal.id}
          initialUrl={deal.gespraechsleitfaden_url ?? null}
          initialName={deal.gespraechsleitfaden_name ?? null}
          onChange={onGespraechsleitfadenChange}
        />
      )}
    </div>
  );
}

function GespraechsleitfadenRow({
  dealId,
  initialUrl,
  initialName,
  onChange,
}: {
  dealId: string;
  initialUrl: string | null;
  initialName: string | null;
  onChange?: (
    dealId: string,
    next: { url: string | null; name: string | null },
  ) => void;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [name, setName] = useState<string | null>(initialName);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(initialUrl);
    setName(initialName);
  }, [initialUrl, initialName]);

  const handlePick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    try {
      const path = `deals/${dealId}/gespraechsleitfaden/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .getPublicUrl(path);
      const publicUrl = pub?.publicUrl ?? null;

      const { error: updateError } = await supabase
        .from("deals")
        .update({
          gespraechsleitfaden_url: publicUrl,
          gespraechsleitfaden_name: file.name,
        })
        .eq("id", dealId);
      if (updateError) throw updateError;

      setUrl(publicUrl);
      setName(file.name);
      onChange?.(dealId, { url: publicUrl, name: file.name });
    } catch (err) {
      console.error("Leitfaden-Upload fehlgeschlagen:", err);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!name) return;
    setBusy("delete");
    try {
      const path = `deals/${dealId}/gespraechsleitfaden/${name}`;
      await supabase.storage.from(PROJECT_FILES_BUCKET).remove([path]);
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          gespraechsleitfaden_url: null,
          gespraechsleitfaden_name: null,
        })
        .eq("id", dealId);
      if (updateError) throw updateError;
      setUrl(null);
      setName(null);
      onChange?.(dealId, { url: null, name: null });
    } catch (err) {
      console.error("Leitfaden-Löschen fehlgeschlagen:", err);
    } finally {
      setBusy(null);
    }
  };

  if (busy === "upload") {
    return (
      <p className="mt-1 text-[10px] text-muted-foreground">⏳ wird hochgeladen…</p>
    );
  }

  if (url && name) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-blue-500 hover:underline truncate min-w-0"
        >
          <span aria-hidden>📎</span>
          <span className="truncate">{name}</span>
        </a>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy === "delete"}
          aria-label="Leitfaden löschen"
          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePick}
        className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
      >
        <span aria-hidden>📎</span>
        <span>Leitfaden hochladen</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={handleUpload}
      />
    </>
  );
}
