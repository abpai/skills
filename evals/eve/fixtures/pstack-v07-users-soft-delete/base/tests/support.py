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
