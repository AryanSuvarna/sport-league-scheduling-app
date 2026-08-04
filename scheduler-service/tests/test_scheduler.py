from unittest import TestCase

from app.main import ScheduleRequest, build_schedule


class SchedulerTests(TestCase):
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
