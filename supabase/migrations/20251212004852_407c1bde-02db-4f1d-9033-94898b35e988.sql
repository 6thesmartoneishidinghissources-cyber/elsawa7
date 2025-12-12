-- ============================================================
-- ELSAWA7 SECURITY OVERHAUL: Roles in Separate Table + Voting
-- ============================================================

-- 1. Create role enum for user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('passenger', 'driver', 'owner', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create user_roles table (CRITICAL: roles separate from profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'passenger',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create temp_registrations table (staging, no effect on main users)
CREATE TABLE IF NOT EXISTS public.temp_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  name TEXT,
  requested_role TEXT CHECK (requested_role IN ('passenger', 'driver')) DEFAULT 'passenger',
  verification_code_email TEXT, -- hashed
  verification_code_sms TEXT, -- hashed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now() + interval '24 hours',
  error_reason TEXT,
  attempts INT DEFAULT 0,
  source TEXT DEFAULT 'web',
  ip_address TEXT,
  device_fingerprint TEXT,
  consumed BOOLEAN DEFAULT false
);

-- Enable RLS on temp_registrations
ALTER TABLE public.temp_registrations ENABLE ROW LEVEL SECURITY;

-- 4. Create votes_for_extra_cars table
CREATE TABLE IF NOT EXISTS public.votes_for_extra_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route TEXT NOT NULL,
  travel_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  consumed BOOLEAN DEFAULT false,
  UNIQUE (passenger_id, route, travel_date)
);

-- Enable RLS on votes
ALTER TABLE public.votes_for_extra_cars ENABLE ROW LEVEL SECURITY;

-- 5. Add owner_id column to cars table if not exists
DO $$ BEGIN
  ALTER TABLE public.cars ADD COLUMN owner_id UUID REFERENCES public.profiles(id);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

-- 6. Function to check if user has a specific role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(user_id, 'owner');
$$;

-- 8. Updated is_admin to use new user_roles table
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(user_id, 'admin') OR public.has_role(user_id, 'owner');
$$;

