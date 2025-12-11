# ElSawa7 Security Documentation

## Overview
This document outlines the security measures implemented in ElSawa7 and provides guidance for maintaining a secure application.

## Implemented Security Measures

### 1. Role-Based Access Control (RBAC)

**Admin Role Protection:**
- Users CANNOT self-assign the admin role during signup
- Frontend only allows `passenger` or `driver` role selection
- Backend (`useAuth.tsx`) sanitizes the role to only accept `passenger` or `driver`
- Admin role can ONLY be assigned via `admin_set_role()` function by existing admins
- All role changes are logged in `audit_logs` table

**Database Functions:**
- `is_admin(user_id)` - Checks if user is admin
- `is_driver(user_id)` - Checks if user is driver
- `admin_set_role(target_user_id, new_role)` - Admin-only role change with logging

### 2. Row-Level Security (RLS) Policies

**Profiles Table:**
- Users can only view/edit their own profile
- Admins can view all profiles
- Drivers can see passenger names only for their reservations (not phone numbers)

**Reservations Table:**
- Passengers can create and view their own reservations
- Drivers can view reservations for their assigned cars
- Admins can manage all reservations

**Ratings Table:**
- Raw ratings accessible only to admins
- Public access via `get_driver_ratings()` returns only aggregated data
- Anonymous ratings store `passenger_hash` (HMAC) instead of cleartext ID

**Audit Logs:**
- Only viewable by admins
- Insertable only via `log_action()` security definer function

### 3. Data Privacy

**Queue View Privacy (Critical):**
- Passengers see: `order_number` + `passenger_name` (NO phone)
- Drivers see: `order_number` + `phone` (NO name)
- Implemented via security definer functions:
  - `passenger_queue_for_car(car_id)` - Returns name only
  - `driver_queue_for_car(car_id)` - Returns phone only

**Rating Privacy:**
- Anonymous ratings use `passenger_hash = HMAC_SHA256(passenger_id, salt)`
- Public API returns daily/weekly aggregates, not individual ratings
- `trip_window_id` groups ratings by time period for aggregate reporting

### 4. Storage Security

**Payment Images Bucket:**
- Configured as PRIVATE bucket
- Access via signed URLs with short expiry (recommended: 600 seconds)
- Admin viewing should use `createSignedUrl()` instead of `getPublicUrl()`

### 5. Edge Function Security

**JWT Enforcement:**
- `verify-payment` - Requires authentication (JWT verified)
- `admin-set-role` - Requires authentication (JWT verified)
- `expire-holds` - No JWT (scheduled job, service role)
- `anomaly-detector` - No JWT (scheduled job, service role)
- `mock-ml-verify` - No JWT (internal testing)

### 6. Anomaly Detection

**Automated Detection Rules:**
- Multiple reservations (>2) in 24 hours
- Multiple low-confidence image uploads (≥3) in 24 hours
- Multiple paid-but-unallocated reservations in 24 hours

**Q Reports Dashboard:**
- Admin-only view of detected anomalies
- One-click "Mark Reviewed" and "Suspend User" actions

## Security Recommendations (Not Yet Implemented)

### 1. Enable Leaked Password Protection
Navigate to Supabase Dashboard → Authentication → Settings → Enable "Leaked Password Protection"

### 2. Rate Limiting
Consider implementing per-user rate limiting on:
- Image uploads
- Reservation creation
- Authentication attempts

### 3. IP-Based Anomaly Detection
Add detection for same-IP creating multiple accounts within short timeframe.

### 4. Signed URL Implementation
Update `PendingPayments.tsx` to use signed URLs:
```typescript
const { data } = await supabase.storage
  .from('payment-images')
  .createSignedUrl(imagePath, 600); // 10 minutes
```

### 5. External Monitoring
- Set up Sentry for error tracking
- Configure alerts for anomaly detection spikes
- Monitor audit logs for suspicious patterns

## API Security Checklist

- [ ] All sensitive endpoints require JWT authentication
- [ ] Role checks performed server-side (not just client-side)
- [ ] Input validation on all user inputs
- [ ] SQL injection prevented via parameterized queries
- [ ] XSS prevented via proper escaping
- [ ] CORS configured appropriately
- [ ] Secrets stored in environment variables, not code

## Reporting Security Issues

If you discover a security vulnerability, please report it to the admin immediately.
Do not disclose security issues publicly until they have been addressed.
