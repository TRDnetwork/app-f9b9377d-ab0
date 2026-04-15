# Expense Tracker — Deployment Guide

This guide covers deploying the Expense Tracker SaaS app (`app_a401`) using Docker, Docker Compose, or PaaS platforms (Railway/Render).

---

## Prerequisites

1. **Supabase Project**
   - Create a project at [supabase.com](https://supabase.com)
   - Run `db/schema.sql` in the SQL Editor to set up tables, RLS, and triggers
   - Copy your **Project URL** and **Anon Key** from Settings → API

2. **Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project credentials
   - **NEVER** commit `.env` to version control

3. **Docker** (for local/self-hosted deployments)
   - Install [Docker](https://docs.docker.com/get-docker/) (v20+)
   - Install [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

---

## Deploy with Docker

### Build the Image
```bash
docker build -t expense-tracker:latest .
```

### Run the Container
```bash
docker run -d \
  --name expense-tracker \
  -p 8080:8080 \
  --env-file .env \
  --restart unless-stopped \
  expense-tracker:latest
```

App will be available at **http://localhost:8080**

### Stop/Remove Container
```bash
docker stop expense-tracker
docker rm expense-tracker
```

---

## Deploy with Docker Compose

### Start Services
```bash
docker-compose up -d
```

This builds the image, starts the container, and maps port **8080**.

### View Logs
```bash
docker-compose logs -f app
```

### Stop Services
```bash
docker-compose down
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

---

## Deploy to Railway

Railway auto-detects Dockerfiles and deploys containers with zero config.

### Steps

1. **Install Railway CLI** (optional)
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Create Project**
   - Visit [railway.app](https://railway.app)
   - Click **New Project** → **Deploy from GitHub**
   - Select your repo and branch

3. **Set Environment Variables**
   - Go to project settings → **Variables**
   - Add:
     - `SUPABASE_URL` → your Supabase project URL
     - `SUPABASE_ANON_KEY` → your anon key
     - `NODE_ENV` → `production`

4. **Deploy**
   - Railway auto-builds and deploys on every push
   - Your app will be live at `https://your-app.railway.app`

5. **Custom Domain** (optional)
   - Go to **Settings** → **Domains**
   - Add your custom domain and configure DNS

---

## Deploy to Render

Render also auto-detects Dockerfiles and provides free hosting tiers.

### Steps

1. **Create Web Service**
   - Visit [render.com](https://render.com)
   - Click **New** → **Web Service**
   - Connect your GitHub/GitLab repo

2. **Configure Service**
   - **Name**: `expense-tracker`
   - **Region**: Choose closest to users
   - **Branch**: `main` (or your deployment branch)
   - **Runtime**: Docker
   - **Port**: `8080` (matches nginx config)

3. **Set Environment Variables**
   - Click **Environment** tab
   - Add:
     - `SUPABASE_URL` → your Supabase project URL
     - `SUPABASE_ANON_KEY` → your anon key
     - `NODE_ENV` → `production`

4. **Deploy**
   - Click **Create Web Service**
   - Render builds and deploys automatically
   - Your app will be live at `https://expense-tracker.onrender.com`

5. **Custom Domain** (optional)
   - Go to **Settings** → **Custom Domain**
   - Add your domain and update DNS records

---

## Environment Variables Reference

| Variable             | Required | Description                                      |
|----------------------|----------|--------------------------------------------------|
| `SUPABASE_URL`       | ✅       | Your Supabase project URL                        |
| `SUPABASE_ANON_KEY`  | ✅       | Your Supabase anon key (public, safe to expose)  |
| `NODE_ENV`           | ❌       | Set to `production` for prod deployments         |

**Security Note**: The anon key is safe to expose client-side. Row Level Security (RLS) in Supabase enforces all permissions.

---

## Database Migrations

### Initial Setup
Run the schema once after creating your Supabase project:

```sql
-- In Supabase SQL Editor, execute:
-- db/schema.sql
```

This creates:
- `app_a401_profiles` (user profiles)
- `app_a401_categories` (expense categories)
- `app_a401_expenses` (expense records)
- RLS policies scoped to `auth.uid()`
- Trigger to auto-create profiles and default categories on signup
- Indexes for query performance
- Realtime subscriptions for live updates

### Seed Data (Optional)
The schema automatically seeds 8 default categories per user on signup. No manual seeding required.

---

## Health Checks

### Docker/Compose
The Dockerfile includes a `HEALTHCHECK` that pings `http://localhost:8080/` every 30s.

### Railway/Render
Configure health checks in platform settings:
- **Path**: `/health`
- **Port**: `8080`
- **Interval**: `30s`

---

## Troubleshooting

### App won't start
- Check logs: `docker logs expense-tracker` or `docker-compose logs app`
- Verify `.env` file exists and contains valid Supabase credentials
- Ensure port 8080 isn't already in use: `lsof -i :8080`

### Authentication fails
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` match your project
- Check Supabase project is active and not paused
- Confirm email confirmations are disabled (or check inbox for confirmation emails)

### Database queries fail
- Verify `db/schema.sql` was executed successfully in Supabase SQL Editor
- Check RLS policies are enabled: `SELECT * FROM pg_policies WHERE tablename LIKE 'app_a401%';`
- Confirm user is authenticated: check browser console for `currentUser` object

### Realtime updates not working
- Verify Realtime is enabled in Supabase project settings
- Check tables are added to `supabase_realtime` publication (schema.sql handles this)
- Look for subscription errors in browser console

### CSV export fails
- Check browser console for JavaScript errors
- Verify expenses array is populated: `console.log(expenses)`
- Test with small dataset first (< 100 rows)

---

## Performance Optimization

### Frontend
- Nginx gzip compression enabled by default
- Static assets cached for 1 year
- Health check endpoint doesn't log to reduce disk I/O

### Database
- Indexes on `user_id`, `expense_date`, and `category_id` speed up queries
- RLS policies use indexed columns (`auth.uid()`)
- Realtime only subscribed to user's own records

### Scaling
- For high traffic, run multiple Docker containers behind a load balancer (nginx/HAProxy)
- Enable Supabase connection pooling (automatically handled by Supabase)
- Consider upgrading Supabase plan for increased database resources

---

## Testing Before Deploy

Run tests locally to catch issues:

```bash
npm install   # installs vitest, jsdom, etc.
npm test      # runs all tests in tests/
```

All tests must pass before deploying to production.

---

## Next Steps

- [ ] Set up custom domain with SSL (Railway/Render handle SSL automatically)
- [ ] Configure email templates in Supabase Auth settings
- [ ] Enable Supabase backup policies (automatic on paid plans)
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Implement analytics (Plausible, Fathom, etc.)
- [ ] Add more expense categories via app UI
- [ ] Customize branding (logo, colors) in `styles.css`

---

**Need help?** Check the main `README.md` for app architecture details or the Supabase [documentation](https://supabase.com/docs).