-- 9. Get user's primary role from user_roles table
CREATE OR REPLACE FUNCTION public.get_user_role_v2(user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_roles.user_id = get_user_role_v2.user_id
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'driver' THEN 3 
      ELSE 4 
    END
  LIMIT 1;
$$;

-- 10. Secure admin_set_role that uses user_roles table
CREATE OR REPLACE FUNCTION public.admin_set_role_v2(p_target_user_id UUID, p_new_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owner can assign admin/owner roles
  IF p_new_role IN ('admin', 'owner') AND NOT is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can assign admin or owner roles';
  END IF;
  
  -- Admin can assign passenger/driver roles
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  
  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (p_target_user_id, p_new_role, auth.uid())
  ON CONFLICT (user_id, role) DO UPDATE SET 
    assigned_by = auth.uid(),
    assigned_at = now();
  
  -- Log the action
  PERFORM log_action(
    auth.uid(),
    'role_change_v2',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'new_role', p_new_role
    )
  );
  
  RETURN true;
END;
$$;

-- 11. Passenger queue view function (returns name only, no phone)
CREATE OR REPLACE FUNCTION public.passenger_queue_for_car(p_car_id UUID)
RETURNS TABLE(order_number INT, passenger_name TEXT, status reservation_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.order_number,
    p.name as passenger_name,
    r.status
  FROM reservations r
  JOIN profiles p ON r.passenger_id = p.id
  WHERE r.car_id = p_car_id
    AND r.status IN ('temporary', 'confirmed')
  ORDER BY r.order_number ASC;
END;
$$;

-- 12. Driver queue function (returns phone only, no name) - more secure version
CREATE OR REPLACE FUNCTION public.driver_queue_for_car(p_car_id UUID)
RETURNS TABLE(reservation_id UUID, order_number INT, passenger_phone TEXT, status reservation_status, arrived BOOLEAN, arrival_time TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is driver of this car OR is admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM cars WHERE id = p_car_id AND driver_id = auth.uid()
  ) AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not driver of this car';
  END IF;
  
  RETURN QUERY
  SELECT 
    r.id as reservation_id,
    r.order_number,
    p.phone::TEXT as passenger_phone,
    r.status,
    COALESCE(a.arrived, false) as arrived,
    a.arrival_time
  FROM reservations r
  JOIN profiles p ON r.passenger_id = p.id
  LEFT JOIN arrivals a ON a.reservation_id = r.id
  WHERE r.car_id = p_car_id
    AND r.status IN ('temporary', 'confirmed')
  ORDER BY r.order_number ASC;
END;
$$;

-- 13. Vote for extra car function
CREATE OR REPLACE FUNCTION public.vote_for_extra_car(p_route TEXT, p_travel_date DATE)
RETURNS TABLE(votes_count BIGINT, remaining_to_trigger INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_passenger_id UUID := auth.uid();
  v_count BIGINT;
BEGIN
  -- Check if user already has active reservation for this route/date
  IF EXISTS (
    SELECT 1 FROM reservations r
    JOIN cars c ON r.car_id = c.id
    WHERE r.passenger_id = v_passenger_id
      AND c.route = p_route
      AND r.status IN ('temporary', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'You already have a reservation for this route';
  END IF;
  
  -- Insert vote (unique constraint prevents duplicates)
  INSERT INTO votes_for_extra_cars (passenger_id, route, travel_date)
  VALUES (v_passenger_id, p_route, p_travel_date)
  ON CONFLICT (passenger_id, route, travel_date) DO NOTHING;
  
  -- Get current count
  SELECT COUNT(*) INTO v_count
  FROM votes_for_extra_cars
  WHERE route = p_route 
    AND travel_date = p_travel_date
    AND consumed = false;
  
  RETURN QUERY SELECT v_count, GREATEST(0, 14 - v_count::INT);
END;
$$;

-- 14. Get vote summary (public aggregated data)
CREATE OR REPLACE FUNCTION public.get_vote_summary(p_route TEXT, p_travel_date DATE)
RETURNS TABLE(votes_count BIGINT, remaining_to_trigger INT, total_needed INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::BIGINT as votes_count,
    GREATEST(0, 14 - COUNT(*)::INT) as remaining_to_trigger,
    14 as total_needed
  FROM votes_for_extra_cars
  WHERE route = p_route 
    AND travel_date = p_travel_date
    AND consumed = false;
$$;

-- 15. Owner accept extra car function
CREATE OR REPLACE FUNCTION public.owner_accept_extra_car(p_route TEXT, p_travel_date DATE, p_car_title TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_car_id UUID;
  v_voter RECORD;
  v_order INT := 0;
BEGIN
  -- Only owner can accept
  IF NOT is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner can accept extra car requests';
  END IF;
  
  -- Create new car
  INSERT INTO cars (title, route, capacity, owner_id)
  VALUES (p_car_title, p_route, 14, auth.uid())
  RETURNING id INTO v_car_id;
  
  -- Assign first 14 voters to the car
  FOR v_voter IN
    SELECT passenger_id
    FROM votes_for_extra_cars
    WHERE route = p_route 
      AND travel_date = p_travel_date
      AND consumed = false
    ORDER BY created_at ASC
    LIMIT 14
  LOOP
    v_order := v_order + 1;
    
    -- Create reservation for voter
    INSERT INTO reservations (car_id, passenger_id, order_number, status)
    VALUES (v_car_id, v_voter.passenger_id, v_order, 'confirmed');
    
    -- Mark vote as consumed
    UPDATE votes_for_extra_cars
    SET consumed = true
    WHERE passenger_id = v_voter.passenger_id
      AND route = p_route
      AND travel_date = p_travel_date;
  END LOOP;
  
  -- Log action
  PERFORM log_action(
    auth.uid(),
    'owner_accept_extra_car',
    jsonb_build_object(
      'route', p_route,
      'travel_date', p_travel_date,
      'car_id', v_car_id,
      'seats_assigned', v_order
    )
  );
  
  RETURN v_car_id;
END;
$$;

-- 16. Cleanup temp registrations function
CREATE OR REPLACE FUNCTION public.cleanup_temp_registrations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM temp_registrations
  WHERE expires_at < now() OR consumed = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 17. Cleanup expired votes function
CREATE OR REPLACE FUNCTION public.cleanup_expired_votes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM votes_for_extra_cars
  WHERE travel_date < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only through function for role changes" ON public.user_roles;
CREATE POLICY "Only through function for role changes" ON public.user_roles
FOR ALL USING (false);

-- temp_registrations policies (no direct access)
DROP POLICY IF EXISTS "No direct access to temp_registrations" ON public.temp_registrations;
CREATE POLICY "No direct access to temp_registrations" ON public.temp_registrations
FOR ALL USING (false);

-- votes_for_extra_cars policies
DROP POLICY IF EXISTS "Users can insert own votes" ON public.votes_for_extra_cars;
CREATE POLICY "Users can insert own votes" ON public.votes_for_extra_cars
FOR INSERT WITH CHECK (passenger_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own votes" ON public.votes_for_extra_cars;
CREATE POLICY "Users can view own votes" ON public.votes_for_extra_cars
FOR SELECT USING (passenger_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all votes" ON public.votes_for_extra_cars;
CREATE POLICY "Admins can view all votes" ON public.votes_for_extra_cars
FOR SELECT USING (is_admin(auth.uid()));

-- Strengthen profiles RLS - prevent phone/email leakage
DROP POLICY IF EXISTS "Drivers can view passenger names for their reservations" ON public.profiles;

-- Create new restrictive policy for drivers
CREATE POLICY "Drivers view limited passenger info via function only"
ON public.profiles
FOR SELECT
USING (
  -- Users can always see their own profile
  auth.uid() = id
  OR is_admin(auth.uid())
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_votes_route_date ON public.votes_for_extra_cars(route, travel_date) WHERE consumed = false;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_registrations_email ON public.temp_registrations(email) WHERE consumed = false;
CREATE INDEX IF NOT EXISTS idx_temp_registrations_expires ON public.temp_registrations(expires_at) WHERE consumed = false;