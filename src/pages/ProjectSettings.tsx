import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const { data: m } = await supabase
      .from("project_members").select("user_id, role, profiles(display_name, email)").eq("project_id", id);
    setMembers(m || []);
    const isAdmin = !!(m || []).find((x: any) => x.user_id === user.id && x.role === "admin");
    setAllowed(isAdmin);
    setChecking(false);
    if (!isAdmin) return;
    const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    setProject(p);
    const { data: inv } = await supabase.from("project_invites").select("*").eq("project_id", id).order("created_at", { ascending: false });
    setInvites(inv || []);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = "Project Settings | Tasker"; }, []);

  if (checking) return <p className="text-muted-foreground">Loading…</p>;
  if (!allowed) return <Navigate to={`/projects/${id}`} replace />;
  if (!project) return null;

  const saveProject = async () => {
    setSaving(true);
    const { error } = await supabase.from("projects").update({
      name: project.name, description: project.description, deadline: project.deadline,
    }).eq("id", id!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project updated");
  };

  const removeMember = async (uid: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("project_members").delete().eq("project_id", id!).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const updateRole = async (uid: string, role: "admin" | "member") => {
    const { error } = await supabase.from("project_members").update({ role }).eq("project_id", id!).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const createInvite = async () => {
    const { error } = await supabase.from("project_invites").insert({
      project_id: id!, role: "member", created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Invite link created");
    load();
  };

  const deleteInvite = async (inviteId: string) => {
    await supabase.from("project_invites").delete().eq("id", inviteId);
    load();
  };

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    nav("/projects");
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Name</Label>
            <Input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={project.description || ""} onChange={(e) => setProject({ ...project, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Deadline</Label>
            <Input type="date" value={project.deadline || ""} onChange={(e) => setProject({ ...project, deadline: e.target.value || null })} /></div>
          <Button onClick={saveProject} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
              <div className="min-w-0">
                <div className="font-medium truncate">{m.profiles?.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">{m.profiles?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={m.role} onValueChange={(v) => updateRole(m.user_id, v as any)} disabled={m.user_id === user?.id}>
                  <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
                {m.user_id !== user?.id && (
                  <Button variant="ghost" size="icon" onClick={() => removeMember(m.user_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Invite Links
            <Button size="sm" onClick={createInvite}>Generate link</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active invite links. Generate one to share with new members.</p>
          ) : invites.map((i) => (
            <div key={i.id} className="flex items-center gap-2 p-2 rounded-md border">
              <Input readOnly value={`${window.location.origin}/invite/${i.token}`} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyLink(i.token)}><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteInvite(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={deleteProject}>Delete project</Button>
        </CardContent>
      </Card>
    </div>
  );
}
