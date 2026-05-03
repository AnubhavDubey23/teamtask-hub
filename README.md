# TeamTask Hub

A full-stack team collaboration app for managing projects and tasks with role-based access.

## Features

- **Authentication** — Email/password signup and login with persistent sessions
- **Per-project roles** — Admin (full control) and Member (view + own task updates)
- **Projects** — Create projects, invite teammates via shareable links
- **Tasks** — Title, description, priority, status, due date, assignee
- **Two views** — Sortable table list and drag-and-drop Kanban board
- **Dashboard** — Live stats (Total / In Progress / Done / Overdue) and your assigned tasks
- **Row-level security** — All data access enforced at the database layer

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Row-Level Security)
- **Drag & Drop:** dnd-kit
- **Forms & Validation:** react-hook-form, Zod
- **Deployment:** Railway

## Local Development

```bash
git clone https://github.com/AnubhavDubey23/teamtask-hub.git
cd teamtask-hub
npm install
cp .env.example .env   # then fill in your Supabase credentials
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/publishable key |

### Database Setup

All schema, RLS policies, triggers, and functions live in [`supabase/migrations/`](./supabase/migrations).
Run them in order against a fresh Supabase project (via the Supabase CLI or the SQL editor).

## Project Structure

```
src/
  components/     Reusable UI (TaskDialog, KanbanBoard, AppSidebar, etc.)
  pages/          Route-level pages (Dashboard, Projects, ProjectDetail, etc.)
  lib/            Auth context, badge helpers, utilities
  integrations/   Supabase client
supabase/
  migrations/     Sequenced SQL migrations (schema + RLS + triggers)
```

## Deployment

This project deploys as a static Vite build served via [`serve`](https://www.npmjs.com/package/serve).
On Railway, set the two environment variables above and deploy from GitHub — the Procfile handles the rest.

## License

MIT
