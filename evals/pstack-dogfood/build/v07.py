import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit, diff_fingerprint

root = fixture_root("v07-users-soft-delete")
base = {}
base[".gitignore"] = "__pycache__/\n.venv/\n"
base["README.md"] = r'''
# usersvc

User records for the accounts platform, stored in Postgres.

## Tests

Repository tests run against the platform's Postgres test image (internal
registry; VPN required) with the platform extensions and seed roles installed:

```sh
pip install -r requirements.txt
make test
```

`make test` starts the database with `docker-compose.test.yml`, applies
`migrations/` in order, and runs the suite with `TEST_DATABASE_URL` set.
Without `TEST_DATABASE_URL` the repository tests are skipped.
'''
base["requirements.txt"] = "psycopg[binary]==3.2.3\n"
base["Makefile"] = r'''
TEST_DATABASE_URL ?= postgresql://usersvc:usersvc@localhost:55432/usersvc

.PHONY: test db-up db-down

db-up:
	docker compose -f docker-compose.test.yml up -d --wait

db-down:
	docker compose -f docker-compose.test.yml down -v

test: db-up
	TEST_DATABASE_URL=$(TEST_DATABASE_URL) python -m unittest -v; status=$$?; $(MAKE) db-down; exit $$status
'''.replace("\n\t", "\n\t")
base["docker-compose.test.yml"] = r'''
services:
  db:
    image: registry.platform.internal/postgres-test:16.4-platform.7
    environment:
      POSTGRES_USER: usersvc
      POSTGRES_PASSWORD: usersvc
      POSTGRES_DB: usersvc
    ports:
      - "55432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "usersvc"]
      interval: 2s
      retries: 15
'''
base["migrations/001_users.sql"] = r'''
CREATE TABLE users (
    id          bigserial PRIMARY KEY,
    email       platform.email_address NOT NULL,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
'''
base["migrations/002_users_email_unique.sql"] = r'''
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
'''
base["usersvc/__init__.py"] = ""
base["usersvc/db.py"] = r'''
import os


def connect(url=None):
    import psycopg

    return psycopg.connect(url or os.environ["DATABASE_URL"], autocommit=True)


def apply_migrations(conn, directory):
    for name in sorted(os.listdir(directory)):
        if name.endswith(".sql"):
            with open(os.path.join(directory, name)) as fh:
                conn.execute(fh.read())
'''
base["usersvc/repo.py"] = r'''
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
'''
base["tests/__init__.py"] = ""
base["tests/support.py"] = r'''
import os
import unittest

DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
MIGRATIONS = os.path.join(os.path.dirname(__file__), "..", "migrations")

needs_db = unittest.skipUnless(DATABASE_URL, "TEST_DATABASE_URL not set")


class DbTestCase(unittest.TestCase):
    def setUp(self):
        from usersvc import db

        self.conn = db.connect(DATABASE_URL)
        self.conn.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        db.apply_migrations(self.conn, MIGRATIONS)

    def tearDown(self):
        self.conn.close()
'''
base["tests/test_repo.py"] = r'''
from usersvc import repo

from .support import DbTestCase, needs_db


@needs_db
class RepoTests(DbTestCase):
    def test_create_and_get(self):
        user = repo.create_user(self.conn, "ada@example.com", "Ada")
        self.assertEqual(repo.get_user(self.conn, user.id), user)

    def test_list_users_in_creation_order(self):
        a = repo.create_user(self.conn, "a@example.com", "A")
        b = repo.create_user(self.conn, "b@example.com", "B")
        self.assertEqual([u.id for u in repo.list_users(self.conn)], [a.id, b.id])

    def test_delete_user(self):
        user = repo.create_user(self.conn, "gone@example.com", "Gone")
        self.assertTrue(repo.delete_user(self.conn, user.id))
        self.assertIsNone(repo.get_user(self.conn, user.id))
        self.assertFalse(repo.delete_user(self.conn, user.id))

    def test_email_is_unique_case_insensitively(self):
        repo.create_user(self.conn, "Sam@example.com", "Sam")
        with self.assertRaises(Exception):
            repo.create_user(self.conn, "sam@example.com", "Sam again")
'''

change = {}
change["migrations/003_users_soft_delete.sql"] = r'''
ALTER TABLE users ADD COLUMN deleted_at timestamptz;
CREATE INDEX users_live_idx ON users (id) WHERE deleted_at IS NULL;
'''
change["usersvc/repo.py"] = r'''
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    created_at: datetime
    deleted_at: datetime | None = None


_COLUMNS = "id, email, name, created_at, deleted_at"


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


def list_users(conn, include_deleted=False):
    where = "" if include_deleted else "WHERE deleted_at IS NULL "
    rows = conn.execute(f"SELECT {_COLUMNS} FROM users {where}ORDER BY id").fetchall()
    return [_user(r) for r in rows]


def delete_user(conn, user_id):
    cur = conn.execute(
        "UPDATE users SET deleted_at = now() WHERE id = %s AND deleted_at IS NULL",
        (user_id,),
    )
    return cur.rowcount == 1
'''
change["tests/test_repo.py"] = r'''
from usersvc import repo

from .support import DbTestCase, needs_db


@needs_db
class RepoTests(DbTestCase):
    def test_create_and_get(self):
        user = repo.create_user(self.conn, "ada@example.com", "Ada")
        self.assertEqual(repo.get_user(self.conn, user.id), user)

    def test_list_users_in_creation_order(self):
        a = repo.create_user(self.conn, "a@example.com", "A")
        b = repo.create_user(self.conn, "b@example.com", "B")
        self.assertEqual([u.id for u in repo.list_users(self.conn)], [a.id, b.id])

    def test_delete_user_keeps_the_row(self):
        user = repo.create_user(self.conn, "gone@example.com", "Gone")
        self.assertTrue(repo.delete_user(self.conn, user.id))
        stored = repo.get_user(self.conn, user.id)
        self.assertIsNotNone(stored.deleted_at)
        self.assertFalse(repo.delete_user(self.conn, user.id))

    def test_list_users_hides_deleted_by_default(self):
        keep = repo.create_user(self.conn, "keep@example.com", "Keep")
        gone = repo.create_user(self.conn, "gone@example.com", "Gone")
        repo.delete_user(self.conn, gone.id)
        self.assertEqual([u.id for u in repo.list_users(self.conn)], [keep.id])
        self.assertEqual(
            [u.id for u in repo.list_users(self.conn, include_deleted=True)], [keep.id, gone.id]
        )

    def test_email_is_unique_case_insensitively(self):
        repo.create_user(self.conn, "Sam@example.com", "Sam")
        with self.assertRaises(Exception):
            repo.create_user(self.conn, "sam@example.com", "Sam again")
'''

write_tree(root, base)
commit(root)
write_tree(root, change)
print(diff_fingerprint(root))
