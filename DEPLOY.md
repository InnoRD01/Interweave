# Deploying Interweave

Every step, in order, from this repo to the live domain. The domain currently
points at the `morepeace` Cloudflare Pages project; these steps move it here.

The domain is `studiointerweave.com`; `<domain>` below means that.

---

## A. GitHub: create `main` (2 min)

Cloudflare deploys the live site from `main`, and the CMS commits to it.

1. Open https://github.com/InnoRD01/Interweave/branches → **New branch** → name `main`, source `claude/fervent-ritchie-e96f3e` → **Create**.
2. Repo **Settings → General → Default branch** → switch to `main` → **Update**.

From now on, changes reach the live site by merging into `main`.

## B. On your computer: create the image bucket (5 min)

Needs Node 22.

```bash
git clone https://github.com/InnoRD01/Interweave.git
cd Interweave
npm install
npx wrangler login
npx wrangler r2 bucket create interweave-media
```

`wrangler login` opens a browser. Sign in to the Cloudflare account that holds the domain.
The bucket must exist **before** the first deploy, or the deploy fails.

## C. Cloudflare: create the Worker from GitHub (10 min)

1. Dashboard → **Workers & Pages** → **Create** → **Workers** tab → **Import a repository**.
2. Connect GitHub if asked, and give the Cloudflare app access to `InnoRD01/Interweave`. Select the repo.
3. Settings:

   | Setting | Value |
   |---|---|
   | Project name | `interweave` (must match `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Non-production branch deploy command | `npx wrangler versions upload` (default) |
   | Root directory | `/` |

4. **Create and deploy**, and wait for the build to finish (about 2 minutes).
5. Open the `https://interweave.<your-account>.workers.dev` link it shows and check the pages load.
   Image uploads won't work yet (they return 503 until step F). That's expected.

## D. Move the domain from `morepeace` to `interweave` (5 min)

The site is unreachable for about a minute between steps 1 and 3.

1. **Workers & Pages → `morepeace` → Custom domains** → next to `<domain>` (and `www.<domain>` if listed) → **⋯ → Remove** → confirm.
   `morepeace` stays online at `morepeace.pages.dev`.
2. Open the domain's **DNS → Records**. If a `CNAME` for `<domain>` (or `www`) pointing at `morepeace.pages.dev` is still there, delete it. Otherwise the next step fails with "record already exists".
3. **Workers & Pages → `interweave` → Settings → Domains & Routes → + Add → Custom domain** → enter `<domain>` → **Add domain**. Repeat for `www.<domain>` if you use it.
4. Wait 1–5 minutes for the certificate, then open `https://<domain>`.

## E. Turn on image resizing (3 min)

1. Dashboard → select the domain → **Images → Transformations** → **Enable for zone**.
2. In `wrangler.jsonc`, set `"PUBLIC_IMAGE_TRANSFORMS": "true"`, then commit and push to `main`. This redeploys automatically.
   (Build-time settings come from `wrangler.jsonc`; dashboard plain-text variables get overwritten by it.)
3. Check: after an image has been uploaded (step G), open it from a project page in a new tab. The URL should start with `/cdn-cgi/image/`.

## F. Protect the CMS with Cloudflare Access (10 min)

1. Dashboard → **Zero Trust**. The first time, pick a team name (e.g. `interweave`), which gives a team domain like `interweave.cloudflareaccess.com`, and choose the **Free** plan (up to 50 users; it asks for a card but doesn't charge).
2. **Access → Applications → Add an application → Self-hosted**.
   - Name: `Interweave CMS`
   - Session duration: `1 week`
   - Add three public hostnames, all with domain `<domain>`, with the paths `keystatic`, `api/keystatic` and `api/media`.
3. **Add a policy**: name `Studio editors`, action **Allow**, Include → **Emails** → the editors' email addresses. Keep the default login method (**One-time PIN**, which emails a code).
4. Save. Open the application again and copy its **Application Audience (AUD) Tag**.
5. **Workers & Pages → `interweave` → Settings → Variables and Secrets → + Add**, type **Secret**:
   - `ACCESS_TEAM_DOMAIN` = `interweave.cloudflareaccess.com` (your team domain)
   - `ACCESS_AUD` = the AUD tag
   
   Then **Deploy**.
6. Check: open `https://<domain>/keystatic` in a private window. You should see the Cloudflare Access login.

## G. Connect the CMS to GitHub (15 min)

The CMS saves edits as commits to `main`. This creates the GitHub App it uses.

1. On your computer, in the repo:
   ```bash
   npm run cms:github-setup
   ```
   Open http://127.0.0.1:4321/keystatic → **Log in with GitHub**. This takes you to the setup page.
2. Fill it in:
   - **Deployed App URL:** `https://<domain>`
   - **GitHub organization:** `InnoRD01` if that's an organization (you must be an owner); leave blank if it's a personal account.

   Click **Create GitHub App**. On GitHub, name it `Interweave CMS` → **Create GitHub App**.
3. GitHub sends you back to localhost, and Keystatic writes a `.env` file with four values. `.env` is git-ignored; **never commit it**.
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=…
   KEYSTATIC_GITHUB_CLIENT_SECRET=…
   KEYSTATIC_SECRET=…
   PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=…
   ```
4. **Install the app on the repo:** `https://github.com/apps/<slug>` → **Install** → *Only select repositories* → `InnoRD01/Interweave`.
5. **Check the callback URLs** in the app's settings (GitHub → Settings → Developer settings → GitHub Apps → the app). They should include:
   - `https://<domain>/api/keystatic/github/oauth/callback`
   - `http://127.0.0.1:4321/api/keystatic/github/oauth/callback` (keeps local GitHub mode working)
6. Add three more **Secrets** to the Worker (as in F5): `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`.
7. Put the slug in `wrangler.jsonc` under `vars` (it isn't secret): `"PUBLIC_KEYSTATIC_GITHUB_APP_SLUG": "<slug>"`. Commit and push to `main`.
8. **Test end to end:** `https://<domain>/keystatic` → Access code → **Log in with GitHub** → authorize → open a project → change a sentence → **Save**. A commit appears on `main`, Cloudflare rebuilds, and the change is live in about 2 minutes.

## H. Give each editor access

Every editor needs both:
- a GitHub account with **Write** access to the repo (repo **Settings → Collaborators → Add people**), and
- their email on the Access policy (step F3).

---

## Optional

- **Serve originals straight from the CDN:** R2 → `interweave-media` → **Settings → Custom Domains → Connect domain** → `media.<domain>`. Then set `"PUBLIC_MEDIA_BASE": "https://media.<domain>"` in `wrangler.jsonc` and push.
- **Keep `morepeace` on a subdomain:** Workers & Pages → `morepeace` → **Custom domains → Set up a domain** → e.g. `peace.<domain>`.

## If something goes wrong

| Symptom | Fix |
|---|---|
| Deploy fails: bucket not found | Do step B3 (`wrangler r2 bucket create interweave-media`). |
| Deploy fails: name mismatch | The Worker must be named `interweave`, matching `wrangler.jsonc`. |
| "Record already exists" when adding the domain | Delete the leftover DNS record (step D2). |
| Upload says "Cloudflare Access is not configured" | Add `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` as Secrets (step F5). |
| Upload says 401 | The `api/media` path is missing from the Access application, or the AUD tag is wrong. |
| CMS login loops back to GitHub | The callback URL is missing (step G5), or the app isn't installed on the repo (G4). |
| Images load but aren't resized | Transformations aren't enabled on the zone (E1), or `PUBLIC_IMAGE_TRANSFORMS` is still `"false"` (E2). |
