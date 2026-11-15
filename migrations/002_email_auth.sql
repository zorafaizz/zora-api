-- Additive email authentication only. No existing account/entitlement updates.
CREATE TABLE auth_email_identities (
 account_id UUID PRIMARY KEY REFERENCES accounts(id), canonical_email VARCHAR(255) UNIQUE NOT NULL,
 approval_id UUID NOT NULL DEFAULT gen_random_uuid(), verified_at TIMESTAMPTZ, enrollment_method TEXT NOT NULL CHECK(enrollment_method IN ('signup','operator')),
 operator_approved_by UUID REFERENCES accounts(id), operator_approved_at TIMESTAMPTZ,
 CHECK(enrollment_method='signup' OR (operator_approved_by IS NOT NULL AND operator_approved_at IS NOT NULL))
);
CREATE TABLE auth_sessions (
 id UUID PRIMARY KEY, token_hash CHAR(64) UNIQUE NOT NULL, token_version INT NOT NULL DEFAULT 1,
 account_id UUID NOT NULL REFERENCES accounts(id), created_at TIMESTAMPTZ NOT NULL,
 last_seen_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 last_verified_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
);
CREATE INDEX auth_sessions_account ON auth_sessions(account_id);
CREATE TABLE auth_flows (
 id UUID PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('preauth','reauth')),
 token_hash CHAR(64) UNIQUE, session_id UUID REFERENCES auth_sessions(id), session_version INT,
 expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
 CHECK((kind='preauth' AND token_hash IS NOT NULL AND session_id IS NULL AND session_version IS NULL)
 OR (kind='reauth' AND token_hash IS NULL AND session_id IS NOT NULL AND session_version IS NOT NULL))
);
CREATE INDEX auth_flows_session ON auth_flows(session_id);
CREATE TABLE auth_email_challenges (
 id UUID PRIMARY KEY, flow_id UUID NOT NULL REFERENCES auth_flows(id),
 canonical_email VARCHAR(255) NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('signin','reauth')),
 code_hmac CHAR(64) NOT NULL, key_version INT NOT NULL DEFAULT 1,
 issued_approval_id UUID, generation INT NOT NULL DEFAULT 1, failures INT NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 5),
 created_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ, send_outcome TEXT NOT NULL DEFAULT 'pending',
 CHECK(expires_at<=created_at+INTERVAL '10 minutes'), UNIQUE(flow_id,canonical_email,purpose)
);
CREATE INDEX auth_challenge_expiry ON auth_email_challenges(expires_at);
CREATE TABLE auth_rate_buckets (
 bucket_hash CHAR(64) PRIMARY KEY, used INT NOT NULL CHECK(used>0), hits BIGINT[] NOT NULL DEFAULT '{}', expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_bucket_expiry ON auth_rate_buckets(expires_at);
CREATE TABLE auth_security_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID REFERENCES accounts(id),
 actor_account_id UUID REFERENCES accounts(id), event TEXT NOT NULL,
 evidence_reference VARCHAR(200), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Non-unique lookup only; historical case variants are never merged.
CREATE INDEX auth_account_email_lookup ON accounts ((lower(btrim(email))));
