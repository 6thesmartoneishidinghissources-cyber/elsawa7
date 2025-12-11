-- =============================================
-- ELSAWA7 SECURITY & FEATURE MIGRATION
-- =============================================

-- 1. ANOMALIES TABLE for Q Reports
CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hashed TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage anomalies" ON public.anomalies
  FOR ALL USING (is_admin(auth.uid()));

-- 2. ARRIVALS TABLE for driver presence checks
CREATE TABLE IF NOT EXISTS public.arrivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  arrived BOOLEAN NOT NULL DEFAULT false,
  arrival_time TIMESTAMPTZ,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.arrivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert arrivals for their cars" ON public.arrivals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reservations r
      JOIN cars c ON r.car_id = c.id
      WHERE r.id = reservation_id AND c.driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can view arrivals for their cars" ON public.arrivals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reservations r
      JOIN cars c ON r.car_id = c.id
      WHERE r.id = reservation_id AND c.driver_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all arrivals" ON public.arrivals
  FOR ALL USING (is_admin(auth.uid()));

-- 3. ADD COLUMNS TO RESERVATIONS
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS multi_seat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_unallocated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_tx_id TEXT;

-- 4. ADD COLUMN TO PAYMENTS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('paid_unuploaded', 'pending_verification', 'verified', 'rejected');
  END IF;
END $$;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending_verification';

-- 5. RATING PRIVACY - Add passenger_hash column
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS passenger_hash TEXT,
  ADD COLUMN IF NOT EXISTS trip_window_id TEXT;

-- 6. SECURITY DEFINER FUNCTION: log_action (audit logging)
CREATE OR REPLACE FUNCTION public.log_action(
  p_actor_id UUID,
  p_action TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, payload)
  VALUES (p_actor_id, p_action, p_payload)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. SECURITY DEFINER FUNCTION: admin_set_role
CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_target_user_id UUID,
  p_new_role user_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  
  -- Update role
  UPDATE public.profiles 
  SET role = p_new_role 
  WHERE id = p_target_user_id;
  
  -- Log the action
  PERFORM log_action(
    auth.uid(),
    'role_change',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'new_role', p_new_role
    )
  );
  
  RETURN true;
END;
$$;

