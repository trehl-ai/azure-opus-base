import { useMainProjects, type MainProject } from "@/hooks/queries/useMainProjects";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import eoIpsoLogo from "@/assets/eo-ipso-logo.png";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function MainProjectFilter({ value, onChange }: Props) {
  const { data: mainProjects } = useMainProjects();

  if (!mainProjects || mainProjects.length === 0) return null;

  const pillBase =
    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer select-none";
  const pillActive = "bg-primary text-primary-foreground shadow-sm";
  const pillInactive =
    "border border-border bg-background text-muted-foreground hover:bg-muted/60";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Alle Projekte */}
      <button
        onClick={() => onChange("all")}
        className={cn(pillBase, value === "all" ? pillActive : pillInactive)}
      >
        <img
          src={eoIpsoLogo}
          alt="eo ipso"
          className="h-5 w-5 rounded-full object-cover"
        />
        Alle Projekte
      </button>

      {mainProjects.map((mp) => (
        <button
          key={mp.id}
          onClick={() => onChange(mp.id)}
          className={cn(pillBase, value === mp.id ? pillActive : pillInactive)}
        >
          <Avatar className="h-5 w-5">
            {mp.image_url ? (
              <AvatarImage src={mp.image_url} alt={mp.name} className="object-cover" />
            ) : (
              <AvatarFallback
                style={{ backgroundColor: mp.color || "#6366F1" }}
                className="text-white text-[9px] font-semibold"
              >
                {mp.name[0]?.toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          {mp.name}
        </button>
      ))}
    </div>
  );
}
