-- Fix #1: Restore EXECUTE on RLS helper functions to authenticated role.
-- The previous "security linter fix" migration revoked these, but they're
-- called inside RLS policies for projects/tasks/members/invites — without
-- EXECUTE permission, every data query fails with "permission denied for
-- function is_project_member".
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_admin(uuid, uuid) TO authenticated;

-- Fix #2: Break the chicken-and-egg problem on project creation.
-- The original "Admins can insert members" policy required is_project_admin
-- to already be true — but when a brand-new project's trigger tries to add
-- the owner as the first admin, no admin exists yet, so the insert fails.
-- We now also allow a user to add themselves as admin if they own the project.
DROP POLICY IF EXISTS "Admins can insert members" ON public.project_members;

CREATE POLICY "Admins can insert members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    OR (
      user_id = auth.uid()
      AND role = 'admin'::public.app_role
      AND EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_id AND owner_id = auth.uid()
      )
    )
  );

-- Fix #3: Add explicit foreign keys to public.profiles so PostgREST can
-- auto-join project_members and tasks to profile data (display_name, email).
-- Without these, embedded selects like
--   .select("user_id, profiles(display_name)")
-- error with "Could not find a relationship between ... and 'profiles'".
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_profiles_fkey;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assignee_id_profiles_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_id_profiles_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
