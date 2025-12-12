-- =====================================================
-- ElSawa7 Security Hardening Migration
-- Fix: driver document protection, RLS, rate limiting
-- =====================================================

-- 1. Create driver_documents table for license document metadata
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  mime_type TEXT,
  checksum TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS on driver_documents
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- 2. Create rate_limits table for per-user/IP rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL, -- user_id or IP address
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(subject, endpoint, window_start)
);

-- Enable RLS on rate_limits (service-only access)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 3. Create upload_tokens table for presigned URL tracking
CREATE TABLE IF NOT EXISTS public.upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  file_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on upload_tokens
ALTER TABLE public.upload_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Create failed_login_attempts table for account lockout
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON public.failed_login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip ON public.failed_login_attempts(ip_address, attempted_at);

-- Enable RLS on failed_login_attempts
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Deny public access to sensitive tables
-- =====================================================

-- Driver documents: Only admin/owner can view, drivers can view own
CREATE POLICY "driver_docs_select_own" ON public.driver_documents
  FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "driver_docs_admin_select" ON public.driver_documents
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "driver_docs_insert_own" ON public.driver_documents
  FOR INSERT WITH CHECK (driver_id = auth.uid() AND uploaded_by = auth.uid());

CREATE POLICY "driver_docs_admin_update" ON public.driver_documents
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Rate limits: No direct access (service-only)
CREATE POLICY "rate_limits_deny_all" ON public.rate_limits
  FOR ALL USING (false);

-- Upload tokens: No direct access (service-only)  
CREATE POLICY "upload_tokens_deny_all" ON public.upload_tokens
  FOR ALL USING (false);

-- Failed login attempts: No direct access (service-only)
CREATE POLICY "failed_login_deny_all" ON public.failed_login_attempts
  FOR ALL USING (false);

-- =====================================================
-- Security Definer Functions
-- =====================================================

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_subject TEXT,
  p_endpoint TEXT,
  p_limit INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  -- Calculate current window start
  v_window_start := date_trunc('minute', now());
  
  -- Upsert and get current count
  INSERT INTO rate_limits (subject, endpoint, window_start, request_count)
  VALUES (p_subject, p_endpoint, v_window_start, 1)
  ON CONFLICT (subject, endpoint, window_start) 
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Check if over limit
  RETURN v_current_count <= p_limit;
END;
$$;

-- Function to log access to driver documents
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_actor_id UUID,
  p_doc_id UUID,
  p_action TEXT DEFAULT 'document_view'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, payload, created_at)
  VALUES (p_actor_id, p_action, jsonb_build_object('doc_id', p_doc_id), now());
END;
$$;

-- Function to check if account is locked (too many failed attempts)
CREATE OR REPLACE FUNCTION public.is_account_locked(
  p_email TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= p_max_attempts
  FROM failed_login_attempts
  WHERE email = p_email
    AND attempted_at > now() - (p_window_minutes || ' minutes')::INTERVAL;
$$;

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO failed_login_attempts (email, ip_address, attempted_at)
  VALUES (p_email, p_ip_address, now());
  
  -- Clean up old attempts (older than 24 hours)
  DELETE FROM failed_login_attempts
  WHERE attempted_at < now() - INTERVAL '24 hours';
END;
$$;

-- Function to clear failed login attempts on successful login
CREATE OR REPLACE FUNCTION public.clear_failed_logins(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM failed_login_attempts WHERE email = p_email;
END;
$$;

-- Function to validate and consume upload token
CREATE OR REPLACE FUNCTION public.consume_upload_token(
  p_token_hash TEXT,
  p_user_id UUID
)
RETURNS TABLE(file_key TEXT, bucket TEXT, valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT ut.file_key, ut.bucket, ut.user_id, ut.expires_at, ut.consumed
  INTO v_record
  FROM upload_tokens ut
  WHERE ut.token_hash = p_token_hash
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  IF v_record.user_id != p_user_id THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  IF v_record.consumed OR v_record.expires_at < now() THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  -- Mark as consumed
  UPDATE upload_tokens SET consumed = true WHERE token_hash = p_token_hash;
  
  RETURN QUERY SELECT v_record.file_key, v_record.bucket, true;
END;
$$;

-- Function to create upload token (service-only)
CREATE OR REPLACE FUNCTION public.create_upload_token(
  p_user_id UUID,
  p_file_key TEXT,
  p_bucket TEXT,
  p_expires_minutes INTEGER DEFAULT 5
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
BEGIN
  -- Generate random token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(v_token::bytea), 'hex');
  
  INSERT INTO upload_tokens (token_hash, user_id, file_key, bucket, expires_at)
  VALUES (v_token_hash, p_user_id, p_file_key, p_bucket, now() + (p_expires_minutes || ' minutes')::INTERVAL);
  
  RETURN v_token;
END;
$$;

-- Cleanup expired upload tokens and rate limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Delete expired upload tokens
  DELETE FROM upload_tokens WHERE expires_at < now() OR consumed = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Delete old rate limit records (older than 1 hour)
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '1 hour';
  
  RETURN v_count;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver ON public.driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_subject ON public.rate_limits(subject, endpoint);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_hash ON public.upload_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires ON public.upload_tokens(expires_at) WHERE consumed = false;