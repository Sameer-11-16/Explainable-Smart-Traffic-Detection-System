"""
SQLite database models and helpers for the traffic detection system.
Uses Python's built-in sqlite3 module for simplicity.
"""

import sqlite3
import os
from datetime import datetime, timezone

from config import Config

DATABASE_PATH = Config.DATABASE


def get_db():
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize the database schema and default settings."""
    conn = get_db()
    cursor = conn.cursor()

    # Create detection_sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detection_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            upload_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            total_vehicles INTEGER DEFAULT 0,
            cars INTEGER DEFAULT 0,
            motorcycles INTEGER DEFAULT 0,
            buses INTEGER DEFAULT 0,
            trucks INTEGER DEFAULT 0,
            processing_time REAL DEFAULT 0.0,
            video_path TEXT DEFAULT ''
        )
    """)

    # Create traffic_records table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS traffic_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            vehicle_count INTEGER DEFAULT 0,
            density REAL DEFAULT 0.0,
            congestion_level TEXT DEFAULT 'Low',
            avg_speed REAL DEFAULT 0.0,
            cars INTEGER DEFAULT 0,
            motorcycles INTEGER DEFAULT 0,
            buses INTEGER DEFAULT 0,
            trucks INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES detection_sessions(id) ON DELETE CASCADE
        )
    """)

    # Create settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # Insert default settings if they don't exist
    now = datetime.now(timezone.utc).isoformat()
    for key, value in Config.DEFAULT_SETTINGS.items():
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Detection sessions helpers
# ---------------------------------------------------------------------------

def insert_session(filename, original_filename):
    """Insert a new detection session and return its ID."""
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        """INSERT INTO detection_sessions
           (filename, original_filename, upload_time, status)
           VALUES (?, ?, ?, 'pending')""",
        (filename, original_filename, now),
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id


def update_session(session_id, **kwargs):
    """Update fields of a detection session by ID."""
    if not kwargs:
        return
    conn = get_db()
    set_clause = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [session_id]
    conn.execute(
        f"UPDATE detection_sessions SET {set_clause} WHERE id = ?", values
    )
    conn.commit()
    conn.close()


def get_session(session_id):
    """Retrieve a single detection session by ID."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM detection_sessions WHERE id = ?", (session_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


def get_all_sessions(limit=50):
    """Retrieve all detection sessions ordered by most recent."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM detection_sessions ORDER BY upload_time DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session(session_id):
    """Delete a detection session and its associated traffic records."""
    conn = get_db()
    conn.execute("DELETE FROM traffic_records WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM detection_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Traffic records helpers
# ---------------------------------------------------------------------------

def insert_traffic_record(session_id, record):
    """Insert a traffic record for a given session."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO traffic_records
           (session_id, timestamp, vehicle_count, density, congestion_level,
            avg_speed, cars, motorcycles, buses, trucks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            now,
            record.get("vehicle_count", 0),
            record.get("density", 0.0),
            record.get("congestion_level", "Low"),
            record.get("avg_speed", 0.0),
            record.get("cars", 0),
            record.get("motorcycles", 0),
            record.get("buses", 0),
            record.get("trucks", 0),
        ),
    )
    conn.commit()
    conn.close()


def get_traffic_records(session_id):
    """Get all traffic records for a session."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM traffic_records WHERE session_id = ? ORDER BY timestamp",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Settings helpers
# ---------------------------------------------------------------------------

def get_settings():
    """Get all settings as a dict."""
    conn = get_db()
    rows = conn.execute("SELECT key, value, updated_at FROM settings").fetchall()
    conn.close()
    return {row["key"]: {"value": row["value"], "updated_at": row["updated_at"]} for row in rows}


def get_setting(key):
    """Get a single setting value by key. Returns default if not found."""
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    if row is None:
        return Config.DEFAULT_SETTINGS.get(key)
    return row["value"]


def update_setting(key, value):
    """Insert or update a setting."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at""",
        (key, value, now),
    )
    conn.commit()
    conn.close()
