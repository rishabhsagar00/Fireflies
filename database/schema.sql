-- Fireflies Commitments · PostgreSQL schema
-- Safe to run many times (the backend runs it on every start).
-- Times are team-local strings "YYYY-MM-DDTHH:MM" and dates are "YYYY-MM-DD",
-- because reminders follow the team's wall clock (9:30 AM, Friday 5:30 PM).

create table if not exists teams (
  id           text primary key,
  name         text not null,
  channel      text not null default 'slack' check (channel in ('slack', 'teams', 'email')),
  tracker      text not null default 'none'  check (tracker in ('jira', 'asana', 'none')),
  tracker_key  text not null default '',          -- prefix for simulated issue keys when Jira is not connected
  manager      text not null,
  sort         int  not null default 0
);

create table if not exists members (
  team_id  text not null references teams(id) on delete cascade,
  name     text not null,
  email    text not null,
  sort     int  not null default 0,
  primary key (team_id, name)
);

-- What Fireflies already gives us after a meeting: title, summary, transcript.
create table if not exists meetings (
  id          text primary key,
  team_id     text not null references teams(id) on delete cascade,
  title       text not null,
  date        text not null,
  start_time  text not null default '',
  mins        int  not null default 0,
  overview    jsonb not null default '[]',   -- summary bullet points
  keywords    jsonb not null default '[]',
  lines       jsonb not null default '[]',   -- transcript: [[time, speaker, text], ...]
  source      text not null default 'seed',  -- seed | import
  created_at  timestamptz not null default now()
);
-- recurring meetings: the series they belong to, when the next one starts, and whether that next
-- meeting's pre-meeting nudges and recap were already sent (added later; safe on an existing database)
alter table meetings add column if not exists series      text not null default '';
alter table meetings add column if not exists next_at     text not null default '';
alter table meetings add column if not exists nudged_at   text not null default '';
alter table meetings add column if not exists recapped_at text not null default '';
alter table meetings add column if not exists next_topic  text not null default '';
-- the next meeting of the series while it runs: pre-read, who joined, and the meeting chat (JSON)
alter table meetings add column if not exists live        text not null default '';

-- One row per commitment. A reassigned commitment keeps its row (status Reassigned)
-- and the new owner gets a child row (parent = original id).
create table if not exists commitments (
  id           text primary key,
  meeting_id   text not null references meetings(id) on delete cascade,
  team_id      text not null references teams(id) on delete cascade,
  seq          int  not null default 0,
  text         text not null,
  owner        text not null default '',
  pending      text not null default '',     -- who was asked to take it over
  said         text not null default '',     -- the due date as spoken ("in 2 days")
  due          text not null default '',
  dep          text not null default '',     -- id of the commitment this one waits on
  status       text not null check (status in ('Suggested','Confirmed','Waiting','PendingAccept','Done','Dropped','Reassigned','NotCommitment','Unclaimed')),
  prev_status  text not null default '',
  trk          text not null default '',     -- Jira / Asana key
  trk_closed   boolean not null default false,
  quote        text not null default '',
  history      jsonb not null default '[]',  -- [[time, text], ...]
  tlog         jsonb not null default '[]',  -- tracker log [[time, text], ...]
  sent         jsonb not null default '[]',  -- reminders already sent: confirm, headsup, due, overdue
  snooze       int  not null default 0,
  bounces      int  not null default 0,      -- failed hand-overs
  sent_at      text not null default '',     -- when it was sent for confirmation
  pending_at   text not null default '',     -- when the hand-over was asked
  moved_from   text not null default '',
  last_via     text not null default '',     -- Slack | Teams | Email | Jira | Fireflies
  last_at      text not null default '',
  parent       text not null default '',
  token        text not null,                -- secret for Teams/email action links
  updated_at   timestamptz not null default now()
);
create index if not exists commitments_team_idx on commitments(team_id);
create index if not exists commitments_trk_idx on commitments(trk);

-- Every notification Fireflies sent (or would send) to a person.
create table if not exists messages (
  id             serial primary key,
  to_name        text  not null,
  kind           text  not null,
  cids           jsonb not null default '[]',
  at             text  not null,
  meeting_id     text  not null default '',
  extra          jsonb not null default '{}',
  channel        text  not null default 'slack',
  delivery       text  not null default '',
  delivered      boolean not null default false,
  slack_channel  text  not null default '',
  slack_ts       text  not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists messages_to_idx on messages(to_name);

-- Small key/value settings: demo clock offset, demo routing, counters, webhook secret.
create table if not exists app_state (
  key    text primary key,
  value  jsonb not null
);
