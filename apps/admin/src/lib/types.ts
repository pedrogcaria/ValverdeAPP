export type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  country: string | null;
  comments: string | null;
  rating: number | null;
  created_at: string;
};

export type Reservation = {
  id: string;
  guest_id: string | null;
  legacy_id: string | null;
  source: 'manual' | 'site' | 'booking' | 'airbnb' | 'direct' | 'other';
  channel: string | null;
  booking_reference: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  total_amount: number | string | null;
  commission_amount: number | string | null;
  payment_method: string | null;
  payment_status: 'not_paid' | 'partial' | 'paid';
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  private_notes: string | null;
  special_requests: unknown;
  cleaning_checklist: unknown;
  deposit_amount: number | string | null;
  deposit_received_on: string | null;
  deposit_returned_on: string | null;
  deposit_status: 'received' | 'returned' | 'partially_returned' | 'pending' | null;
  deposit_notes: string | null;
  created_at: string;
  guests?: Guest | null;
};

export type Expense = {
  id: string;
  reservation_id: string | null;
  category: string;
  amount: number | string;
  occurred_on: string | null;
  description: string | null;
  paid_to: string | null;
  is_paid: boolean;
  paid_on: string | null;
  is_automatic: boolean;
  automation_source: string | null;
  created_at: string;
  reservations?: Pick<Reservation, 'id' | 'booking_reference' | 'check_in' | 'check_out'> | null;
};

export type BookingRequest = {
  id: string;
  reservation_id: string | null;
  status: 'new' | 'contacted' | 'accepted' | 'declined' | 'spam';
  full_name: string;
  email: string;
  phone: string;
  guests_count: number;
  check_in: string;
  check_out: string;
  heated_pool: boolean;
  promo_code: string | null;
  estimated_base_amount: number | string;
  estimated_pool_amount: number | string;
  estimated_promo_amount: number | string;
  estimated_total_amount: number | string;
  direct_discount_percent: number | string;
  promo_discount_percent: number | string;
  guest_message: string | null;
  notification_status: 'pending' | 'sent' | 'failed';
  notification_error: string | null;
  created_at: string;
};

export type SeasonalRate = {
  id: string;
  starts_on: string;
  ends_on: string;
  booking_reference_nightly_price: number | string | null;
  direct_nightly_price: number | string;
  active: boolean;
};

export type PromoCode = {
  id: string;
  code: string;
  discount_percent: number | string;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
};

export type PropertySettings = {
  id: string;
  property_name: string;
  minimum_nights: number;
  heated_pool_weekly_price: number | string;
  direct_discount_percent: number | string;
  currency: string;
  timezone: string;
};

export type AdminData = {
  settings: PropertySettings | null;
  guests: Guest[];
  reservations: Reservation[];
  expenses: Expense[];
  requests: BookingRequest[];
  rates: SeasonalRate[];
  promoCodes: PromoCode[];
};

export type Screen = 'dashboard' | 'requests' | 'reservations' | 'expenses' | 'guests' | 'reports' | 'settings';
