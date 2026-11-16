import os
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Read DATABASE_URL from the .env file (locally) or from Render's environment variables
load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

app = FastAPI(title="Loan Lead Call Log API")

# Allow the React page (on a different domain) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Call(BaseModel):
    lead_name: str
    phone: str
    outcome: str  # interested | not interested | callback
    notes: Optional[str] = None


def get_db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/calls")
def get_calls():
    with get_db() as conn:
        return conn.execute("SELECT * FROM calls ORDER BY created_at DESC").fetchall()


@app.post("/calls", status_code=201)
def add_call(call: Call):
    with get_db() as conn:
        return conn.execute(
            """
            INSERT INTO calls (lead_name, phone, outcome, notes)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (call.lead_name, call.phone, call.outcome, call.notes),
        ).fetchone()
