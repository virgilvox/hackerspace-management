-- =============================================================================
-- Seed data for local development
-- =============================================================================
-- Loads a demo space populated with offline members (no auth.users rows),
-- tasks, a project, a knowledge-base entry, a policy, three proposals in
-- different states, and an incident. Activity log entries reflect the work.
--
-- Run AFTER schema.sql + migrations:
--   psql "$DATABASE_URL" -f scripts/seed.sql
-- Or via Supabase CLI:
--   supabase db reset && psql "$DATABASE_URL" -f scripts/seed.sql
--
-- Idempotent: ON CONFLICT DO NOTHING on the seed UUIDs.
-- Wipes itself first by deleting rows scoped to the seed space_id.
-- =============================================================================

DO $$
DECLARE
  v_space_id        uuid := '11111111-1111-1111-1111-111111111111';
  v_alice_id        uuid := '22222222-2222-2222-2222-222222222221'; -- admin
  v_bob_id          uuid := '22222222-2222-2222-2222-222222222222'; -- board
  v_carla_id        uuid := '22222222-2222-2222-2222-222222222223'; -- treasurer
  v_dan_id          uuid := '22222222-2222-2222-2222-222222222224'; -- member
  v_eve_id          uuid := '22222222-2222-2222-2222-222222222225'; -- associate
  v_policy_id       uuid := '33333333-3333-3333-3333-333333333331';
  v_proposal_open   uuid := '44444444-4444-4444-4444-444444444441';
  v_proposal_draft  uuid := '44444444-4444-4444-4444-444444444442';
  v_proposal_done   uuid := '44444444-4444-4444-4444-444444444443';
  v_incident_id     uuid := '55555555-5555-5555-5555-555555555551';
  v_task_open       uuid := '66666666-6666-6666-6666-666666666661';
  v_task_chore      uuid := '66666666-6666-6666-6666-666666666662';
  v_task_done       uuid := '66666666-6666-6666-6666-666666666663';
  v_project_id      uuid := '77777777-7777-7777-7777-777777777771';
