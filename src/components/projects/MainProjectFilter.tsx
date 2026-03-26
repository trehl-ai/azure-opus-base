import { useMainProjects, type MainProject } from "@/hooks/queries/useMainProjects";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  value: string; // "all" or main_project_id
  onChange: (value: string) => void;
}

export function MainProjectFilter({ value, onChange }: Props) {
  const { data: mainProjects } = useMainProjects();

  if (!mainProjects || mainProjects.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onChange("all")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
          value === "all"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/60 text-muted-foreground hover:bg-muted"
        )}
      >
        Alle Projekte
      </button>
      {mainProjects.map((mp) => (
        <button
          key={mp.id}
          onClick={() => onChange(mp.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === mp.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
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
