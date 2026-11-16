# Loan Lead Call Log (FDE Training – P1)

A small call-log app. Each row is one call to a loan lead and its outcome.

- **Database:** Postgres table `calls` on Neon
- **Backend:** Python (FastAPI) with `GET /calls` and `POST /calls`, hosted on Render
- **Frontend:** React (Vite) page that lists the calls, hosted on Vercel

## Live links

- Frontend: _add your Vercel URL_
- API: _add your Render URL_ (try `/calls` and `/docs`)

## Database table

```sql
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  lead_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  outcome TEXT NOT NULL,
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

API runs at http://localhost:8000 (interactive docs at http://localhost:8000/docs).

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
| backend | `DATABASE_URL` | Neon connection string (keep private) |
| frontend | `VITE_API_URL` | Backend URL, no trailing slash |

## Add a call with curl

```bash
curl -X POST https://<your-render-app>.onrender.com/calls \
  -H "Content-Type: application/json" \
  -d '{"lead_name":"Ravi Kumar","phone":"+919876543210","outcome":"interested","notes":"Wants a 5 lakh personal loan"}'
```

Refresh the React page and the new call appears.
