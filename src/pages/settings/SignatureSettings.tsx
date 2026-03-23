import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { renderSignatureHtml, DEFAULT_TEMPLATE_CONFIG, type SignatureData, type SignatureTemplateConfig } from "@/lib/signature";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Trash2, Eye, Save, Linkedin, Globe, Phone, Mail, MapPin, Briefcase, User } from "lucide-react";

function ensureUrl(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function SignatureSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    linkedin_url: "",
    twitter_url: "",
    whatsapp_url: "",
    profile_image_path: "" as string | null,
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existingSignature, isLoading } = useQuery({
    queryKey: ["user-signature"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_email_signatures")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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

  useEffect(() => {
    if (existingSignature) {
      setForm({
        full_name: existingSignature.full_name || "",
        job_title: existingSignature.job_title || "",
        phone: existingSignature.phone || "",
        email: existingSignature.email || "",
        address: existingSignature.address || "",
        website: existingSignature.website || "",
        linkedin_url: existingSignature.linkedin_url || "",
        twitter_url: existingSignature.twitter_url || "",
        whatsapp_url: existingSignature.whatsapp_url || "",
        profile_image_path: existingSignature.profile_image_path || null,
        is_active: existingSignature.is_active ?? true,
      });
      if (existingSignature.profile_image_path) {
        const { data: urlData } = supabase.storage
          .from("signature-images")
          .getPublicUrl(existingSignature.profile_image_path);
        setImagePreview(urlData?.publicUrl || null);
      }
    } else if (user) {
      setForm((prev) => ({
        ...prev,
        full_name: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
      }));
    }
  }, [existingSignature, user]);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei (PNG, JPG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Bild darf maximal 2 MB groß sein.");
      return;
    }
    setUploading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Nicht angemeldet");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${authUser.id}/profile.${ext}`;
      if (form.profile_image_path) {
        await supabase.storage.from("signature-images").remove([form.profile_image_path]);
      }
      const { error } = await supabase.storage
        .from("signature-images")
        .upload(filePath, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("signature-images").getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, profile_image_path: filePath }));
      setImagePreview(urlData?.publicUrl + "?t=" + Date.now());
      toast.success("Bild hochgeladen");
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (form.profile_image_path) {
      await supabase.storage.from("signature-images").remove([form.profile_image_path]);
    }
    setForm((prev) => ({ ...prev, profile_image_path: null }));
    setImagePreview(null);
    toast.success("Bild entfernt");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.full_name.trim()) {
      newErrors.full_name = "Name ist ein Pflichtfeld.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Bitte gib eine gültige E-Mail-Adresse ein.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Bitte korrigiere die markierten Felder.");

      const { data: publicUserIdData } = await supabase.rpc("get_public_user_id", {
        _auth_user_id: (await supabase.auth.getUser()).data.user!.id,
      });
      if (!publicUserIdData) throw new Error("User-ID Zuordnung fehlgeschlagen");

      const payload = {
        user_id: publicUserIdData as string,
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        profile_image_path: form.profile_image_path,
        linkedin_url: form.linkedin_url.trim() ? ensureUrl(form.linkedin_url) : "",
        twitter_url: form.twitter_url.trim() ? ensureUrl(form.twitter_url) : "",
        whatsapp_url: form.whatsapp_url.trim(),
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (existingSignature) {
        const { error } = await supabase
          .from("user_email_signatures")
          .update(payload)
          .eq("id", existingSignature.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_email_signatures")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Signatur gespeichert");
      qc.invalidateQueries({ queryKey: ["user-signature"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const previewData: SignatureData = {
    full_name: form.full_name || "Dein Name",
    job_title: form.job_title,
    phone: form.phone,
    email: form.email,
    address: form.address,
    website: form.website,
    profile_image_url: imagePreview || undefined,
    linkedin_url: form.linkedin_url,
    twitter_url: form.twitter_url,
    whatsapp_url: form.whatsapp_url,
  };

  const previewHtml = renderSignatureHtml(previewData, config);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-5">
          {/* Profile Image Card */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                Persönliche Signaturdaten
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-normal text-muted-foreground">Aktiv</Label>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Profile Image */}
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Profilbild</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 ring-2 ring-border">
                    {imagePreview ? (
                      <AvatarImage src={imagePreview} alt="Profilbild" className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {form.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-1.5"
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {imagePreview ? "Ändern" : "Hochladen"}
                    </Button>
                    {imagePreview && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeImage} className="gap-1.5 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Entfernen
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              {/* Name + Title */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Vollständiger Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => updateField("full_name", e.target.value)}
                    placeholder="Max Mustermann"
                    className={errors.full_name ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    Jobtitel
                  </Label>
                  <Input value={form.job_title} onChange={(e) => updateField("job_title", e.target.value)} placeholder="Sales Manager" />
                </div>
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Telefon
                  </Label>
                  <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+49 123 456789" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    E-Mail
                  </Label>
                  <Input
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="max@example.com"
                    className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label className="text-[13px] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Adresse
                </Label>
                <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Musterstraße 1, 12345 Berlin" />
                <p className="text-xs text-muted-foreground">Straße, PLZ und Ort in einem Feld</p>
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <Label className="text-[13px] flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Website
                </Label>
                <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="www.example.com" />
              </div>
            </CardContent>
          </Card>

          {/* Social Links Card */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                Social Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/dein-profil" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">X / Twitter</Label>
                <Input value={form.twitter_url} onChange={(e) => updateField("twitter_url", e.target.value)} placeholder="https://x.com/dein-handle" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">WhatsApp (Nummer oder Link)</Label>
                <Input value={form.whatsapp_url} onChange={(e) => updateField("whatsapp_url", e.target.value)} placeholder="+49123456789 oder https://wa.me/..." />
                <p className="text-xs text-muted-foreground">Nur Ziffern oder vollständiger wa.me-Link</p>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 w-full"
            size="lg"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Signatur speichern
          </Button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card className="rounded-2xl sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                Live-Vorschau
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-white p-6">
                <p className="text-sm text-muted-foreground mb-3 italic">
                  Hallo Herr Müller,<br /><br />
                  vielen Dank für Ihre Anfrage…<br /><br />
                  Mit freundlichen Grüßen
                </p>
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
              {!form.is_active && (
                <p className="text-sm text-amber-600 mt-3 flex items-center gap-1.5">
                  ⚠️ Signatur ist deaktiviert – wird beim Versand nicht angefügt.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Das Layout wird durch das globale Template gesteuert. Nur deine persönlichen Inhalte werden hier bearbeitet.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
