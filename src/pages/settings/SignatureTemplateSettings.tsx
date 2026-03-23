import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATE_CONFIG, renderSignatureHtml, type SignatureTemplateConfig, type SignatureData } from "@/lib/signature";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Eye, Shield } from "lucide-react";

const SAMPLE_DATA: SignatureData = {
  full_name: "Max Mustermann",
  job_title: "Sales Manager",
  phone: "+49 123 456 789",
  email: "max@example.com",
  address: "Musterstraße 1, 12345 Berlin",
  website: "www.example.com",
  profile_image_url: "https://ui-avatars.com/api/?name=Max+Mustermann&background=4F46E5&color=fff&size=80",
  linkedin_url: "https://linkedin.com/in/max",
  twitter_url: "https://x.com/max",
  whatsapp_url: "+49123456789",
};

export default function SignatureTemplateSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isAdmin = user?.role === "admin";

  const { data: configData, isLoading } = useQuery({
    queryKey: ["signature-template-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_settings")
        .select("id, value")
        .eq("key", "signature_template_config")
        .maybeSingle();
      return data;
    },
  });

  const existingConfig: SignatureTemplateConfig = configData?.value
    ? { ...DEFAULT_TEMPLATE_CONFIG, ...JSON.parse(configData.value) }
    : DEFAULT_TEMPLATE_CONFIG;

  const [config, setConfig] = useState<SignatureTemplateConfig>(existingConfig);

  // Sync state when data loads
  useState(() => {
    if (configData?.value) {
      setConfig({ ...DEFAULT_TEMPLATE_CONFIG, ...JSON.parse(configData.value) });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(config);

      if (configData?.id) {
        const { error } = await supabase
          .from("workspace_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("id", configData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workspace_settings")
          .insert({ key: "signature_template_config", value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Template-Konfiguration gespeichert");
      qc.invalidateQueries({ queryKey: ["signature-template-config"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateConfig = (key: keyof SignatureTemplateConfig, value: boolean | string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const previewHtml = renderSignatureHtml(SAMPLE_DATA, config);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nur Administratoren können das Signatur-Template verwalten.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Sichtbare Felder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "show_profile_image" as const, label: "Profilbild" },
                { key: "show_phone" as const, label: "Telefon" },
                { key: "show_address" as const, label: "Adresse" },
                { key: "show_website" as const, label: "Website" },
                { key: "show_linkedin" as const, label: "LinkedIn" },
                { key: "show_twitter" as const, label: "X / Twitter" },
                { key: "show_whatsapp" as const, label: "WhatsApp" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={config[key] as boolean}
                    onCheckedChange={(v) => updateConfig(key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Farben</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Akzentfarbe</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => updateConfig("primary_color", e.target.value)}
                    className="h-10 w-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={config.primary_color}
                    onChange={(e) => updateConfig("primary_color", e.target.value)}
                    className="flex-1"
                    placeholder="#4F46E5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Trennlinien-Farbe</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.separator_color}
                    onChange={(e) => updateConfig("separator_color", e.target.value)}
                    className="h-10 w-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={config.separator_color}
                    onChange={(e) => updateConfig("separator_color", e.target.value)}
                    className="flex-1"
                    placeholder="#E5E7EB"
                  />
                </div>
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
            Template speichern
          </Button>
        </div>

        {/* Preview */}
        <Card className="rounded-2xl sticky top-6 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Vorschau (Beispieldaten)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-white p-6">
              <p className="text-sm text-muted-foreground mb-3 italic">
                Sehr geehrter Herr Müller,<br /><br />
                vielen Dank für Ihre Anfrage...<br /><br />
                Mit freundlichen Grüßen
              </p>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
