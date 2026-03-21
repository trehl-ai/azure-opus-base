import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProjectCardData {
  id: string;
  title: string;
  company_name: string | null;
  priority: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  start_date: string | null;
  end_date: string | null;
  open_tasks: number;
  status: string;
}

const priorityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
};

export function ProjectCard({ project, onDragStart }: { project: ProjectCardData; onDragStart: (e: React.DragEvent, id: string) => void }) {
  const navigate = useNavigate();
  const initials = project.owner_first_name && project.owner_last_name
    ? `${project.owner_first_name[0]}${project.owner_last_name[0]}`.toUpperCase() : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, project.id)}
      onClick={() => navigate(`/projects/${project.id}`)}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
        project.status === "blocked" ? "border-l-4 border-l-destructive border-t-border border-r-border border-b-border" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate flex-1">{project.title}</p>
        {project.priority && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", priorityBadge[project.priority] ?? priorityBadge.medium)}>
            {project.priority}
          </span>
        )}
      </div>
      {project.company_name && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{project.company_name}</p>}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex gap-2">
          {project.start_date && <span>{format(new Date(project.start_date), "dd.MM.yy")}</span>}
          {project.start_date && project.end_date && <span>–</span>}
          {project.end_date && <span>{format(new Date(project.end_date), "dd.MM.yy")}</span>}
        </div>
        <div className="flex items-center gap-2">
          {project.open_tasks > 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{project.open_tasks} Tasks</span>}
          {initials && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{initials}</span>}
        </div>
      </div>
    </div>
  );
}