BEGIN
  -- Wipe prior seed (idempotent).
  DELETE FROM public.proposal_votes WHERE proposal_id IN (v_proposal_open, v_proposal_draft, v_proposal_done);
  DELETE FROM public.incident_updates WHERE incident_id = v_incident_id;
  DELETE FROM public.proposals WHERE space_id = v_space_id;
  DELETE FROM public.incidents WHERE space_id = v_space_id;
  DELETE FROM public.policies WHERE space_id = v_space_id;
  DELETE FROM public.tasks WHERE space_id = v_space_id;
  DELETE FROM public.projects WHERE space_id = v_space_id;
  DELETE FROM public.knowledge_base WHERE space_id = v_space_id;
  DELETE FROM public.activity_log WHERE space_id = v_space_id;
  DELETE FROM public.comms_channels WHERE space_id = v_space_id;
  DELETE FROM public.space_members WHERE space_id = v_space_id;
  DELETE FROM public.spaces WHERE id = v_space_id;

  -- Space
  INSERT INTO public.spaces (
    id, name, slug, city, invite_code, require_approval, mission_statement,
    financial_visibility, member_directory_visibility,
    default_quorum_percent, default_quorum_floor, default_voting_window_hours,
    default_threshold, incident_sla_hours
  ) VALUES (
    v_space_id, 'Demo Hackerspace', 'demo', 'Mesa, AZ', 'DEMO-2026-TEST', true,
    'A community-driven hackerspace committed to radical inclusivity, open tools, and shared stewardship.',
    'board_visible', 'members_visible',
    10, 2, 216, 'simple_majority', 72
  );

  -- Members (all offline — no user_id; real signups via invite code attach later).
  INSERT INTO public.space_members (
    id, space_id, user_id, role, tier, status, approved,
    display_name, handle, email, phone, has_card_access,
    skills, interests, willing_to, affiliations, coi_last_disclosed_at
  ) VALUES
    (v_alice_id, v_space_id, NULL, 'admin', 'plus', 'current', true,
     'Alice Admin', 'alice', 'alice@demo.local', '+1 555 0101', true,
     ARRAY['electronics','laser','3d printing'], ARRAY['cnc','robotics'],
     ARRAY['board_candidate','docs_steward'],
     ARRAY['ACME Robotics, contractor'], now() - interval '60 days'),
    (v_bob_id, v_space_id, NULL, 'board', 'plus', 'current', true,
     'Bob Board', 'bob', 'bob@demo.local', '+1 555 0102', true,
     ARRAY['welding','metal shop'], ARRAY['blacksmithing'],
     ARRAY['safety_committee','event_organizer'],
     ARRAY[]::text[], NULL),
    (v_carla_id, v_space_id, NULL, 'treasurer', 'plus', 'current', true,
     'Carla Treasurer', 'carla', 'carla@demo.local', '+1 555 0103', false,
     ARRAY['accounting','grant writing'], ARRAY['nonprofit law'],
     ARRAY['treasurer_candidate'],
     ARRAY['Local Credit Union, board'], now() - interval '15 days'),
    (v_dan_id, v_space_id, NULL, 'member', 'basic', 'current', true,
     'Dan Maker', 'dan', 'dan@demo.local', '+1 555 0104', true,
     ARRAY['woodshop','laser','arduino'], ARRAY['guitars','furniture'],
     ARRAY['host_volunteer','area_lead_candidate'],
     ARRAY[]::text[], NULL),
    (v_eve_id, v_space_id, NULL, 'associate', 'associate', 'current', true,
     'Eve Visitor', 'eve', 'eve@demo.local', NULL, false,
     ARRAY['photography'], ARRAY[]::text[],
     ARRAY[]::text[],
     ARRAY[]::text[], NULL);

  -- The spaces trigger already created default comms channels (general,
  -- announcements, ops). No additional channel inserts needed.

  -- Policies (one active v1, with a clear plain-language summary).
  INSERT INTO public.policies (
    id, space_id, slug, section_ref, title,
    body_plain, body_formal,
    version, status, effective_at
  ) VALUES (
    v_policy_id, v_space_id, 'code-of-conduct', '1', 'Code of Conduct',
    'Be excellent to each other. No harassment, no theft, no unsafe behavior. Disagreements are resolved through proposals or through a board incident report. If you see a problem, file an incident.',
    E'## Article 1. Purpose\n\nThe Demo Hackerspace is a community workshop for makers, hackers, artists, and learners of all backgrounds.\n\n## Article 2. Conduct\n\n1. **Respect.** Treat every member, guest, and visitor with respect.\n2. **Safety.** Follow station-specific safety guidance. Do not operate equipment you have not been signed off on.\n3. **Stewardship.** Clean up after yourself. Report broken or unsafe equipment.\n\n## Article 3. Enforcement\n\nViolations are reported via the **Incidents** workflow. The board acknowledges within 72 hours and decides within 14 days. Members may appeal a dismissal to a membership vote per Article 4.\n\n## Article 4. Appeal\n\nAny member whose incident report is dismissed by the board may petition the membership for a vote. The petition opens an **Appeal** proposal; passage requires simple majority of cast votes with quorum of 10% or 2 members, whichever is greater.',
    1, 'active', now() - interval '90 days'
  );

  -- Tasks (a mix).
  INSERT INTO public.tasks (
    id, space_id, title, description, task_type, status, area, recurrence,
    requested_by_name, claimed_by_name, due_date, created_at
  ) VALUES
    (v_task_open, v_space_id, 'Wipe down laser cutter bed',
     'Acetone + lint-free cloth. Check the honeycomb for stuck bits.',
     'chore', 'open', 'Laser', 'weekly',
     'Alice Admin', NULL, now() + interval '2 days', now() - interval '1 day'),
    (v_task_chore, v_space_id, 'Empty trash bins',
     'All three bins by the door. Recycling goes in the blue bin.',
     'chore', 'claimed', 'Facilities', 'weekly',
     'Bob Board', 'Dan Maker', now() + interval '12 hours', now() - interval '3 days'),
    (v_task_done, v_space_id, 'Reorder filament',
     'PETG, black. Hatchbox 1kg. Reimburse via Carla.',
     'task', 'completed', '3D Printing', 'none',
     'Dan Maker', NULL, NULL, now() - interval '7 days');

  -- A project.
  INSERT INTO public.projects (
    id, space_id, title, description, area, status, tags, assignee_names
  ) VALUES (
    v_project_id, v_space_id, 'CNC mount for the woodshop bench',
     'Build a removable plate so the small CNC can share the workbench with hand work.',
     'Woodshop', 'in_progress', ARRAY['fab','urgent'],
     ARRAY['Dan Maker','Bob Board']
  );

  -- A knowledge-base entry.
  INSERT INTO public.knowledge_base (
    space_id, title, content, area, visibility, is_pinned,
    updated_by_name, tags
  ) VALUES (
    v_space_id, 'Door system: the incantations',
    E'The door fob system runs on `mqtt://door.local`.\n\n1. Add a new fob: scan in the admin app, paste the serial into Members > Edit.\n2. Disable a fob: flip `has_card_access` to false on the member row.\n3. If the door is stuck, power-cycle the relay module behind the bookcase.\n\nIf the entire system is down, the manual override key is in the lockbox by the back door. Code is on the wiki under "Door". This is not a secret; it is the failover.',
    'Facilities', 'all_members', true,
    'Alice Admin', ARRAY['door','access','infra']
  );

  -- An OPEN proposal (members can vote on it).
  INSERT INTO public.proposals (
    id, space_id, proposer_id, proposer_name, title, body,
    proposal_type, status, threshold,
    voting_opens_at, voting_closes_at
  ) VALUES (
    v_proposal_open, v_space_id, v_dan_id, 'Dan Maker',
    'Adopt a quarterly equipment-budget review',
    E'## Why\n\nWe spend on equipment without a regular review. Last year we duplicated a $400 saw and let a $1200 laser tube go uncovered for two months.\n\n## What I propose\n\n- Every quarter, the treasurer publishes a one-page equipment-budget report to /financials.\n- The board votes to allocate the next quarter''s budget.\n- Members can submit equipment requests via a Tasks-style queue.\n\n## Cost\n\nZero. Procedural change only.',
    'board_action', 'open', 'simple_majority',
    now() - interval '3 days', now() + interval '6 days'
  );

  -- A DRAFT proposal (not yet open for voting).
  INSERT INTO public.proposals (
    id, space_id, proposer_id, proposer_name, title, body,
    proposal_type, status, threshold,
    voting_opens_at, voting_closes_at
  ) VALUES (
    v_proposal_draft, v_space_id, v_alice_id, 'Alice Admin',
    'Bylaw change: raise quorum floor to 5',
    'Currently quorum floor is 2. Proposing 5 to better reflect membership growth. This is a draft — please leave comments before I open voting.',
    'bylaw_change', 'draft', 'two_thirds',
    NULL, NULL
  );

  -- A DECIDED proposal (showcasing the archive).
  INSERT INTO public.proposals (
    id, space_id, proposer_id, proposer_name, title, body,
    proposal_type, status, threshold,
    voting_opens_at, voting_closes_at, decided_at
  ) VALUES (
    v_proposal_done, v_space_id, v_bob_id, 'Bob Board',
    'Approve June facility deep-clean budget of $400',
    E'## Scope\n\nProfessional clean of the woodshop, electronics area, and bathroom. Bid from "ACME Cleaning" is $400 flat.\n\n## Why\n\nWe have not had a professional clean in 11 months. Member-volunteer cleans cover surface only.',
    'budget', 'decided', 'simple_majority',
    now() - interval '20 days', now() - interval '11 days', now() - interval '10 days'
  );

  -- Votes on the open and decided proposals.
  INSERT INTO public.proposal_votes (proposal_id, member_id, position, comment) VALUES
    (v_proposal_open, v_alice_id, 'yes', 'Strongly support.'),
    (v_proposal_open, v_bob_id,   'yes', 'Yes.'),
    (v_proposal_open, v_carla_id, 'abstain', 'Will share data once a quarter regardless.'),
    (v_proposal_done, v_alice_id, 'yes', NULL),
    (v_proposal_done, v_bob_id,   'yes', NULL),
    (v_proposal_done, v_carla_id, 'yes', 'Money is set aside.'),
    (v_proposal_done, v_dan_id,   'no',  'Prefer member volunteer day instead.');

  -- An open incident.
  INSERT INTO public.incidents (
    id, space_id, reporter_id, is_anonymous,
    category, severity, title, body, status, subjects
  ) VALUES (
    v_incident_id, v_space_id, v_dan_id, false,
    'safety', 'high', 'Saw left running unattended in the woodshop on Friday',
    E'On Friday around 10pm I came in to use the woodshop. The 14" bandsaw was running with nobody nearby. I shut it off and left a note on the whiteboard.\n\nNo damage done, but this is a safety policy violation and I want it on record.',
    'received', ARRAY[]::uuid[]
  );

  -- Seed activity log so the dashboard has recent activity to show.
  INSERT INTO public.activity_log (space_id, user_id, display_name, action, entity_type, entity_id, details, created_at) VALUES
    (v_space_id, NULL, 'Alice Admin',   'created',  'policy',   v_policy_id,      'Code of Conduct v1',    now() - interval '90 days'),
    (v_space_id, NULL, 'Bob Board',     'logged',   'payment',  NULL,             '$120 cash dues',         now() - interval '12 days'),
    (v_space_id, NULL, 'Dan Maker',     'created',  'task',     v_task_open,      'Wipe down laser cutter', now() - interval '1 day'),
    (v_space_id, NULL, 'Dan Maker',     'claimed',  'task',     v_task_chore,     NULL,                     now() - interval '2 days'),
    (v_space_id, NULL, 'Dan Maker',     'completed','task',     v_task_done,      NULL,                     now() - interval '6 days'),
    (v_space_id, NULL, 'Bob Board',     'opened',   'proposal', v_proposal_open,  'Quarterly budget review',now() - interval '3 days'),
    (v_space_id, NULL, 'Dan Maker',     'voted',    'proposal', v_proposal_open,  'yes',                    now() - interval '2 days'),
    (v_space_id, NULL, 'Dan Maker',     'filed',    'incident', v_incident_id,    'Saw left running',       now() - interval '6 hours');

  RAISE NOTICE 'Seed loaded. Space: % | invite code: DEMO-2026-TEST', v_space_id;
END $$;
