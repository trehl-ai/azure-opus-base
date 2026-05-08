import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "project-files";
const FOLDER = "werteraum/gespraechsleitfaden";

type LeitfadenState = { name: string; url: string } | null;

export function WerteraumLeitfadenButton() {
  const [leitfaden, setLeitfaden] = useState<LeitfadenState>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(FOLDER, { limit: 1, sortBy: { column: "created_at", order: "desc" } });
      if (cancelled || error || !data || data.length === 0) return;
      const file = data[0];
      if (!file?.name) return;
      const { data: pub } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${FOLDER}/${file.name}`);
      if (!cancelled && pub?.publicUrl) {
        setLeitfaden({ name: file.name, url: pub.publicUrl });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    try {
      const path = `${FOLDER}/${file.name}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) {
        setLeitfaden({ name: file.name, url: pub.publicUrl });
      }
    } catch (err) {
      console.error("Leitfaden-Upload fehlgeschlagen:", err);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!leitfaden) return;
    setBusy("delete");
    try {
      await supabase.storage
        .from(BUCKET)
        .remove([`${FOLDER}/${leitfaden.name}`]);
      setLeitfaden(null);
    } catch (err) {
      console.error("Leitfaden-Löschen fehlgeschlagen:", err);
    } finally {
      setBusy(null);
    }
  };

  if (leitfaden) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.open(leitfaden.url, "_blank")}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-blue-600 hover:border-blue-400 hover:underline min-h-[44px] max-w-[260px]"
          title={leitfaden.name}
        >
          <span aria-hidden>📎</span>
          <span className="truncate">{leitfaden.name}</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy === "delete"}
          aria-label="Leitfaden löschen"
          className="text-gray-400 hover:text-red-500 transition-colors p-2"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy === "upload"}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 transition-colors min-h-[44px]"
      >
        <span aria-hidden>📎</span>
        <span>{busy === "upload" ? "Lädt…" : "Gesprächsleitfaden"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.pptx"
        className="hidden"
        onChange={handleUpload}
      />
    </>
  );
}
