from unittest import TestCase

from app.main import ScheduleRequest, build_schedule


class SchedulerTests(TestCase):
    def test_penalizes_each_teams_unsatisfied_preference(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [
                    {"id": "a", "name": "A", "preferred_slot_ids": ["s2"]},
                    {"id": "b", "name": "B", "preferred_slot_ids": ["s3"]},
                ],
                "slots": [
                    {
                        "id": "s1",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T18:00:00Z",
                        "ends_at": "2026-05-01T20:00:00Z",
                    },
                    {
                        "id": "s2",
                        "field_id": "f1",
                        "starts_at": "2026-05-08T18:00:00Z",
                        "ends_at": "2026-05-08T20:00:00Z",
                    },
                    {
                        "id": "s3",
                        "field_id": "f1",
                        "starts_at": "2026-05-15T18:00:00Z",
                        "ends_at": "2026-05-15T20:00:00Z",
                    },
                ],
            }
        )

        response = build_schedule(request)

        self.assertEqual(response.status, "optimal")
        self.assertEqual(response.matches[0].slot_id, "s2")
        self.assertEqual(response.objective_value, 1011)

    def test_explicit_empty_allowed_slots_means_team_is_unavailable(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [
                    {"id": "a", "name": "A", "allowed_slot_ids": []},
                    {"id": "b", "name": "B", "allowed_slot_ids": ["s1"]},
                ],
                "slots": [
                    {
                        "id": "s1",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T18:00:00Z",
                        "ends_at": "2026-05-01T20:00:00Z",
                    }
                ],
            }
        )

        with self.assertRaisesRegex(
            ValueError, "A and B have no mutually available slot"
        ):
            build_schedule(request)

    def test_generates_a_deterministic_round_robin_without_team_conflicts(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [
                    {"id": "a", "name": "A"},
                    {"id": "b", "name": "B"},
                    {"id": "c", "name": "C"},
                ],
                "slots": [
                    {
                        "id": "s1",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T18:00:00Z",
                        "ends_at": "2026-05-01T20:00:00Z",
                    },
                    {
                        "id": "s2",
                        "field_id": "f1",
                        "starts_at": "2026-05-08T18:00:00Z",
                        "ends_at": "2026-05-08T20:00:00Z",
                    },
                    {
                        "id": "s3",
                        "field_id": "f1",
                        "starts_at": "2026-05-15T18:00:00Z",
                        "ends_at": "2026-05-15T20:00:00Z",
                    },
                ],
            }
        )

        first = build_schedule(request)
        second = build_schedule(request)

        self.assertEqual(first.status, "optimal")
        self.assertEqual(len(first.matches), 3)
        self.assertEqual(first.model_dump(), second.model_dump())
        self.assertEqual(len({match.slot_id for match in first.matches}), 3)

    def test_reports_infeasible_when_weekly_limit_cannot_be_met(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}],
                "slots": [
                    {
                        "id": "s1",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T18:00:00Z",
                        "ends_at": "2026-05-01T20:00:00Z",
                    }
                ],
                "settings": {"games_per_pair": 2, "max_matches_per_team_per_week": 1},
            }
        )

        self.assertEqual(build_schedule(request).status, "infeasible")

    def test_enforces_daily_match_limit(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}],
                "slots": [
                    {
                        "id": "s1",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T10:00:00Z",
                        "ends_at": "2026-05-01T12:00:00Z",
                    },
                    {
                        "id": "s2",
                        "field_id": "f1",
                        "starts_at": "2026-05-01T14:00:00Z",
                        "ends_at": "2026-05-01T16:00:00Z",
                    },
                ],
                "settings": {
                    "games_per_pair": 2,
                    "max_matches_per_team_per_week": 2,
                    "max_matches_per_team_per_day": 1,
                },
            }
        )

        self.assertEqual(build_schedule(request).status, "infeasible")

    def test_excludes_hard_avoided_dates(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}],
                "slots": [
                    {"id": "holiday", "field_id": "f1", "starts_at": "2026-12-25T18:00:00Z", "ends_at": "2026-12-25T20:00:00Z"},
                    {"id": "regular", "field_id": "f1", "starts_at": "2026-12-26T18:00:00Z", "ends_at": "2026-12-26T20:00:00Z"},
                ],
                "excluded_dates": ["2026-12-25"],
            }
        )

        response = build_schedule(request)

        self.assertEqual(response.status, "optimal")
        self.assertEqual(response.matches[0].slot_id, "regular")

    def test_soft_avoided_dates_are_only_used_when_needed(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}],
                "slots": [
                    {"id": "holiday", "field_id": "f1", "starts_at": "2026-12-25T18:00:00Z", "ends_at": "2026-12-25T20:00:00Z"},
                    {"id": "regular", "field_id": "f1", "starts_at": "2026-12-26T18:00:00Z", "ends_at": "2026-12-26T20:00:00Z"},
                ],
                "soft_avoid_dates": ["2026-12-25"],
            }
        )

        response = build_schedule(request)

        self.assertEqual(response.status, "optimal")
        self.assertEqual(response.matches[0].slot_id, "regular")

    def test_preserves_fixed_match_when_optimizing_remaining_fixtures(self):
        request = ScheduleRequest.model_validate(
            {
                "teams": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}, {"id": "c", "name": "C"}],
                "slots": [
                    {"id": "s1", "field_id": "f1", "starts_at": "2026-05-01T18:00:00Z", "ends_at": "2026-05-01T20:00:00Z"},
                    {"id": "s2", "field_id": "f1", "starts_at": "2026-05-08T18:00:00Z", "ends_at": "2026-05-08T20:00:00Z"},
                    {"id": "s3", "field_id": "f1", "starts_at": "2026-05-15T18:00:00Z", "ends_at": "2026-05-15T20:00:00Z"},
                ],
                "fixed_matches": [{"home_team_id": "a", "away_team_id": "b", "slot_id": "s1"}],
            }
        )

        response = build_schedule(request)

        self.assertEqual(response.status, "optimal")
        self.assertEqual(len(response.matches), 3)
        self.assertTrue(any(match.home_team_id == "a" and match.away_team_id == "b" and match.slot_id == "s1" for match in response.matches))
