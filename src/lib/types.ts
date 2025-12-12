export type UserRole = 'passenger' | 'driver' | 'admin' | 'owner';
export type DriverStatus = 'pending' | 'approved' | 'blocked';
export type ReservationStatus = 'temporary' | 'confirmed' | 'cancelled' | 'rejected' | 'completed';

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  phone_verified: boolean;
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: 'passenger' | 'driver' | 'owner' | 'admin';
  assigned_by: string | null;
  assigned_at: string;
}

export interface Driver {
  id: string;
  license_doc_url: string | null;
  vehicle_plate: string | null;
  status: DriverStatus;
  avg_rating: number;
  completed_trips: number;
  created_at: string;
  profiles?: Profile;
}

export interface Car {
  id: string;
  driver_id: string | null;
  owner_id?: string | null;
  title: string;
  capacity: number;
  route: string | null;
  created_at: string;
  drivers?: Driver;
  available_seats?: number;
}

export interface Reservation {
  id: string;
  passenger_id: string;
  car_id: string;
  order_number: number;
  status: ReservationStatus;
  low_confidence: boolean;
  multi_seat?: boolean;
  paid_unallocated?: boolean;
  created_at: string;
  expires_at: string | null;
  profiles?: Profile;
  cars?: Car;
}

export interface Payment {
  id: string;
  reservation_id: string;
  image_url: string;
  ai_confidence: number | null;
  ocr_text: string | null;
  extracted_fields: Record<string, string | null> | null;
  admin_confirmed: boolean | null;
  admin_id: string | null;
  admin_note: string | null;
  payment_status?: string;
  created_at: string;
  reservations?: Reservation;
}

export interface Rating {
  id: string;
  driver_id: string;
  passenger_id: string;
  rating: number;
  anonymous: boolean;
  passenger_hash?: string | null;
  created_at: string;
}

export interface VoteForExtraCar {
  id: string;
  passenger_id: string;
  route: string;
  travel_date: string;
  created_at: string;
  consumed: boolean;
}

export interface TempRegistration {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  requested_role: string;
  created_at: string;
  expires_at: string;
  attempts: number;
  consumed: boolean;
}

export interface VerificationResult {
  is_vodafone_cash: boolean;
  confidence: number;
  ocr_text: string;
  extracted_fields: {
    transaction_id?: string | null;
    amount?: string | null;
    from_phone?: string | null;
    to_phone?: string | null;
  };
  warnings: string[];
}

export interface VoteSummary {
  votes_count: number;
  remaining_to_trigger: number;
  total_needed: number;
}
