# Bot Watch — private owner dashboard

Status: prepared on the bot-watch-setup branch. Not deployed; WCT collection is disabled.
The existing clock and guide continue working without tracking.

## What this records
- Anonymous page launches, split into website and Discord Activity sessions.
- Combined totals, launches today and the last 30 days.
- Approximate active sessions: visible pages that sent a signal in the last five minutes.
- One temporary random session ID per page load. Reloading counts as another launch.
- No Discord usernames, messages, server IDs or visitor profiles.
- No cookies or local storage for visitors. Closed/backgrounded tabs age out.
- Aggregate daily counts are retained; temporary session IDs are deleted after 24 hours without a signal.
- All days use UTC. Activity frame_id identifies Discord launches; public signals are estimates and can be spoofed or blocked.
- This does not retrieve Discord install counts or list servers. Those remain in the Developer Portal.
- Cloudflare and GitHub process requests under their own policies. Not logging IPs in this application does not prevent infrastructure providers from processing network addresses.

## Owner-only sign-in
Only GitHub user ID 253505737 (Madisastateofmind) can access statistics.
No repository permissions are requested. The GitHub OAuth token is used to verify identity and is not retained.
GitHub handles login and existing two-factor authentication. An already-authenticated GitHub session may not prompt for a fresh code.
Dashboard sessions last eight hours in Secure, HttpOnly, SameSite=Lax cookies.
GitHub OAuth state is checked before exchanging a code. Dashboard HTML and statistics have no-store caching.
Secrets belong in Cloudflare secrets, never in this public repository.

## Activate — one-time setup
Use Cloudflare Workers Free and D1 Free. These have quotas; do not enable a paid plan for this setup.
You need a Cloudflare account and access to GitHub Settings → Developer settings → OAuth Apps.
The clock remains on GitHub Pages; the protected dashboard runs on the Worker so cookies are first-party.

1. Check out this branch. Install a current Node.js LTS and use Wrangler:
   - npm install --global wrangler
   - wrangler login
2. In this bot-watch directory, create a database:
   - wrangler d1 create bot-watch
   Copy its database ID into wrangler.toml.
3. Initialize tables:
   - wrangler d1 execute bot-watch --remote --file=schema.sql
4. Deploy once to learn your workers.dev address:
   - wrangler deploy
   Until the secrets are configured, the dashboard returns "not configured".
5. Register a new GitHub OAuth App:
   - Name: Bot Watch
   - Homepage URL: your Worker URL
   - Authorization callback URL: your Worker URL followed by /callback
   - Device Flow is not needed.
6. Put the OAuth Client ID in wrangler.toml, and store its secret:
   - wrangler secret put GITHUB_CLIENT_SECRET
   Enter it directly into the terminal prompt, not in a commit or chat.
7. Generate a long random session secret on your computer:
   - node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   Store the resulting value using:
   - wrangler secret put SESSION_SECRET
8. Deploy again. Open the Worker URL and sign in with GitHub.
   Verify that your account is admitted and another account is denied.
9. Verify the actual Discord Activity Origin matches ALLOWED_ORIGINS. The configured list includes GitHub Pages and WCT's discordsays.com origin. Add exact additional Discord host origins only if observed, not broad wildcards.
10. Review and publish the privacy notice in PRIVACY-NOTICE.md before enabling usage collection.
11. Set endpoint in discord-clock/usage.js to the Worker URL followed by /collect.
    Add this before </body> in discord-clock/index.html:
    <script type="module" src="./usage.js"></script>
    Merge the reviewed changes to main to publish them.
12. Test one website launch and one Discord launch. Confirm separate rows, an increase in launches and active sessions dropping after closing the app.

Do not add this dashboard to the public guide as though it is visitor-facing.
Its URL need not be secret; the server enforces identity before querying statistics.

## More apps
Add an app ID/name to APPS_JSON in wrangler.toml and its exact website/Activity origins to ALLOWED_ORIGINS.
Include a copy of the usage client in that app with its app field changed, after updating that app's privacy notice.
Redeploy. The dashboard adds rows automatically.
Future bots with server-side processes should report their events from their backend instead of relying on page visibility.

## Checks
Run: node --test worker.test.mjs
These cover authentication, wrong-owner rejection, state validation, collection validation and duplicate-safe SQL construction.
They mock GitHub and D1; they do not replace deployment tests or actual D1 execution.
