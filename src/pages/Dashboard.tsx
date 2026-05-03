import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, PriorityBadge, isOverdue, type Status, type Priority } from "@/lib/badges";
import { CheckCircle2, Clock, ListTodo, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  project_id: string;
  projects: { name: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; total: number; done: number }[]>([]);

  useEffect(() => { document.title = "Dashboard | Tasker"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: allTasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, project_id, projects(name)");
      const t = (allTasks || []) as any as Task[];
      setTasks(t);

      const { data: assigned } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, project_id, projects(name)")
        .eq("assignee_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      setMyTasks((assigned || []) as any as Task[]);

      const { data: projs } = await supabase.from("projects").select("id, name");
      const list = await Promise.all(
        (projs || []).map(async (p) => {
          const projTasks = t.filter((x) => x.project_id === p.id);
          return { id: p.id, name: p.name, total: projTasks.length, done: projTasks.filter((x) => x.status === "done").length };
        })
      );
      setProjects(list);
    })();
  }, [user]);

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => isOverdue(t.due_date, t.status)).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's your work at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={stats.total} icon={<ListTodo className="h-4 w-4" />} />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Clock className="h-4 w-4 text-[hsl(var(--status-progress))]" />} />
        <StatCard label="Done" value={stats.done} icon={<CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-done))]" />} />
        <StatCard label="Overdue" value={stats.overdue} icon={<AlertTriangle className="h-4 w-4 text-[hsl(var(--status-overdue))]" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>My Tasks</CardTitle></CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks assigned to you.</p>
            ) : (
              <ul className="space-y-3">
                {myTasks.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <Link to={`/projects/${t.project_id}`} className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.projects?.name}{t.due_date && ` · Due ${format(new Date(t.due_date), "MMM d")}`}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} overdue={isOverdue(t.due_date, t.status)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Project Progress</CardTitle></CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet. <Link to="/projects/new" className="text-primary hover:underline">Create one</Link>.</p>
            ) : (
              <ul className="space-y-4">
                {projects.map((p) => {
                  const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
                  return (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">{p.done}/{p.total} · {pct}%</span>
                      </Link>
                      <Progress value={pct} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-3xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
