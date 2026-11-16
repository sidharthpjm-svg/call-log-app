import os
import time
from contextlib import asynccontextmanager
from typing import Literal, Optional

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

# Read DATABASE_URL from .env (locally) or from Render's environment variables
load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

# The only outcomes a screening call can have
Outcome = Literal["shortlisted", "callback", "rejected", "no answer"]


def get_db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def migrate():
    """Create the calls table if it doesn't exist yet. Safe to run on every startup.

    If an older version of the table is found (from the loan-lead version of this app),
    it is renamed to calls_old_<timestamp> as a backup, never deleted.
    """
    with get_db() as conn:
        table_exists = conn.execute("SELECT to_regclass('public.calls') AS t").fetchone()["t"]
        has_new_schema = conn.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'candidate_name'
            """
        ).fetchone()
        if table_exists and not has_new_schema:
            conn.execute(f"ALTER TABLE calls RENAME TO calls_old_{int(time.time())}")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS calls (
              id SERIAL PRIMARY KEY,
              candidate_name TEXT NOT NULL,
              phone TEXT NOT NULL,
              role TEXT NOT NULL,
              outcome TEXT NOT NULL,
              experience_years NUMERIC(4, 1),
              expected_ctc_lpa NUMERIC(6, 2),
              notice_period_days INTEGER,
              duration_seconds INTEGER,
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT now()
            )
            """
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate()
    yield


app = FastAPI(title="Candidate Screening Call API", lifespan=lifespan)

# Allow the React page (on a different domain) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CallIn(BaseModel):
    candidate_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^\+?[0-9]{10,15}$")
    role: str = Field(min_length=1, max_length=100)
    outcome: Outcome
    experience_years: Optional[float] = Field(default=None, ge=0, le=60)
    expected_ctc_lpa: Optional[float] = Field(default=None, ge=0)
    notice_period_days: Optional[int] = Field(default=None, ge=0, le=365)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class CallUpdate(BaseModel):
    outcome: Optional[Outcome] = None
    notes: Optional[str] = None


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/calls")
def get_calls(
    outcome: Optional[Outcome] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    """List screening calls, newest first. Filters: ?outcome=shortlisted&role=Data Analyst&search=priya"""
    sql = "SELECT * FROM calls WHERE TRUE"
    params = []
    if outcome:
        sql += " AND outcome = %s"
        params.append(outcome)
    if role:
        sql += " AND role = %s"
        params.append(role)
    if search:
        like = f"%{search}%"
        sql += " AND (candidate_name ILIKE %s OR phone ILIKE %s OR notes ILIKE %s)"
        params += [like, like, like]
    sql += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)
    with get_db() as conn:
        return conn.execute(sql, params).fetchall()


@app.post("/calls", status_code=201)
def add_call(call: CallIn):
    with get_db() as conn:
        return conn.execute(
            """
            INSERT INTO calls (candidate_name, phone, role, outcome, experience_years,
                               expected_ctc_lpa, notice_period_days, duration_seconds, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                call.candidate_name,
                call.phone,
                call.role,
                call.outcome,
                call.experience_years,
                call.expected_ctc_lpa,
                call.notice_period_days,
                call.duration_seconds,
                call.notes,
            ),
        ).fetchone()


@app.get("/calls/{call_id}")
def get_call(call_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM calls WHERE id = %s", (call_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return row


@app.patch("/calls/{call_id}")
def update_call(call_id: int, update: CallUpdate):
    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")
    # Column names come from the CallUpdate model, never from user input
    set_clause = ", ".join(f"{col} = %s" for col in changes)
    with get_db() as conn:
        row = conn.execute(
            f"UPDATE calls SET {set_clause} WHERE id = %s RETURNING *",
            (*changes.values(), call_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return row


@app.delete("/calls/{call_id}", status_code=204)
def delete_call(call_id: int):
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM calls WHERE id = %s RETURNING id", (call_id,)).fetchone()
    if not deleted:
        raise HTTPException(status_code=404, detail="Call not found")
    return Response(status_code=204)


@app.get("/stats")
def get_stats():
    """Numbers for the dashboard cards, the outcome chart and the per-role table."""
    with get_db() as conn:
        stats = conn.execute(
            """
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (
                WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
              ) AS today,
              COUNT(*) FILTER (WHERE outcome = 'shortlisted') AS shortlisted,
              COUNT(*) FILTER (WHERE outcome = 'callback') AS callbacks,
              ROUND(AVG(duration_seconds))::int AS avg_duration_seconds,
              COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds
            FROM calls
            """
        ).fetchone()
        by_outcome = conn.execute(
            "SELECT outcome, COUNT(*) AS count FROM calls GROUP BY outcome ORDER BY count DESC"
        ).fetchall()
        by_role = conn.execute(
            """
            SELECT role,
                   COUNT(*) AS screened,
                   COUNT(*) FILTER (WHERE outcome = 'shortlisted') AS shortlisted
            FROM calls
            GROUP BY role
            ORDER BY screened DESC
            """
        ).fetchall()
    total = stats["total"]
    stats["shortlist_rate"] = round(100 * stats["shortlisted"] / total, 1) if total else 0
    stats["by_outcome"] = by_outcome
    stats["by_role"] = by_role
    return stats