-- 8. SECURITY DEFINER FUNCTION: driver_queue_for_car (returns phone only)
CREATE OR REPLACE FUNCTION public.driver_queue_for_car(p_car_id UUID)
RETURNS TABLE (
  reservation_id UUID,
  order_number INTEGER,
  passenger_phone TEXT,
  status reservation_status,
  arrived BOOLEAN,
  arrival_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is driver of this car
  IF NOT EXISTS (
    SELECT 1 FROM cars WHERE id = p_car_id AND driver_id = auth.uid()
  ) THEN
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

-- 9. SECURITY DEFINER FUNCTION: passenger_queue_view (returns name only)
CREATE OR REPLACE FUNCTION public.passenger_queue_for_car(p_car_id UUID)
RETURNS TABLE (
  order_number INTEGER,
  passenger_name TEXT,
  status reservation_status
)
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

-- 10. MATERIALIZED VIEW: Driver rating aggregates (privacy-preserving)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.driver_rating_aggregates AS
SELECT 
  driver_id,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as ratings_count,
  ROUND(AVG(rating)::numeric, 2) as avg_rating
FROM public.ratings
GROUP BY driver_id, DATE_TRUNC('day', created_at);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_rating_agg_driver ON public.driver_rating_aggregates(driver_id);

-- 11. FUNCTION: Refresh rating aggregates
CREATE OR REPLACE FUNCTION public.refresh_rating_aggregates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.driver_rating_aggregates;
END;
$$;

-- 12. FUNCTION: Get driver aggregate ratings (public API)
CREATE OR REPLACE FUNCTION public.get_driver_ratings(p_driver_id UUID)
RETURNS TABLE (
  day DATE,
  ratings_count BIGINT,
  avg_rating NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT day::DATE, ratings_count, avg_rating
  FROM public.driver_rating_aggregates
  WHERE driver_id = p_driver_id
  ORDER BY day DESC
  LIMIT 30;
$$;

-- 13. UPDATE RATINGS RLS - Restrict raw access
DROP POLICY IF EXISTS "Anyone can view driver ratings" ON public.ratings;

CREATE POLICY "Only admins can view raw ratings" ON public.ratings
  FOR SELECT USING (is_admin(auth.uid()));

-- 14. FUNCTION: Create anonymous rating with hash
CREATE OR REPLACE FUNCTION public.create_anonymous_rating(
  p_driver_id UUID,
  p_rating INTEGER,
  p_anonymous BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating_id UUID;
  v_passenger_hash TEXT;
  v_salt TEXT := 'elsawa7_rating_salt_2024'; -- In production, use env var
BEGIN
  -- Generate hash if anonymous
  IF p_anonymous THEN
    v_passenger_hash := encode(
      hmac(auth.uid()::text, v_salt, 'sha256'),
      'hex'
    );
  END IF;
  
  INSERT INTO public.ratings (
    driver_id, 
    passenger_id, 
    rating, 
    anonymous,
    passenger_hash,
    trip_window_id
  )
  VALUES (
    p_driver_id,
    auth.uid(),
    p_rating,
    p_anonymous,
    v_passenger_hash,
    DATE_TRUNC('week', now())::TEXT
  )
  RETURNING id INTO v_rating_id;
  
  -- Refresh aggregates
  PERFORM refresh_rating_aggregates();
  
  RETURN v_rating_id;
END;
$$;

-- 15. FUNCTION: Atomic seat reservation
CREATE OR REPLACE FUNCTION public.reserve_seat(
  p_car_id UUID,
  p_passenger_id UUID
)
RETURNS TABLE (
  reservation_id UUID,
  order_number INTEGER,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_current_count INTEGER;
  v_order_num INTEGER;
  v_reservation_id UUID;
BEGIN
  -- Lock the car row to prevent race conditions
  SELECT capacity INTO v_capacity
  FROM cars
  WHERE id = p_car_id
  FOR UPDATE;
  
  IF v_capacity IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, false, 'Car not found'::TEXT;
    RETURN;
  END IF;
  
  -- Get current seat count
  SELECT COUNT(*) INTO v_current_count
  FROM reservations
  WHERE car_id = p_car_id
    AND status IN ('temporary', 'confirmed');
  
  IF v_current_count >= v_capacity THEN
    RETURN QUERY SELECT NULL::UUID, 0, false, 'Car is full'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user already has active reservation
  IF has_active_reservation(p_passenger_id) THEN
    RETURN QUERY SELECT NULL::UUID, 0, false, 'User already has active reservation'::TEXT;
    RETURN;
  END IF;
  
  -- Get next order number
  v_order_num := get_next_order_number(p_car_id);
  
  -- Create reservation
  INSERT INTO reservations (
    car_id,
    passenger_id,
    order_number,
    status,
    expires_at
  )
  VALUES (
    p_car_id,
    p_passenger_id,
    v_order_num,
    'temporary',
    now() + interval '20 minutes'
  )
  RETURNING id INTO v_reservation_id;
  
  RETURN QUERY SELECT v_reservation_id, v_order_num, true, 'Reservation created'::TEXT;
END;
$$;

-- 16. FUNCTION: Expire temporary holds
CREATE OR REPLACE FUNCTION public.expire_temporary_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'temporary'
    AND expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log the expiry action
  IF v_count > 0 THEN
    PERFORM log_action(
      NULL,
      'expire_holds',
      jsonb_build_object('expired_count', v_count)
    );
  END IF;
  
  RETURN v_count;
END;
$$;

-- 17. FUNCTION: Detect anomalies
CREATE OR REPLACE FUNCTION public.detect_anomalies()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_salt TEXT := 'elsawa7_anomaly_salt';
  rec RECORD;
BEGIN
  -- Detect multiple reservations by same user in 24h
  FOR rec IN
    SELECT 
      passenger_id,
      COUNT(*) as reservation_count
    FROM reservations
    WHERE created_at > now() - interval '24 hours'
    GROUP BY passenger_id
    HAVING COUNT(*) > 2
  LOOP
    INSERT INTO anomalies (user_id_hashed, user_id, type, score, details)
    VALUES (
      encode(hmac(rec.passenger_id::text, v_salt, 'sha256'), 'hex'),
      rec.passenger_id,
      'multiple_reservations_24h',
      10,
      jsonb_build_object('count', rec.reservation_count)
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  
  -- Detect low confidence uploads
  FOR rec IN
    SELECT 
      r.passenger_id,
      COUNT(*) as low_conf_count
    FROM reservations r
    WHERE r.low_confidence = true
      AND r.created_at > now() - interval '24 hours'
    GROUP BY r.passenger_id
    HAVING COUNT(*) >= 3
  LOOP
    INSERT INTO anomalies (user_id_hashed, user_id, type, score, details)
    VALUES (
      encode(hmac(rec.passenger_id::text, v_salt, 'sha256'), 'hex'),
      rec.passenger_id,
      'multiple_low_confidence',
      7,
      jsonb_build_object('count', rec.low_conf_count)
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  
  -- Detect paid but unallocated
  FOR rec IN
    SELECT 
      passenger_id,
      COUNT(*) as unalloc_count
    FROM reservations
    WHERE paid_unallocated = true
      AND created_at > now() - interval '24 hours'
    GROUP BY passenger_id
    HAVING COUNT(*) > 1
  LOOP
    INSERT INTO anomalies (user_id_hashed, user_id, type, score, details)
    VALUES (
      encode(hmac(rec.passenger_id::text, v_salt, 'sha256'), 'hex'),
      rec.passenger_id,
      'multiple_paid_unallocated',
      9,
      jsonb_build_object('count', rec.unalloc_count)
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- 18. FUNCTION: Mark arrival
CREATE OR REPLACE FUNCTION public.mark_passenger_arrival(
  p_reservation_id UUID,
  p_arrived BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_car_id UUID;
BEGIN
  -- Get car_id and verify driver owns it
  SELECT r.car_id INTO v_car_id
  FROM reservations r
  JOIN cars c ON r.car_id = c.id
  WHERE r.id = p_reservation_id
    AND c.driver_id = auth.uid();
  
  IF v_car_id IS NULL THEN
    RAISE EXCEPTION 'Access denied or reservation not found';
  END IF;
  
  -- Insert or update arrival
  INSERT INTO arrivals (reservation_id, driver_id, arrived, arrival_time, actor_id)
  VALUES (
    p_reservation_id,
    auth.uid(),
    p_arrived,
    CASE WHEN p_arrived THEN now() ELSE NULL END,
    auth.uid()
  )
  ON CONFLICT (reservation_id) DO UPDATE
  SET arrived = p_arrived,
      arrival_time = CASE WHEN p_arrived THEN now() ELSE NULL END,
      actor_id = auth.uid();
  
  -- Log action
  PERFORM log_action(
    auth.uid(),
    CASE WHEN p_arrived THEN 'mark_arrived' ELSE 'mark_noshow' END,
    jsonb_build_object('reservation_id', p_reservation_id)
  );
  
  RETURN true;
END;
$$;

-- Add unique constraint on arrivals
ALTER TABLE public.arrivals DROP CONSTRAINT IF EXISTS arrivals_reservation_unique;
ALTER TABLE public.arrivals ADD CONSTRAINT arrivals_reservation_unique UNIQUE (reservation_id);

-- 19. Update audit_logs RLS - only system can insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Only system functions can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (false); -- Direct inserts blocked, use log_action()

-- 20. Add index for faster anomaly queries
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON public.anomalies(type);
CREATE INDEX IF NOT EXISTS idx_anomalies_reviewed ON public.anomalies(reviewed);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON public.reservations(expires_at) WHERE status = 'temporary';