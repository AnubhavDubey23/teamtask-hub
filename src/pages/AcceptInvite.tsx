import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return;
    if (!user) {
      sessionStorage.setItem("pending_invite", token!);
      nav("/login", { replace: true });
      return;
    }
    ran.current = true;
    (async () => {
      const { data, error } = await supabase.rpc("accept_invite", { _token: token! });
      if (error) { toast.error(error.message); nav("/projects"); return; }
      toast.success("You're in!");
      nav(`/projects/${data}`, { replace: true });
    })();
  }, [user, loading, token, nav]);

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Joining project…</div>;
}
