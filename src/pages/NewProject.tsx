import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  description: z.string().trim().max(2000).optional(),
});

export default function NewProject() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "New Project | Tasker"; }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ name, description: description || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    // Insert without .select() to avoid RLS RETURNING-clause timing issue,
    // then fetch the new project id in a separate query.
    const { error: insertError } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
        owner_id: user.id,
      });
    if (insertError) { setLoading(false); toast.error(insertError.message); return; }

    const { data, error: fetchError } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", parsed.data.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    setLoading(false);
    if (fetchError || !data) { toast.success("Project created"); nav("/projects"); return; }
    toast.success("Project created");
    nav(`/projects/${data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>New Project</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button type="button" variant="outline" onClick={() => nav("/projects")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
