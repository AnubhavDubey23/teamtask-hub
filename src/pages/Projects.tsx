import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Projects | Tasker"; }, []);

  useEffect(() => {
    (async () => {
      const { data: projs } = await supabase
        .from("projects")
        .select("id, name, description, deadline, created_at")
        .order("created_at", { ascending: false });

      const ids = (projs || []).map((p) => p.id);
      const { data: tasks } = ids.length
        ? await supabase.from("tasks").select("project_id, status").in("project_id", ids)
        : { data: [] as any[] };

      const enriched = (projs || []).map((p) => {
        const t = (tasks || []).filter((x: any) => x.project_id === p.id);
        const done = t.filter((x: any) => x.status === "done").length;
        return { ...p, total: t.length, done, pct: t.length ? Math.round((done / t.length) * 100) : 0 };
      });
      setProjects(enriched);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">All projects you're a member of.</p>
        </div>
        <Button asChild><Link to="/projects/new"><Plus className="mr-2 h-4 w-4" />New Project</Link></Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No projects yet. <Link to="/projects/new" className="text-primary hover:underline">Create your first</Link>.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {p.description || "No description"}
                  </p>
                  {p.deadline && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Due {format(new Date(p.deadline), "MMM d, yyyy")}
                    </div>
                  )}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{p.done}/{p.total} tasks</span>
                      <span>{p.pct}%</span>
                    </div>
                    <Progress value={p.pct} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
