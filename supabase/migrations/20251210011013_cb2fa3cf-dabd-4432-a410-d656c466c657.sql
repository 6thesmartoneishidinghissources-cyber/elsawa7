-- Create enums for roles and statuses
CREATE TYPE public.user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'blocked');
CREATE TYPE public.reservation_status AS ENUM ('temporary', 'confirmed', 'cancelled', 'rejected', 'completed');

-- Users table (extends auth.users with app-specific data)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone VARCHAR(20) UNIQUE,
  role user_role NOT NULL DEFAULT 'passenger',
  phone_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Drivers table (additional info for driver role)
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_doc_url TEXT,
  vehicle_plate TEXT,
  status driver_status DEFAULT 'pending',
  avg_rating FLOAT DEFAULT 0,
  completed_trips INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cars table
CREATE TABLE public.cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id),
  title TEXT NOT NULL,
  capacity INT DEFAULT 14 CHECK (capacity <= 14 AND capacity > 0),
  route TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES public.profiles(id),
  car_id UUID NOT NULL REFERENCES public.cars(id),
  order_number INT NOT NULL,
  status reservation_status DEFAULT 'temporary',
  low_confidence BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Payments table (for Vodafone Cash image verification)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ai_confidence FLOAT,
  ocr_text TEXT,
  extracted_fields JSONB,
  admin_confirmed BOOLEAN,
  admin_id UUID REFERENCES public.profiles(id),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  passenger_id UUID NOT NULL REFERENCES public.profiles(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  anonymous BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User roles helper function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = user_id;
$$;

-- Check if user is driver
CREATE OR REPLACE FUNCTION public.is_driver(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'driver' FROM public.profiles WHERE id = user_id;
$$;

-- Get next order number for a car
CREATE OR REPLACE FUNCTION public.get_next_order_number(car_uuid UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(order_number), 0) + 1 FROM public.reservations WHERE car_id = car_uuid;
$$;

-- Check if user has active reservation
CREATE OR REPLACE FUNCTION public.has_active_reservation(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reservations 
    WHERE passenger_id = user_id 
    AND status IN ('temporary', 'confirmed')
  );
$$;

-- Get car current seat count
CREATE OR REPLACE FUNCTION public.get_car_seat_count(car_uuid UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.reservations 
  WHERE car_id = car_uuid 
  AND status IN ('temporary', 'confirmed');
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers can view passenger names for their reservations" ON public.profiles
  FOR SELECT USING (
    public.is_driver(auth.uid()) AND
    id IN (
      SELECT r.passenger_id FROM public.reservations r
      JOIN public.cars c ON r.car_id = c.id
      WHERE c.driver_id = auth.uid()
    )
  );

-- Drivers policies
CREATE POLICY "Drivers can view own driver info" ON public.drivers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Drivers can update own info" ON public.drivers
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own driver record" ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all drivers" ON public.drivers
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update driver status" ON public.drivers
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Cars policies
CREATE POLICY "Everyone can view cars" ON public.cars
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage cars" ON public.cars
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers can update their cars" ON public.cars
  FOR UPDATE USING (driver_id = auth.uid());

-- Reservations policies
CREATE POLICY "Passengers can view own reservations" ON public.reservations
  FOR SELECT USING (passenger_id = auth.uid());

CREATE POLICY "Passengers can create reservations" ON public.reservations
  FOR INSERT WITH CHECK (passenger_id = auth.uid());

CREATE POLICY "Passengers can cancel own reservations" ON public.reservations
  FOR UPDATE USING (passenger_id = auth.uid() AND status = 'temporary');

CREATE POLICY "Admins can view all reservations" ON public.reservations
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reservations" ON public.reservations
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers can view reservations for their cars" ON public.reservations
  FOR SELECT USING (
    car_id IN (SELECT id FROM public.cars WHERE driver_id = auth.uid())
  );

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (
    reservation_id IN (SELECT id FROM public.reservations WHERE passenger_id = auth.uid())
  );

CREATE POLICY "Users can insert payments for own reservations" ON public.payments
  FOR INSERT WITH CHECK (
    reservation_id IN (SELECT id FROM public.reservations WHERE passenger_id = auth.uid())
  );

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Ratings policies
CREATE POLICY "Anyone can view driver ratings" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "Passengers can rate completed trips" ON public.ratings
  FOR INSERT WITH CHECK (
    passenger_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.cars c ON r.car_id = c.id
      WHERE r.passenger_id = auth.uid() 
      AND r.status = 'completed'
      AND c.driver_id = driver_id
    )
  );

-- Audit logs policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Enable realtime for reservations
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- Create storage bucket for payment images
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-images', 'payment-images', false);

-- Storage policies for payment images
CREATE POLICY "Users can upload payment images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own payment images" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all payment images" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-images' AND public.is_admin(auth.uid()));