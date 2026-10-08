-- The scene the GM has shown the table (DECISIONS O1; docs/overhaul.md,
-- phase 8). One nullable column beside the state: the line read out for one
-- reveal, its card and its table entry, so the players' phones can show it.
-- The engine never reads it and GameState never holds it.
--
-- Additive: code that does not know the column ignores it, and the session
-- authority (api/session/[op].ts) checks for it before writing it, so the
-- app can be deployed before or after this runs. Sharing a scene answers
-- "needs the database migrated" until it has.
--
-- Not applied automatically. The Supabase project is shared with other
-- apps; run it there by hand (SQL editor) or through the Supabase MCP's
-- apply_migration, with this file's body and the name
-- maze_sessions_scene. See docs/DEPLOY.md.

alter table public.maze_sessions
  add column if not exists scene jsonb;

-- A scene is a small object or nothing. The authority caps the text at 600
-- characters; this is the floor under that, in case anything else writes.
alter table public.maze_sessions
  drop constraint if exists maze_sessions_scene_small;
alter table public.maze_sessions
  add constraint maze_sessions_scene_small
  check (scene is null or (jsonb_typeof(scene) = 'object' and octet_length(scene::text) <= 2048));

comment on column public.maze_sessions.scene is
  'The scene the GM has shown the table: {key, category, entryId, text}. Narration, never game state.';
