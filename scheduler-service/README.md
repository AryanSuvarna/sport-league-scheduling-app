# League scheduling service

This service uses Google OR-Tools CP-SAT to generate deterministic league fixtures.

## Run locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8001
```

Run its tests with:

```bash
.venv/bin/python -m unittest discover -s tests
```

## API

`POST /v1/schedules:generate` accepts this shape:

```json
{
  "teams": [{"id": "team-a", "name": "Team A", "allowed_slot_ids": ["slot-1"]}],
  "slots": [{"id": "slot-1", "field_id": "field-1", "starts_at": "2026-05-01T18:00:00Z", "ends_at": "2026-05-01T20:00:00Z"}],
  "settings": {"games_per_pair": 1, "max_matches_per_team_per_week": 1, "max_matches_per_team_per_day": 1, "min_rest_hours": 24}
}
```

`allowed_slot_ids` is a hard constraint. If it is omitted or `null`, the team may
play in every submitted slot; an explicit empty list means the team cannot play
in any submitted slot. `preferred_slot_ids` is optimized but never makes a
schedule impossible.

The solver always uses one worker and a fixed random seed, so equal inputs produce equal output. A `status` of `infeasible` means the supplied hard constraints have no solution.

## Next.js integration

1. Run [`../supabase/schedules.sql`](../supabase/schedules.sql) in the Supabase SQL editor.
2. Deploy this service and set `SCHEDULER_SERVICE_URL` in the Next.js environment, for example `http://127.0.0.1:8001` locally.
3. Request `POST /api/leagues/:leagueId/schedule` from the Next.js app. Its optional JSON body accepts `{ "gamesPerPair": 1, "maxMatchesPerTeamPerDay": 1, "minRestHours": 0 }`.

The adapter finds the latest availability submission for each `league_teams.id`. It returns `409` and lists the teams that have not submitted availability, rather than scheduling them without one.
