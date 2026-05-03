import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge, isOverdue, type Status, STATUS_LABEL } from "@/lib/badges";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: Status;
  priority: any;
  due_date: string | null;
  assignee_id: string | null;
}

const COLS: Status[] = ["todo", "in_progress", "done"];

export function KanbanBoard({
  tasks, onMove, onTaskClick, members,
}: {
  tasks: Task[];
  onMove: (id: string, status: Status) => void;
  onTaskClick: (t: Task) => void;
  members: { user_id: string; profiles: { display_name: string } | null }[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const newStatus = e.over.id as Status;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && task.status !== newStatus) onMove(task.id, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      <div className="grid md:grid-cols-3 gap-4">
        {COLS.map((col) => (
          <Column key={col} status={col} tasks={tasks.filter((t) => t.status === col)} onTaskClick={onTaskClick} members={members} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ status, tasks, onTaskClick, members }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("rounded-lg border bg-muted/30 p-3 min-h-[300px] transition-colors", isOver && "bg-accent/50 border-primary")}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{STATUS_LABEL[status as Status]}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t: Task) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} members={members} />)}
      </div>
    </div>
  );
}

function TaskCard({ task, onClick, members }: { task: Task; onClick: () => void; members: any[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const overdue = isOverdue(task.due_date, task.status);
  const assignee = members.find((m) => m.user_id === task.assignee_id);
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-50")}>
      <Card className="cursor-grab active:cursor-grabbing hover:border-primary/50" onClick={onClick}>
        <CardContent className="p-3 space-y-2">
          <div className="font-medium text-sm">{task.title}</div>
          <div className="flex items-center justify-between gap-2">
            <PriorityBadge priority={task.priority} />
            {task.due_date && (
              <span className={cn("text-xs", overdue ? "text-[hsl(var(--status-overdue))] font-medium" : "text-muted-foreground")}>
                {format(new Date(task.due_date), "MMM d")}
              </span>
            )}
          </div>
          {assignee && <div className="text-xs text-muted-foreground truncate">{assignee.profiles?.display_name}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
