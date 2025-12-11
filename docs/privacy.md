# ElSawa7 Privacy Documentation

## Overview
This document details the privacy-preserving measures implemented in ElSawa7 to protect user data while maintaining system functionality.

## Privacy Principles

1. **Data Minimization**: Only collect and expose data necessary for each role
2. **Purpose Limitation**: Use data only for its intended purpose
3. **Access Control**: Restrict data access based on role and need

## Implementation Details

### 1. Queue View Privacy

The queue display shows different information based on user role to prevent unnecessary data exposure:

**Passenger View:**
```sql
-- passenger_queue_for_car(car_id)
-- Returns: order_number, passenger_name, status
-- Does NOT return: phone numbers
```

**Driver View:**
```sql
-- driver_queue_for_car(car_id)
-- Returns: order_number, passenger_phone, status, arrived, arrival_time
-- Does NOT return: passenger names
```

This separation ensures:
- Passengers cannot see phone numbers of other passengers
- Drivers cannot see passenger names (only phone for contact)
- Privacy is maintained while allowing necessary operations

### 2. Rating Privacy

#### Problem
Storing direct passenger_id ↔ rating mappings enables:
- Correlation attacks to identify who rated whom
- Travel pattern reconstruction from rating timestamps
- Passenger-driver relationship exposure

#### Solution
When `anonymous = true`:
```sql
passenger_hash = HMAC_SHA256(passenger_id, server_secret_salt)
```

Benefits:
- Duplicate detection (same hash = same passenger)
- No direct ID linkage
- Cannot reverse hash to find passenger

#### Aggregated Access
Public API via `get_driver_ratings()` returns:
```sql
SELECT day::DATE, ratings_count, avg_rating
FROM driver_rating_aggregates
WHERE driver_id = $1
ORDER BY day DESC
LIMIT 30;
```

This provides:
- Daily/weekly aggregates only
- No individual rating timestamps
- No passenger information exposure

### 3. Audit Log Privacy

Audit logs contain:
- Actor ID (who performed action)
- Action type
- Payload (contextual data)

Access is restricted to admins only via RLS policy.

### 4. Profile Data Access

**Standard Users:**
- Can view only their own profile
- Cannot query other users' phone numbers directly

**Drivers:**
- Can see passenger phones via `driver_queue_for_car()` ONLY for their assigned cars
- Cannot directly query profiles table for passenger data

**Admins:**
- Full access for investigation purposes
- Actions logged in audit_logs

### 5. Anomaly Hashing

In the `anomalies` table:
```sql
user_id_hashed = HMAC_SHA256(user_id, anomaly_salt)
```

This allows:
- Pattern detection across anomalies
- Admin review with option to reveal actual user
- Privacy from casual observation

## Data Retention Recommendations

| Data Type | Recommended Retention | Justification |
|-----------|----------------------|---------------|
| Reservations | 1 year | Business records |
| Payments | 7 years | Financial compliance |
| Audit Logs | 2 years | Security investigation |
| Anomalies | 6 months | Fraud detection |
| Ratings | Indefinite (aggregated) | Service quality |

## GDPR Considerations (If Applicable)

1. **Right to Access**: Users can view their own data via profile
2. **Right to Erasure**: Implement delete cascade with consideration for financial records
3. **Data Portability**: Can export user reservations and ratings
4. **Consent**: Obtained during signup for data processing

## Security vs Privacy Trade-offs

| Feature | Security Need | Privacy Impact | Balance |
|---------|--------------|----------------|---------|
| Audit Logs | Track actions | Contains user IDs | Admin-only access |
| Phone Display | Driver contact | Exposes phone | Role-limited view |
| Rating System | Quality control | Links users | Hashing + aggregation |
| Anomaly Detection | Fraud prevention | Tracks patterns | Hashed identifiers |

## Future Improvements

1. **Differential Privacy**: Add noise to public aggregates
2. **Data Anonymization**: Auto-anonymize old records
3. **Consent Management**: Granular opt-in/out controls
4. **Audit Trail**: User-facing activity log
