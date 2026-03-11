export type MemberRole = "admin" | "editor" | "viewer";
export type PlaceCategory =
  | "accommodation"
  | "attraction"
  | "restaurant"
  | "other";
export type ExpenseCategory =
  | "accommodation"
  | "food"
  | "transport"
  | "activity"
  | "shopping"
  | "other";
export type CurrencyCode = "KRW" | "JPY" | "USD" | "EUR" | "CNY" | "THB" | "VND";

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

export interface PlaceVote {
  id: string;
  place_id: string;
  user_id: string;
  vote_type: number;
  comment: string | null;
  created_at: string;
}

export interface Schedule {
  id: string;
  trip_id: string;
  date: string;
  day_memo: string | null;
  items?: ScheduleItem[];
}

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
  created_at: string;
  updated_at: string;
  place?: Place;
}

export interface Budget {
  id: string;
  trip_id: string;
  total_budget: number;
  currency: CurrencyCode;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: CurrencyCode;
  paid_by: string;
  date: string;
  memo: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Settlement {
  id: string;
  trip_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  is_settled: boolean;
  created_at: string;
}

export interface TripJournal {
  id: string;
  trip_id: string;
  author_id: string;
  date: string;
  content: string | null;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
  profile?: Profile;
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
