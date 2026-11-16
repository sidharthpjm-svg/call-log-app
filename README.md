# Candidate Screening Dashboard (FDE Training – P1)

A live dashboard for first-round phone screens done by an AI voice agent: who was called, who made the shortlist, and who needs a callback.

## The problem

A fast-growing company is hiring for several roles at once: engineers, analysts, support and sales. Each opening gets hundreds of applications, and every applicant needs the same 5-minute first call:

- Are you still looking?
- How many years of experience do you have?
- What's your expected salary (CTC)?
- What's your notice period?

A recruiter can make about 40 of these calls a day. Most of that time goes on unanswered calls, voicemails and candidates who were never a fit. Good candidates wait days for a first call and accept other offers. Hiring managers keep asking "where are we on this role?" and the answer lives in someone's spreadsheet.

## The solution

An AI voice agent makes the first-round screening calls, and every call lands on this dashboard the moment it ends:

- **Any system can log a call** with a single `POST /calls`: the AI voice agent's post-call webhook, a recruiter's form, an ATS (applicant tracking system), curl or Postman.
- **The dashboard updates itself** every 10 seconds: candidates screened today, shortlist rate, callbacks pending, average call length and recruiter hours saved.
- **Every role has its own funnel:** how many candidates were screened and shortlisted for each opening.
- **Recruiters act on it straight away:** filter to `shortlisted` to book interviews, filter to `callback` to work through follow-ups, correct an outcome, or clear out test data.

### Who uses it

| Person | What they do here |
|---|---|
| Recruiter | Works the `shortlisted` and `callback` lists every morning |
| Hiring manager | Checks the per-role funnel instead of asking for updates |
| AI voice agent | Posts each call's outcome, experience, CTC, notice period and notes when the call ends |
| FDE / developer | Uses the API to connect the client's ATS or dialer |

### How it works

```
AI voice agent / recruiter form / curl / Postman
                │  POST /calls (JSON)
                ▼
   FastAPI backend on Render  ──►  Postgres on Neon (calls table)
                ▲
                │  GET /calls, GET /stats (every 10 s)
   React dashboard on Vercel
```

### Where this goes next

This is the base for the rest of the FDE training:

- **P2:** a LiveKit voice bot that runs the screening conversation.
- **P3:** when the bot hangs up, it sends a signed (HMAC) webhook to this API, and the candidate appears on the dashboard with no human in the loop.
- **P5:** the same calls are also stored through an AWS Lambda and DynamoDB.

## Live links

- Frontend: _add your Vercel URL_
- API: https://call-log-app-ox2d.onrender.com (interactive docs at `/docs`)

## Features

- **Dashboard cards:** candidates screened (and today), shortlisted with shortlist rate, callbacks pending, average screen length, recruiter time saved
- **Outcome chart:** share of calls per outcome; click a bar to filter the table
- **Open roles table:** screened, shortlisted and rate for each role; click a role to filter
- **Log a screening call:** form with validation (phone format, allowed outcomes, sensible number ranges) and role suggestions
- **Search and filter:** by name, phone or notes, by role and by outcome
- **Edit and delete:** change a call's outcome inline, or delete it
- **Auto-refresh:** new calls from curl, Postman or the bot appear within 10 seconds

## API

| Method | Route | What it does |
|---|---|---|
| `GET` | `/calls` | List calls, newest first. Optional: `?outcome=shortlisted`, `?role=Data Analyst`, `?search=priya`, `?limit=50` |
| `POST` | `/calls` | Add a screening call |
| `GET` | `/calls/{id}` | Get one call |
| `PATCH` | `/calls/{id}` | Update `outcome` and/or `notes` |
| `DELETE` | `/calls/{id}` | Delete a call |
| `GET` | `/stats` | Totals, shortlist rate, call time, counts by outcome and by role |

Allowed outcomes: `shortlisted`, `callback`, `rejected`, `no answer`.

### Add a call with curl

```bash
curl -X POST https://call-log-app-ox2d.onrender.com/calls \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Priya Nair","phone":"+919812345678","role":"Data Analyst","outcome":"shortlisted","experience_years":3,"expected_ctc_lpa":12,"notice_period_days":30,"duration_seconds":240,"notes":"Strong SQL, wants hybrid"}'
```

Refresh the React page (or wait up to 10 seconds) and the new candidate appears.

## Database table

The backend creates the table when it starts, so no manual SQL is needed.

```sql
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  outcome TEXT NOT NULL,          -- shortlisted | callback | rejected | no answer
  experience_years NUMERIC(4, 1),
  expected_ctc_lpa NUMERIC(6, 2),
  notice_period_days INTEGER,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Run locally

**Backend**

```bash
cd backend
cp .env.example .env        # then put your Neon connection string in .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at http://localhost:8000 (docs at http://localhost:8000/docs).

**Frontend**

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

Page runs at http://localhost:5173.

## Environment variables

| Where | Name | Value |
|---|---|---|
| backend | `DATABASE_URL` | Neon connection string (keep private, never commit) |
| frontend | `VITE_API_URL` | Backend URL, no trailing slash |
