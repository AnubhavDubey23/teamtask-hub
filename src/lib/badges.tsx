import { cn } from "@/lib/utils";

export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function StatusBadge({ status, overdue, className }: { status: Status; overdue?: boolean; className?: string }) {
  const isOverdue = overdue && status !== "done";
  const styles = isOverdue
    ? "bg-[hsl(var(--status-overdue-bg))] text-[hsl(var(--status-overdue))]"
    : status === "todo"
    ? "bg-[hsl(var(--status-todo-bg))] text-[hsl(var(--status-todo))]"
    : status === "in_progress"
    ? "bg-[hsl(var(--status-progress-bg))] text-[hsl(var(--status-progress))]"
    : "bg-[hsl(var(--status-done-bg))] text-[hsl(var(--status-done))]";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles, className)}>
      {isOverdue ? "Overdue" : STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const styles =
    priority === "low"
      ? "bg-[hsl(var(--priority-low-bg))] text-[hsl(var(--priority-low))]"
      : priority === "medium"
      ? "bg-[hsl(var(--priority-medium-bg))] text-[hsl(var(--priority-medium))]"
      : "bg-[hsl(var(--priority-high-bg))] text-[hsl(var(--priority-high))]";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles, className)}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function isOverdue(due_date: string | null, status: Status) {
  if (!due_date || status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(due_date) < today;
}
