export type MemberRole = "admin" | "editor" | "viewer";
export type PlaceCategory =
  | "accommodation"
  | "attraction"
  | "restaurant"
  | "other";
export type ChecklistCategory =
  | "documents"
  | "clothing"
  | "electronics"
  | "hygiene"
  | "shared"
  | "todo"
  | "shopping";
export type ChecklistPriority = "high" | "medium" | "low";

/** Google Places API addressComponent structure */
export interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InviteToken {
  id: string;
  trip_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: Profile;
}

export interface Place {
  id: string;
  trip_id: string;
  category: PlaceCategory;
  name: string;
  url: string | null;
  image_urls: string[];
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  rating: number | null;
  memo: string | null;
  price_per_night: number | null;
  cancel_policy: string | null;
  amenities: string[];
  check_in_time: string | null;
  check_out_time: string | null;
  admission_fee: number | null;
  estimated_duration: number | null;
  opening_hours: Record<string, string> | null;
  phone: string | null;
  website: string | null;
  review_count: number | null;
  price_level: number | null;
  price_range: string | null;
  business_status: string | null;
  description: string | null;
  address_components: GoogleAddressComponent[] | null;
  added_by: string;
  created_at: string;
  updated_at: string;
  // Enrichment fields
  source_url: string | null;
  google_place_id: string | null;
  enriched: boolean;
  enriched_at: string | null;
  enrich_error: string | null;
  enrich_attempts: number;
}

/** /api/scrape 응답 타입 (Places API 기반) */
export interface ScrapeResponse {
  name: string;
  category: PlaceCategory;
  url: string;
  address: string | null;
  rating: number | null;
  imageUrl: string | null;
  image_urls: string[];
  memo: string | null;
  phone: string | null;
  website: string | null;
  review_count: number | null;
  price_level: number | null;
  description: string | null;
  opening_hours: Record<string, string> | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  business_status: string | null;
}

export interface PlaceVote {
  id: string;
  trip_id: string;
  place_id: string;
  user_id: string;
  vote_type: number;
  comment: string | null;
  created_at: string;
}

export interface HalfDayWeather {
  weather_code: number;
  label: string;
  icon: string;
  temp: number;
}

export interface WeatherSummary {
  weather_code: number;
  label: string;
  temp_high: number;
  temp_low: number;
  precip_pct: number;
  precip_mm: number;
  icon: string;
  am?: HalfDayWeather;
  pm?: HalfDayWeather;
}

export interface Schedule {
  id: string;
  trip_id: string;
  date: string;
  day_memo: string | null;
  weather_summary: WeatherSummary | null;
  weather_fetched_at: string | null;
  items?: ScheduleItem[];
}

export type TravelMode = "walking" | "transit" | "driving";

export interface ScheduleItem {
  id: string;
  schedule_id: string;
  place_id: string | null;
  title: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  memo: string | null;
  transport_to_next: string | null;
  arrival_by: string | null;
  travel_duration_seconds: number | null;
  travel_distance_meters: number | null;
  travel_mode: TravelMode | null;
  notify_before_minutes: number;
  created_at: string;
  updated_at: string;
  place?: Place;
}

export interface ChecklistItem {
  id: string;
  trip_id: string;
  category: ChecklistCategory;
  title: string;
  is_checked: boolean;
  priority: ChecklistPriority;
  position: number;
  assigned_to: string | null;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
}

export interface ChecklistLog {
  id: string;
  checklist_item_id: string;
  action: "checked" | "unchecked";
  performed_by: string;
  performed_at: string;
  performer?: Profile;
}

export interface ActivityLog {
  id: string;
  trip_id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  actor_name: string | null;
  target_type: string | null;
  target_id: string | null;
  is_read: boolean;
  read_at: string | null;
  activity_log_id: string | null;
  created_at: string;
}
