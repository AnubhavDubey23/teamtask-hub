
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Project invites
CREATE TABLE public.project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  role public.app_role NOT NULL DEFAULT 'member',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'admin'
  )
$$;

-- Projects RLS
CREATE POLICY "Members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "Authenticated can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_admin(id, auth.uid()));
CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_project_admin(id, auth.uid()));

-- Project members RLS
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Admins can insert members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins can update members"
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins can remove members or self leave"
  ON public.project_members FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()) OR user_id = auth.uid());

-- Tasks RLS
CREATE POLICY "Members can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Assignee or admin can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admin or creator can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_project_admin(project_id, auth.uid()));

-- Invites RLS (admin only; redemption goes through SECURITY DEFINER RPC)
CREATE POLICY "Admins can view invites"
  ON public.project_invites FOR SELECT TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins can create invites"
  ON public.project_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Admins can delete invites"
  ON public.project_invites FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add owner as admin on project creation
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_touch_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tasks_touch_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Accept invite RPC (SECURITY DEFINER, bypasses invite RLS for redemption)
CREATE OR REPLACE FUNCTION public.accept_invite(_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite public.project_invites%ROWTYPE;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _invite FROM public.project_invites WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  IF _invite.expires_at IS NOT NULL AND _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_invite.project_id, _uid, _invite.role)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN _invite.project_id;
END;
$$;
