-- Server-only data access. Browser clients use the authenticated Next.js API;
-- anonymous Supabase keys never receive private documents, secrets or scores.
begin;
create table if not exists public.rooms (
 code text not null check (code ~ '^[0-9]{4}$'),
 id uuid primary key,
 active boolean not null default true,
 revision bigint not null default 0,
 document jsonb not null,
 updated_at timestamptz not null default now(),
 check (document->>'code' = code),
 check ((document->>'id')::uuid = id)
);
create unique index if not exists active_room_code on public.rooms(code) where active;
create table if not exists public.members (
 id uuid primary key, room_id uuid not null references public.rooms(id) on delete cascade,
 normalized_nickname text not null, removed boolean not null default false, document jsonb not null
);
create unique index if not exists active_member_nickname on public.members(room_id,normalized_nickname) where not removed;
create table if not exists public.member_sessions (
 member_id uuid primary key references public.members(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64)
);
create table if not exists public.teams (id uuid primary key,room_id uuid not null references public.rooms(id) on delete cascade,document jsonb not null);
create table if not exists public.team_memberships (member_id uuid primary key references public.members(id) on delete cascade,team_id uuid not null references public.teams(id) on delete cascade);
create table if not exists public.room_invites (room_id uuid primary key references public.rooms(id) on delete cascade,allow_join boolean not null default true);
create table if not exists public.party_playlists (room_id uuid primary key references public.rooms(id) on delete cascade,items jsonb not null default '[]');
create table if not exists public.game_sessions (id uuid primary key,room_id uuid not null references public.rooms(id) on delete cascade,game_id text not null,document jsonb not null);
create table if not exists public.rounds (id uuid primary key,game_session_id uuid not null references public.game_sessions(id) on delete cascade,document jsonb not null);
create table if not exists public.submissions (round_id uuid not null references public.rounds(id) on delete cascade,member_id uuid not null references public.members(id) on delete cascade,document jsonb not null,primary key(round_id,member_id));
create table if not exists public.question_bank (question_id text primary key,version integer not null default 1,enabled boolean not null default true,document jsonb not null);
create table if not exists public.question_secrets (question_id text primary key references public.question_bank(question_id) on delete cascade,answer text not null,accepted_aliases jsonb not null default '[]',metadata jsonb not null default '{}');
create table if not exists public.score_events (
 id uuid primary key,room_id uuid not null references public.rooms(id),game_session_id uuid,round_id uuid,
 target uuid not null,layer text not null check(layer in ('raw','party')),delta numeric not null,
 reason text not null,operator uuid not null,rule_version text not null,created_at timestamptz not null,
 inverse_of uuid unique references public.score_events(id)
);
create index if not exists score_room on public.score_events(room_id);
create table if not exists public.skill_events (id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rooms(id),member_id uuid not null,game_session_id uuid not null,round_id uuid not null,ability text not null,value numeric not null,unique(member_id,round_id,ability));
create table if not exists public.host_transfer_votes (room_id uuid not null references public.rooms(id) on delete cascade,election_round integer not null,voter uuid not null,candidate uuid not null,primary key(room_id,election_round,voter));
-- Immutable accounting, including service-role writes. Corrections are inverse events.
create or replace function public.reject_score_mutation() returns trigger language plpgsql as $$begin raise exception 'Score ledger is append-only'; end;$$;
drop trigger if exists immutable_scores on public.score_events;
create trigger immutable_scores before update or delete on public.score_events for each row execute function public.reject_score_mutation();
create or replace function public.read_party_room(p_code text) returns jsonb language sql security definer set search_path=public as $$select jsonb_build_object('revision',revision,'document',document) from public.rooms where code=p_code and active$$;
create or replace function public.save_party_room(p_code text,p_expected bigint,p_document jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer; item jsonb; g jsonb; r jsonb; entry record; old_id uuid; rid uuid; old_revision bigint; old_document jsonb;
begin
 if p_code !~ '^[0-9]{4}$' or p_document->>'code'<>p_code then raise exception 'Invalid room code'; end if;
 rid := (p_document->>'id')::uuid;
 if p_expected = -1 then
  insert into public.rooms(code,id,revision,document) values(p_code,rid,0,p_document) on conflict(code) where active do nothing;
  get diagnostics affected=row_count; if affected=0 then return false; end if;
 else
  select id,(document->>'revision')::bigint,document into old_id,old_revision,old_document from public.rooms where code=p_code and active and revision=p_expected for update;
  if not found then return false; end if;
  if old_id<>rid then
   if old_document->>'status'<>'ended' and (old_document->>'expiresAt')::numeric>extract(epoch from now())*1000 then return false; end if;
   update public.rooms set active=false where id=old_id;
   insert into public.rooms(code,id,revision,document) values(p_code,rid,0,p_document);
  else
   update public.rooms set revision=revision+1,document=p_document,updated_at=now() where code=p_code and active and revision=p_expected;
   if old_revision=(p_document->>'revision')::bigint and jsonb_array_length(p_document->'members')=(select count(*) from public.members where room_id=rid) then return true; end if;
  end if;
 end if;
 for item in select * from jsonb_array_elements(p_document->'members') loop
  insert into public.members values((item->>'id')::uuid,rid,item->>'normalized',(item->>'removed')::boolean,item-'tokenHash') on conflict(id) do update set document=excluded.document,removed=excluded.removed;
  insert into public.member_sessions values((item->>'id')::uuid,item->>'tokenHash') on conflict(member_id) do nothing;
 end loop;
 for item in select * from jsonb_array_elements(p_document->'teams') loop
  insert into public.teams values((item->>'id')::uuid,rid,item) on conflict(id) do update set document=excluded.document;
 end loop;
 delete from public.team_memberships where member_id in (select id from public.members where room_id=rid);
 for item in select * from jsonb_array_elements(p_document->'members') loop
  if item->>'teamId' is not null then insert into public.team_memberships values((item->>'id')::uuid,(item->>'teamId')::uuid); end if;
 end loop;
 insert into public.room_invites values(rid,(p_document->>'allowJoin')::boolean) on conflict(room_id) do update set allow_join=excluded.allow_join;
 insert into public.party_playlists values(rid,p_document->'playlist') on conflict(room_id) do update set items=excluded.items;
 for g in select * from jsonb_array_elements((p_document->'history') || case when p_document->'game'='null'::jsonb then '[]'::jsonb else jsonb_build_array(p_document->'game') end) loop
  insert into public.game_sessions values((g->>'id')::uuid,rid,g->>'gameId',g) on conflict(id) do update set document=excluded.document;
  for r in select * from jsonb_array_elements((g->'rounds')||jsonb_build_array(g->'round')) loop
   insert into public.rounds values((r->>'id')::uuid,(g->>'id')::uuid,r) on conflict(id) do update set document=excluded.document;
   for entry in select * from jsonb_each(r->'submissions') loop
    insert into public.submissions values((r->>'id')::uuid,entry.key::uuid,entry.value) on conflict(round_id,member_id) do update set document=excluded.document;
   end loop;
  end loop;
 end loop;
 for item in select * from jsonb_array_elements(p_document->'ledger') loop
  insert into public.score_events values((item->>'id')::uuid,rid,(item->>'gameSessionId')::uuid,(item->>'roundId')::uuid,(item->>'target')::uuid,item->>'layer',(item->>'delta')::numeric,item->>'reason',(item->>'operator')::uuid,item->>'ruleVersion',to_timestamp((item->>'timestamp')::numeric/1000),(item->>'inverseOf')::uuid) on conflict(id) do nothing;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(p_document->'skillEvents','[]'::jsonb)) loop
  insert into public.skill_events(id,room_id,member_id,game_session_id,round_id,ability,value) values((item->>'id')::uuid,rid,(item->>'memberId')::uuid,(item->>'gameId')::uuid,(item->>'roundId')::uuid,item->>'ability',(item->>'value')::numeric) on conflict do nothing;
 end loop;
 if p_document->'election'<>'null'::jsonb then
  for entry in select * from jsonb_each_text(p_document->'election'->'votes') loop
   insert into public.host_transfer_votes values(rid,(p_document->'election'->>'round')::integer,entry.key::uuid,entry.value::uuid) on conflict(room_id,election_round,voter) do update set candidate=excluded.candidate;
  end loop;
 end if;
 return true;
end;$$;
-- No browser table policies: all access is denied under RLS. API validates
-- HttpOnly room sessions and host ownership, then uses the server service role.
do $$declare t text; begin foreach t in array array['rooms','room_invites','members','member_sessions','teams','team_memberships','party_playlists','game_sessions','rounds','submissions','question_bank','question_secrets','score_events','skill_events','host_transfer_votes'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop; end;$$;
revoke all on function public.read_party_room(text) from public,anon,authenticated;
revoke all on function public.save_party_room(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.read_party_room(text) to service_role;
grant execute on function public.save_party_room(text,bigint,jsonb) to service_role;
commit;
