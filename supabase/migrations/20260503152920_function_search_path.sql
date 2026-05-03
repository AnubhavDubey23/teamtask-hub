
-- Revoke broad execute privileges on internal/trigger functions
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_project() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_project_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- accept_invite must remain callable by signed-in users
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
