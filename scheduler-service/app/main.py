"""Deterministic CP-SAT service for league fixture generation."""

from collections import defaultdict
from datetime import datetime
from itertools import combinations
from fastapi import FastAPI, HTTPException
from ortools.sat.python import cp_model
from pydantic import BaseModel, Field, model_validator


class Team(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    # Empty means the team is available in every supplied slot.
    allowed_slot_ids: list[str] = Field(default_factory=list)
    # A preference, never a reason to make an otherwise valid schedule infeasible.
    preferred_slot_ids: list[str] = Field(default_factory=list)


class Slot(BaseModel):
    id: str = Field(min_length=1)
    field_id: str = Field(min_length=1)
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def end_must_follow_start(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class ScheduleSettings(BaseModel):
    games_per_pair: int = Field(default=1, ge=1, le=10)
    max_matches_per_team_per_week: int = Field(default=1, ge=1, le=7)
    min_rest_hours: int = Field(default=0, ge=0, le=168)
    max_solve_seconds: int = Field(default=10, ge=1, le=60)


class ScheduleRequest(BaseModel):
    teams: list[Team] = Field(min_length=2)
    slots: list[Slot] = Field(min_length=1)
    settings: ScheduleSettings = Field(default_factory=ScheduleSettings)

    @model_validator(mode="after")
    def identifiers_must_be_unique(self):
        if len({team.id for team in self.teams}) != len(self.teams):
            raise ValueError("team ids must be unique")
        if len({slot.id for slot in self.slots}) != len(self.slots):
            raise ValueError("slot ids must be unique")
        return self


class ScheduledMatch(BaseModel):
    home_team_id: str
    away_team_id: str
    slot_id: str
    field_id: str
    starts_at: datetime
    ends_at: datetime


class ScheduleResponse(BaseModel):
    status: str
    matches: list[ScheduledMatch]
    objective_value: float | None = None


app = FastAPI(title="League Scheduler", version="0.1.0")


def slots_overlap_or_break_rest(first: Slot, second: Slot, min_rest_hours: int) -> bool:
    """True when a team cannot play in both slots."""
    rest_seconds = min_rest_hours * 60 * 60
    return not (
        first.ends_at.timestamp() + rest_seconds <= second.starts_at.timestamp()
        or second.ends_at.timestamp() + rest_seconds <= first.starts_at.timestamp()
    )


def build_schedule(request: ScheduleRequest) -> ScheduleResponse:
    slot_by_id = {slot.id: slot for slot in request.slots}
    unknown_slots = {
        slot_id
        for team in request.teams
        for slot_id in [*team.allowed_slot_ids, *team.preferred_slot_ids]
        if slot_id not in slot_by_id
    }
    if unknown_slots:
        raise ValueError(f"unknown slot ids: {', '.join(sorted(unknown_slots))}")

    model = cp_model.CpModel()
    # Each pair is represented separately for each repeat. Two home/away directions
    # are provided so the solver can balance home games as a soft objective.
    fixtures = [
        (home, away, repeat)
        for home, away in combinations(request.teams, 2)
        for repeat in range(request.settings.games_per_pair)
    ]
    decisions: dict[tuple[int, int, bool], cp_model.IntVar] = {}
    variables_by_slot: dict[str, list[cp_model.IntVar]] = defaultdict(list)
    variables_by_team_slot: dict[tuple[str, str], list[cp_model.IntVar]] = defaultdict(list)
    preference_penalties: list[cp_model.LinearExpr] = []

    for fixture_index, (first, second, _) in enumerate(fixtures):
        fixture_variables: list[cp_model.IntVar] = []
        first_allowed = set(first.allowed_slot_ids)
        second_allowed = set(second.allowed_slot_ids)
        for slot_index, slot in enumerate(request.slots):
            if (first_allowed and slot.id not in first_allowed) or (
                second_allowed and slot.id not in second_allowed
            ):
                continue
            for first_is_home in (True, False):
                variable = model.new_bool_var(
                    f"match_{fixture_index}_slot_{slot_index}_home_{first_is_home}"
                )
                decisions[fixture_index, slot_index, first_is_home] = variable
                fixture_variables.append(variable)
                variables_by_slot[slot.id].append(variable)
                variables_by_team_slot[first.id, slot.id].append(variable)
                variables_by_team_slot[second.id, slot.id].append(variable)
                # A preferred slot is weighted strongly, then the earlier supplied
                # slots provide a stable deterministic tie-breaker.
                if (first.preferred_slot_ids and slot.id not in first.preferred_slot_ids) or (
                    second.preferred_slot_ids and slot.id not in second.preferred_slot_ids
                ):
                    preference_penalties.append(variable * 1_000)
                preference_penalties.append(variable * slot_index)
        if not fixture_variables:
            raise ValueError(
                f"{first.name} and {second.name} have no mutually available slot"
            )
        model.add_exactly_one(fixture_variables)

    for slot in request.slots:
        model.add(sum(variables_by_slot[slot.id]) <= slot.capacity)

    # Capacity can be greater than one, but a team can never use more than one
    # simultaneous position within that capacity.
    for variables in variables_by_team_slot.values():
        model.add(sum(variables) <= 1)

    # A team cannot have overlapping games, including its configured recovery time.
    for team in request.teams:
        for first_slot, second_slot in combinations(request.slots, 2):
            if slots_overlap_or_break_rest(
                first_slot, second_slot, request.settings.min_rest_hours
            ):
                model.add(
                    sum(variables_by_team_slot[team.id, first_slot.id])
                    + sum(variables_by_team_slot[team.id, second_slot.id])
                    <= 1
                )

    weekly_variables: dict[tuple[str, int, int], list[cp_model.IntVar]] = defaultdict(list)
    for (team_id, slot_id), variables in variables_by_team_slot.items():
        date = slot_by_id[slot_id].starts_at.date()
        iso_year, iso_week, _ = date.isocalendar()
        weekly_variables[team_id, iso_year, iso_week].extend(variables)
    for variables in weekly_variables.values():
        model.add(sum(variables) <= request.settings.max_matches_per_team_per_week)

    # Give home/away balance a lower priority than team preferences.
    home_counts: list[cp_model.IntVar] = []
    for team in request.teams:
        home_variables = []
        for fixture_index, (first, second, _) in enumerate(fixtures):
            for slot_index in range(len(request.slots)):
                if first.id == team.id and (fixture_index, slot_index, True) in decisions:
                    home_variables.append(decisions[fixture_index, slot_index, True])
                if second.id == team.id and (fixture_index, slot_index, False) in decisions:
                    home_variables.append(decisions[fixture_index, slot_index, False])
        home_count = model.new_int_var(0, len(fixtures), f"home_count_{team.id}")
        model.add(home_count == sum(home_variables))
        home_counts.append(home_count)

    maximum_home_games = model.new_int_var(0, len(fixtures), "maximum_home_games")
    minimum_home_games = model.new_int_var(0, len(fixtures), "minimum_home_games")
    home_spread = model.new_int_var(0, len(fixtures), "home_spread")
    model.add_max_equality(maximum_home_games, home_counts)
    model.add_min_equality(minimum_home_games, home_counts)
    model.add(home_spread == maximum_home_games - minimum_home_games)
    model.minimize(sum(preference_penalties) + home_spread * 10)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.settings.max_solve_seconds
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    if status == cp_model.INFEASIBLE:
        return ScheduleResponse(status="infeasible", matches=[])
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleResponse(status="unknown", matches=[])

    matches: list[ScheduledMatch] = []
    for fixture_index, (first, second, _) in enumerate(fixtures):
        for slot_index, slot in enumerate(request.slots):
            for first_is_home in (True, False):
                variable = decisions.get((fixture_index, slot_index, first_is_home))
                if variable is not None and solver.boolean_value(variable):
                    home, away = (first, second) if first_is_home else (second, first)
                    matches.append(
                        ScheduledMatch(
                            home_team_id=home.id,
                            away_team_id=away.id,
                            slot_id=slot.id,
                            field_id=slot.field_id,
                            starts_at=slot.starts_at,
                            ends_at=slot.ends_at,
                        )
                    )

    matches.sort(key=lambda match: (match.starts_at, match.slot_id, match.home_team_id))
    return ScheduleResponse(
        status="optimal" if status == cp_model.OPTIMAL else "feasible",
        matches=matches,
        objective_value=solver.objective_value,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/schedules:generate", response_model=ScheduleResponse)
def generate_schedule(request: ScheduleRequest) -> ScheduleResponse:
    try:
        return build_schedule(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
