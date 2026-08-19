"use client";

import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { Calendar, dayjsLocalizer, type EventProps, type View } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import type { EditorMatch, ScheduleIssue } from "@/lib/scheduling/editor";

const localizer = dayjsLocalizer(dayjs);
const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar);

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  match: EditorMatch;
  issues: ScheduleIssue[];
};

type Props = {
  matches: EditorMatch[];
  issueByMatch: Map<string, ScheduleIssue[]>;
  disabled: boolean;
  onSelect: (matchId: string) => void;
  onMove: (matchId: string, startsAt: string, fieldId: string) => Promise<void>;
};

export function BigCalendar({ matches, issueByMatch, disabled, onSelect, onMove }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>("month");
  const events = useMemo<CalendarEvent[]>(
    () => matches.flatMap((match) => {
      if (!match.starts_at || !match.ends_at || !match.field_id) return [];
      const start = new Date(match.starts_at);
      const end = new Date(match.ends_at);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
      return [{ id: match.id, title: `${match.home_team_name} vs ${match.away_team_name}`, start, end, match, issues: issueByMatch.get(match.id) ?? [] }];
    }),
    [issueByMatch, matches],
  );

  function saveMove({ event, start }: EventInteractionArgs<CalendarEvent>) {
    if (disabled || event.match.is_locked) return;
    const startDate = start instanceof Date ? start : new Date(start);
    if (Number.isNaN(startDate.getTime())) return;
    const startsAt = formatLocalDateTime(startDate);
    void onMove(event.id, startsAt, event.match.field_id!);
  }

  return <div className="schedule-big-calendar rounded-md border border-[#d6ded5] bg-white p-3 sm:p-4">
    <DragAndDropCalendar
      localizer={localizer}
      events={events}
      views={["month", "week", "day"] as View[]}
      date={date}
      view={view}
      onNavigate={(nextDate) => setDate(nextDate)}
      onView={(nextView) => setView(nextView)}
      startAccessor="start"
      endAccessor="end"
      selectable
      draggableAccessor={(event) => !disabled && !event.match.is_locked}
      resizable={!disabled}
      resizableAccessor={(event) => !disabled && !event.match.is_locked}
      onEventDrop={saveMove}
      onEventResize={saveMove}
      onSelectEvent={(event) => onSelect(event.id)}
      eventPropGetter={(event) => ({ className: event.issues.some((issue) => issue.severity === "conflict") ? "rbc-event-conflict" : event.issues.length ? "rbc-event-warning" : "rbc-event-ready" })}
      components={{ event: MatchEvent }}
      style={{ height: 720 }}
      popup
    />
  </div>;
}

function MatchEvent({ event }: EventProps<CalendarEvent>) {
  const issue = event.issues.find((item) => item.severity === "conflict") ?? event.issues[0];
  return <div className="min-w-0 text-xs leading-tight"><div className="truncate font-bold">{event.match.home_team_name} vs {event.match.away_team_name}</div><div className="truncate opacity-90">{event.match.venue_name} / {event.match.field_label}</div>{event.match.is_locked ? <span className="font-semibold">Locked</span> : issue ? <span className="font-semibold">{issue.severity === "conflict" ? "Conflict" : "Warning"}</span> : null}</div>;
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
