export type EntryMode = "single" | "recurring";

export type Availability = {
  id: string;
  fieldId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldLabel: string;
  permitDate: string;
  startTime: string;
  endTime: string;
  entryType: EntryMode;
  recurringSeriesId: string | null;
  recurringWeekday: number | null;
  seriesStartDate: string | null;
  seriesEndDate: string | null;
};

export type AvailabilityForm = {
  mode: EntryMode;
  venueSearch: string;
  selectedVenueId: string;
  fieldId: string;
  permitDate: string;
  recurringWeekday: string;
  seriesStartDate: string;
  seriesEndDate: string;
  startTime: string;
  endTime: string;
};

export type VenueAvailabilityRow = {
  id: string;
  field_id: string;
  fields: {
    id: string;
    label: string;
    venue_id: string;
    venues: {
      id: string;
      name: string;
      address: string;
      ground_type: string;
      capacity: number;
    } | null;
  } | null;
  permit_date: string;
  permit_start_time: string;
  permit_end_time: string;
  entry_type: EntryMode | null;
  recurring_series_id: string | null;
  recurring_weekday: number | null;
  series_start_date: string | null;
  series_end_date: string | null;
};

export type OccurrenceDraft = {
  fieldId: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldLabel: string;
  permitDate: string;
  startTime: string;
  endTime: string;
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  groundType: string;
  capacity: number;
};

export type Field = {
  id: string;
  venueId: string;
  label: string;
};

export type VenueRow = {
  id: string;
  name: string;
  address: string;
  ground_type: string;
  capacity: number;
};

export type VenueForm = {
  name: string;
  address: string;
  groundType: string;
  capacity: string;
};

export type FieldRow = {
  id: string;
  venue_id: string;
  label: string;
};
