# DevSecOps — Potential Judge Questions & Answers

## 1. How do you manage secrets and API keys in your deployment?

**Answer:** We follow the 12-factor app methodology — secrets are never hardcoded or committed to version control. Our `.gitignore` excludes all `.env` files. In production:
- **Render (backend):** Secrets like `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are stored as encrypted environment variables in Render's dashboard, marked as `sync: false` in our `render.yaml` so they must be set manually.
- **Vercel (frontend):** Only the Supabase anon key (a public key by design) is exposed via `VITE_` prefixed env vars.
- **Supabase:** Row Level Security (RLS) policies ensure the anon key can only access data the authenticated user owns.

**Key principle:** The Supabase service role key (admin access) is only on the backend — it never reaches the browser.

---

## 2. Explain your authentication and authorization mechanism.

**Answer:** We use **Supabase Auth** which implements:
- **JWT-based authentication** — after login, the client receives a signed JWT access token
- **Token validation** — every protected API endpoint validates the JWT via a `get_current_user` middleware dependency
- **Row Level Security (RLS)** — Supabase enforces database-level access control, so even if an API bug exists, users can only access their own data
- **Session management** — tokens are stored in the browser via Supabase's client library (uses `localStorage` with automatic refresh)

Authorization flow:
1. User signs up/logs in → Supabase issues JWT
2. Frontend sends `Authorization: Bearer <token>` on every API call
3. Backend middleware decodes + verifies the JWT
4. User ID from JWT is used to scope all database queries

---

## 3. How do you prevent OWASP Top 10 vulnerabilities?

**Answer:**

| Vulnerability | Mitigation |
|---|---|
| **A01 - Broken Access Control** | JWT auth on every endpoint + RLS in Supabase ensures users can only access their own data |
| **A02 - Cryptographic Failures** | All traffic over HTTPS (enforced by Vercel/Render). Secrets in env vars, never in code |
| **A03 - Injection** | Supabase client uses parameterized queries. User-submitted code runs in isolated temp directories with subprocess (no shell=True), inside a Docker container |
| **A04 - Insecure Design** | Principle of least privilege — frontend only has anon key, backend has service role key |
| **A05 - Security Misconfiguration** | CORS restricted to specific origins. Security headers (X-Frame-Options, X-Content-Type-Options) set via Vercel |
| **A06 - Vulnerable Components** | Dependencies pinned to specific versions in `requirements.txt` and `package-lock.json` |
| **A07 - Auth Failures** | Supabase handles password hashing (bcrypt), rate-limits login attempts |
| **A08 - Data Integrity** | Code execution runs in isolated temp dirs with timeouts — cannot affect application state |
| **A09 - Logging Failures** | Structured logging via Python `logging` module. Errors captured with full tracebacks |
| **A10 - SSRF** | Backend only makes outbound calls to known, whitelisted services (Groq, OpenRouter, Piston, Supabase) |

---

## 4. How is user-submitted code executed safely?

**Answer:** We use a **built-in subprocess-based code executor** that runs user code with multiple safety layers:
- **Isolated temp directories** — each execution gets its own `tempfile.TemporaryDirectory()` that is automatically cleaned up
- **Strict execution timeouts** (10 seconds) — prevents infinite loops. Uses `asyncio.wait_for()` and kills the process on timeout
- **Python isolation flag** (`-I`) — prevents the script from importing modules from the working directory or modifying `sys.path`
- **No shell execution** — code runs via `asyncio.create_subprocess_exec()` (not `shell=True`), preventing shell injection
- **Containerized deployment** — on Render, the entire backend runs in a Docker container, adding an OS-level isolation layer
- **Stateless execution** — temp files are deleted after each run; no user code persists on disk

For a single-user educational platform, this provides the right balance of security and simplicity. For a multi-tenant production platform, you would add Linux namespaces (nsjail/firejail) or use a dedicated sandbox like Judge0.

---

## 5. What is your CI/CD pipeline?

**Answer:** We use a **Git-based CI/CD** workflow:

1. **Source Control:** GitHub repository with `.gitignore` excluding secrets
2. **Backend (Render):** Auto-deploys on push to `main` branch
   - Render installs dependencies from `requirements.txt`
   - Starts uvicorn with production settings (`DEBUG=false`)
3. **Frontend (Vercel):** Auto-deploys on push to `main` branch
   - Runs `npm run build` (Vite production build with tree-shaking, code splitting, minification)
   - Deploys to global CDN
4. **Environment separation:** Different env vars for development (local `.env`) vs production (platform dashboards)

**Future improvements we'd add:**
- GitHub Actions for automated testing before deploy
- Dependency vulnerability scanning with `pip-audit` and `npm audit`
- Branch protection rules requiring PR reviews

---

## 6. How do you ensure secure communication between services?

**Answer:** All inter-service communication uses **HTTPS/TLS**:

```
Browser ──HTTPS──▶ Vercel CDN ──HTTPS──▶ Render Backend ──HTTPS──▶ Supabase
                                              │
                                              ├──HTTPS──▶ Groq API
                                              ├──HTTPS──▶ OpenRouter API
                                              └── (code execution runs locally via subprocess)
