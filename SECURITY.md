# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public GitHub issues, discussions, or pull requests.

Instead, email a description of the issue, reproduction steps, and any proof-of-concept code or screenshots to `security@hackerspace.sh`. We will acknowledge receipt within three business days and provide a remediation timeline within seven business days.

If you do not receive a timely response, you may also open a private GitHub Security Advisory at <https://github.com/virgilvox/hackerspace-management/security/advisories/new>.

## Scope

In scope:

- Authentication and authorization bypass
- Tenant isolation failures (cross-space data leaks)
- SQL injection, XSS, CSRF, SSRF
- Secret exposure or weak secret storage
- Insecure default configurations in the deploy scripts

Out of scope:

- Self-XSS that requires user-supplied JavaScript pasted into the browser console
- Issues only reproducible against unsupported runtime versions
- Denial of service achievable by a single authenticated user (rate limiting is a known follow-up; see the audit doc)

## Hardening checklist for self-hosted operators

If you run a self-hosted deployment, you are responsible for the operational security of your installation. At a minimum:

1. Keep the host OS patched. The bootstrap installs unattended-upgrades.
2. Restrict SSH to key-based auth. Root login is disabled by the bootstrap.
3. Run a firewall. The bootstrap configures UFW with ports 22, 80, 443 only.
4. Rotate the Supabase service role key and JWT secret if your `.env` is ever exposed.
5. Monitor the `_migrations_applied` table after deploys.
6. Verify backups by restoring to a staging instance at least quarterly.
7. Use Resend (or another SMTP provider) over plain SMTP with credentials in environment variables, never embedded in code.

## Supported versions

The `main` branch is the supported version. Older tags receive security fixes on a best-effort basis only.
