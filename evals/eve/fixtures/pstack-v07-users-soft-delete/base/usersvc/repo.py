from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    created_at: datetime


_COLUMNS = "id, email, name, created_at"


def _user(row):
    return User(*row) if row else None


def create_user(conn, email, name):
    row = conn.execute(
        f"INSERT INTO users (email, name) VALUES (%s, %s) RETURNING {_COLUMNS}",
        (email, name),
    ).fetchone()
    return _user(row)


def get_user(conn, user_id):
    return _user(conn.execute(f"SELECT {_COLUMNS} FROM users WHERE id = %s", (user_id,)).fetchone())


def list_users(conn):
    rows = conn.execute(f"SELECT {_COLUMNS} FROM users ORDER BY id").fetchall()
    return [_user(r) for r in rows]


def delete_user(conn, user_id):
    cur = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    return cur.rowcount == 1
