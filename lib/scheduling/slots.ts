export type VenuePermitForSlot = {
  id: string;
  field_id: string;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  capacity: number;
};

export type VenueSlot = {
  id: string;
  field_id: string;
  source_permit_id: string;
  starts_at: string;
  ends_at: string;
  date: string;
  capacity: number;
};

function addMinutes(date: string, time: string, minutes: number) {
  const value = new Date(`${date}T${time.slice(0, 8)}`);
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function formatLocalDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function buildVenueSlots(
  permits: VenuePermitForSlot[],
  matchDurationMinutes: number,
): VenueSlot[] {
  return permits.flatMap((permit) => {
    const start = addMinutes(permit.permit_date, permit.permit_start_time, 0);
    const end = addMinutes(permit.permit_date, permit.permit_end_time, 0);
    const slots: VenueSlot[] = [];

    for (
      let cursor = start;
      cursor.getTime() + matchDurationMinutes * 60_000 <= end.getTime();
      cursor = new Date(cursor.getTime() + matchDurationMinutes * 60_000)
    ) {
      const slotEnd = new Date(cursor.getTime() + matchDurationMinutes * 60_000);
      slots.push({
        id: `${permit.id}:${formatLocalDateTime(cursor)}`,
        field_id: permit.field_id,
        source_permit_id: permit.id,
        starts_at: formatLocalDateTime(cursor),
        ends_at: formatLocalDateTime(slotEnd),
        date: permit.permit_date,
        capacity: permit.capacity,
      });
    }

    return slots;
  });
}

export function timestampToSlotId(
  permitId: string | null,
  startsAt: string,
  slots: VenueSlot[],
) {
  const normalized = startsAt.replace(/\.\d+Z?$/, "").slice(0, 19);
  return (
    slots.find(
      (slot) =>
        slot.source_permit_id === permitId &&
        slot.starts_at.replace(/\.\d+Z?$/, "").slice(0, 19) === normalized,
    )?.id ?? null
  );
}
