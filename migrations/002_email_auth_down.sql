DROP INDEX auth_account_email_lookup;
-- Isolated rollback only; production rollback disables AUTH_ENABLED instead.
DROP TABLE auth_security_events;
DROP TABLE auth_rate_buckets;
DROP TABLE auth_email_challenges;
DROP TABLE auth_flows;
DROP TABLE auth_sessions;
DROP TABLE auth_email_identities;