```

- **Vercel** enforces HTTPS with automatic SSL certificates
- **Render** provides automatic TLS termination
- **Supabase, Groq, OpenRouter, Piston** all use HTTPS endpoints
- **No HTTP** endpoints are exposed in production
- **CORS** restricts which origins can call the backend API

---

## 7. How do you handle input validation?

**Answer:** We validate at multiple layers:

1. **API layer (Pydantic models):** Every request body is validated using Pydantic's `BaseModel`. Invalid data is rejected with a 422 error before reaching business logic. Example: `RunRequest` enforces `code: str` and `language: str`.

2. **Authentication layer:** JWT tokens are cryptographically verified. Missing or invalid tokens return 401/403.

3. **Business logic layer:** Route handlers verify ownership (e.g., "is this your problem?") before executing actions.

4. **Database layer:** Supabase RLS policies act as a final safety net — even if application code has a bug, the database enforces access control.

---

## 8. What monitoring and logging strategy do you have?

**Answer:**
- **Structured logging:** Python's `logging` module with format: `timestamp | level | module | message`
- **Global exception handler:** FastAPI catches all unhandled exceptions, logs full tracebacks, and returns safe 500 responses (no stack traces to the client)
- **Render logs:** All stdout/stderr is captured in Render's log viewer for debugging
- **Supabase dashboard:** Database metrics, auth logs, and API usage are monitored via Supabase's built-in dashboard
- **Vercel analytics:** Frontend performance metrics (Core Web Vitals) available in Vercel's dashboard

**What we'd add for production scale:** Sentry for error tracking, Grafana for dashboards, alerts for error rate spikes.

---

## 9. How do you manage dependencies and patch vulnerabilities?

**Answer:**
- **Backend:** Dependencies pinned to exact versions in `requirements.txt` (e.g., `fastapi==0.115.0`). This prevents supply chain attacks from auto-upgrading to compromised versions.
- **Frontend:** `package-lock.json` locks the full dependency tree including transitive dependencies.
- **Audit process:** Run `pip-audit` (Python) and `npm audit` (Node.js) to check for known CVEs.
- **Minimal dependencies:** We only include what we use — no unnecessary packages that increase attack surface.

---

## 10. Explain the principle of least privilege in your architecture.

**Answer:**
- **Frontend (browser):** Only has the Supabase **anon key** — a public key that can only access data permitted by RLS policies. Cannot admin the database.
- **Backend (server):** Has the Supabase **service role key** — used only for server-side operations that need elevated access (e.g., background tasks generating assessment problems).
- **Code execution:** Runs in Piston's sandbox with no access to our servers, databases, or APIs.
- **CORS:** Only our frontend domain can call the backend API — other origins are rejected.
- **Environment variables:** Each platform (Vercel, Render) only has the secrets it needs — the frontend platform has zero backend secrets.

---

## 11. How would you handle a security incident (e.g., leaked API key)?

**Answer:**
1. **Immediate:** Rotate the compromised key in the provider's dashboard (Groq, OpenRouter, or Supabase)
2. **Update:** Set the new key in Render's environment variables — the app auto-restarts
3. **Audit:** Check Supabase logs and provider usage dashboards for unauthorized access
4. **Prevent:** Ensure `.gitignore` covers all secret files. Add `git-secrets` or GitHub's secret scanning to prevent future commits of secrets
5. **Communicate:** If user data was potentially accessed, follow breach notification procedures

---

## 12. Why did you choose this deployment architecture over alternatives?

**Answer:**
- **Vercel for frontend:** Global CDN with zero cold starts, automatic HTTPS, best-in-class Vite/React support. The rewrite rules proxy API calls to our backend, eliminating CORS issues.
- **Render for backend:** Native Python support, auto-deploy from GitHub, built-in TLS, free tier. The `render.yaml` makes the infrastructure reproducible.
- **Built-in code executor over Judge0:** No additional infrastructure needed. Subprocess-based execution with timeouts and temp directory isolation runs inside the same Docker container. For a single-user learning platform, this is simpler and eliminates external dependencies.
- **Supabase over self-hosted PostgreSQL:** Managed database with built-in auth, RLS, real-time, and backups. Eliminates database administration burden and reduces security risks from misconfigured databases.

---

## 13. What security headers does your application set?

**Answer:** Configured in `vercel.json` for the frontend:
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing attacks
- `X-Frame-Options: DENY` — prevents clickjacking by blocking iframe embedding
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer information leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables unnecessary browser APIs

Both Vercel and Render enforce **HSTS** (HTTP Strict Transport Security) automatically.

---

## 14. How do you ensure data privacy and compliance?

**Answer:**
- **Data minimization:** We only collect what's needed — email for auth, assessment responses for learning.
- **Data residency:** Supabase project region can be chosen based on compliance requirements.
- **No third-party tracking:** No analytics SDKs or ad trackers in the frontend.
- **Code execution isolation:** User-submitted code runs in temporary directories that are deleted after execution — nothing persists.
- **Secure deletion:** Users could request data deletion via Supabase admin — all cascading relationships would clean up automatically.

---

## 15. What would you improve if you had more time?

**Answer:**
1. **GitHub Actions CI pipeline** with automated tests, linting, and security scanning before deploy
2. **Rate limiting** on API endpoints using Redis or middleware-based approach
3. **Content Security Policy (CSP)** headers to prevent XSS
4. **Automated dependency updates** via Dependabot or Renovate
5. **Container scanning** if we move to Docker-based deployment
6. **Web Application Firewall (WAF)** for DDoS protection
7. **Penetration testing** before production launch
8. **Backup automation** and disaster recovery testing
