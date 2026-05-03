import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, LayoutList, Plus, Settings, Trello, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskDialog } from "@/components/TaskDialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { PriorityBadge, StatusBadge, isOverdue, type Status, type Priority } from "@/lib/badges";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("due_date");

  const load = useCallback(async () => {
    if (!id) return;
    const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    setProject(p);
    const { data: m } = await supabase
      .from("project_members")
      .select("user_id, role, profiles(display_name, email)")
      .eq("project_id", id);
    setMembers(m || []);
    setIsAdmin(!!(m || []).find((x: any) => x.user_id === user?.id && x.role === "admin"));
    const { data: t } = await supabase.from("tasks").select("*").eq("project_id", id);
    setTasks(t || []);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (project) document.title = `${project.name} | Tasker`; }, [project]);

  const updateStatus = async (taskId: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const filtered = tasks
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .filter((t) => filterPriority === "all" || t.priority === filterPriority)
    .sort((a, b) => {
      if (sortBy === "due_date") {
        const av = a.due_date || "9999"; const bv = b.due_date || "9999";
        return av.localeCompare(bv);
      }
      if (sortBy === "priority") {
        const order = { high: 0, medium: 1, low: 2 } as any;
        return order[a.priority] - order[b.priority];
      }
      return a.status.localeCompare(b.status);
    });

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  if (!project) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
          {project.deadline && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
              <Calendar className="h-3.5 w-3.5" /> Due {format(new Date(project.deadline), "MMM d, yyyy")}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to={`/projects/${id}/settings`}><Settings className="mr-2 h-4 w-4" />Settings</Link>
            </Button>
          )}
          <Button onClick={() => { setEditTask(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />New Task
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{done}/{tasks.length} · {pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Members:</span>
            {members.map((m) => (
              <span key={m.user_id} className="rounded-full bg-secondary px-2 py-0.5">
                {m.profiles?.display_name}{m.role === "admin" && " (admin)"}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="list"><LayoutList className="mr-2 h-4 w-4" />List</TabsTrigger>
            <TabsTrigger value="board"><Trello className="mr-2 h-4 w-4" />Board</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tasks</TableCell></TableRow>
              ) : filtered.map((t) => {
                const overdue = isOverdue(t.due_date, t.status);
                const a = members.find((m) => m.user_id === t.assignee_id);
                const canDelete = isAdmin || t.created_by === user?.id;
                const canUpdate = isAdmin || t.assignee_id === user?.id;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <button className="font-medium text-left hover:underline" onClick={() => { setEditTask(t); setDialogOpen(true); }}>
                        {t.title}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a?.profiles?.display_name || "—"}</TableCell>
                    <TableCell><PriorityBadge priority={t.priority as Priority} /></TableCell>
                    <TableCell>
                      {canUpdate ? (
                        <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as Status)}>
                          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge status={t.status} overdue={overdue} />
                      )}
                    </TableCell>
                    <TableCell className={overdue ? "text-[hsl(var(--status-overdue))] font-medium" : "text-muted-foreground"}>
                      {t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}
                    </TableCell>
                    <TableCell>
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => deleteTask(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <KanbanBoard
          tasks={filtered}
          onMove={updateStatus}
          onTaskClick={(t) => { setEditTask(t); setDialogOpen(true); }}
          members={members}
        />
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={id!}
        members={members}
        task={editTask}
        onSaved={load}
      />
    </div>
  );
}
