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
