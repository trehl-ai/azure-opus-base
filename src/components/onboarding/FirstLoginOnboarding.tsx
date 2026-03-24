import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { renderSignatureHtml, DEFAULT_TEMPLATE_CONFIG, type SignatureData, type SignatureTemplateConfig } from "@/lib/signature";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Camera, ArrowRight, ArrowLeft, Check, User, Briefcase, Phone, Mail, MapPin, Globe, Linkedin, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Profilbild", description: "Lade dein Profilbild hoch" },
  { title: "Persönliche Daten", description: "Vervollständige dein Profil" },
  { title: "Links & Signatur", description: "Überprüfe deine E-Mail-Signatur" },
];

export default function FirstLoginOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [profileImagePath, setProfileImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    job_title: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    linkedin_url: "",
    whatsapp_url: "",
  });

  const { data: templateConfig } = useQuery({
    queryKey: ["signature-template-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_settings")
        .select("value")
        .eq("key", "signature_template_config")
        .maybeSingle();
      return data?.value
        ? { ...DEFAULT_TEMPLATE_CONFIG, ...JSON.parse(data.value) }
        : DEFAULT_TEMPLATE_CONFIG;
    },
  });

  const config = (templateConfig || DEFAULT_TEMPLATE_CONFIG) as SignatureTemplateConfig;

  // Pre-fill from user data
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
      }));
    }
  }, [user]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei (PNG, JPG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bild darf maximal 5 MB groß sein.");
      return;
    }
    setUploading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Nicht angemeldet");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${authUser.id}/profile.${ext}`;
      if (profileImagePath) {
        await supabase.storage.from("signature-images").remove([profileImagePath]);
      }
      const { error } = await supabase.storage
        .from("signature-images")
        .upload(filePath, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("signature-images").getPublicUrl(filePath);
      setProfileImagePath(filePath);
      setImagePreview(urlData?.publicUrl + "?t=" + Date.now());
      toast.success("Bild hochgeladen!");
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setUploading(false);
    }
  }, [profileImagePath]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data: publicUserId } = await supabase.rpc("get_public_user_id", {
        _auth_user_id: (await supabase.auth.getUser()).data.user!.id,
      });
      if (!publicUserId) throw new Error("User-ID Zuordnung fehlgeschlagen");

      // Upsert signature
      const payload = {
        user_id: publicUserId as string,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        job_title: form.job_title.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        profile_image_path: profileImagePath,
        linkedin_url: form.linkedin_url.trim(),
        twitter_url: "",
        whatsapp_url: form.whatsapp_url.trim(),
        is_active: true,
      };

      const { error: sigError } = await supabase
        .from("user_email_signatures")
        .insert(payload);
      if (sigError) throw sigError;

      // Update user names if changed
      const { error: userError } = await supabase
        .from("users")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", publicUserId as string);
      if (userError) throw userError;
    },
    onSuccess: () => {
      toast.success("Willkommen bei BOOST! Dein Profil ist eingerichtet.");
      qc.invalidateQueries({ queryKey: ["user-signature"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      // Force reload auth context user
      window.location.reload();
    },
    onError: (err: Error) => {
      toast.error("Fehler: " + err.message);
    },
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canProceedStep0 = !!imagePreview;
  const canProceedStep1 = form.first_name.trim() && form.last_name.trim() && form.job_title.trim() && form.phone.trim();

  const previewData: SignatureData = {
    full_name: `${form.first_name} ${form.last_name}`.trim() || "Dein Name",
    job_title: form.job_title,
    phone: form.phone,
    email: form.email,
    address: form.address,
    website: form.website,
    profile_image_url: imagePreview || undefined,
    linkedin_url: form.linkedin_url,
    twitter_url: "",
    whatsapp_url: form.whatsapp_url,
  };

  const previewHtml = renderSignatureHtml(previewData, config);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Willkommen bei BOOST</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Richte dein Profil ein, damit du sofort starten kannst.
          </p>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className={cn("hidden sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
                  <p className="text-xs font-medium">{s.title}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {step === 0 && (
            <div className="flex flex-col items-center py-6 space-y-6">
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Dieses Bild wird in der Navigation, deinem Profil und deiner E-Mail-Signatur verwendet.
              </p>
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center w-48 h-48 rounded-full border-2 border-dashed transition-colors cursor-pointer",
                  dragOver ? "border-primary bg-primary/5" : imagePreview ? "border-primary" : "border-muted-foreground/30 hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <Avatar className="h-44 w-44">
                    <AvatarImage src={imagePreview} alt="Profilbild" className="object-cover" />
                  </Avatar>
                ) : uploading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Camera className="h-10 w-10" />
                    <span className="text-sm font-medium">Foto hochladen</span>
                    <span className="text-xs">Drag & Drop oder Klick</span>
                  </div>
                )}
              </div>
              {imagePreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Anderes Bild wählen
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">JPG oder PNG, max. 5 MB</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Vorname <span className="text-destructive">*</span>
                  </Label>
                  <Input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nachname <span className="text-destructive">*</span>
                  </Label>
                  <Input value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  Position / Jobtitel <span className="text-destructive">*</span>
                </Label>
                <Input value={form.job_title} onChange={(e) => updateField("job_title", e.target.value)} placeholder="z.B. Sales Manager" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Telefon <span className="text-destructive">*</span>
                </Label>
                <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+49 123 456789" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-Mail
                </Label>
                <Input value={form.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Adresse <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Musterstraße 1, 12345 Berlin" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Website <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="www.example.com" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                    LinkedIn URL <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input value={form.linkedin_url} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/dein-profil" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    WhatsApp <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input value={form.whatsapp_url} onChange={(e) => updateField("whatsapp_url", e.target.value)} placeholder="+49123456789" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Vorschau deiner E-Mail-Signatur</p>
                <div className="rounded-lg border border-border bg-white p-5">
                  <p className="text-sm text-muted-foreground mb-3 italic">
                    Hallo Herr Müller,<br /><br />
                    vielen Dank für Ihre Anfrage…<br /><br />
                    Mit freundlichen Grüßen
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border flex items-center justify-between bg-muted/30">
          <p className="text-sm text-muted-foreground">Schritt {step + 1} von {STEPS.length}</p>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
              </Button>
            )}
            {step < 2 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
              >
                Weiter <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="gap-2"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Signatur sieht gut aus — Fertigstellen
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
