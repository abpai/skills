import os
import tempfile
import time
import unittest

from jot.sync import sync


def write(path, text, mtime=None):
    with open(path, "w") as fh:
        fh.write(text)
    if mtime is not None:
        os.utime(path, (mtime, mtime))


def read(path):
    with open(path) as fh:
        return fh.read()


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.local = os.path.join(self.tmp.name, "notes")
        self.remote = os.path.join(self.tmp.name, "remote")
        os.makedirs(self.local)
        os.makedirs(self.remote)

    def tearDown(self):
        self.tmp.cleanup()

    def test_new_notes_copy_both_ways(self):
        write(os.path.join(self.local, "a.md"), "A")
        write(os.path.join(self.remote, "b.md"), "B")
        report = sync(self.local, self.remote)
        self.assertEqual((report.pushed, report.pulled), (["a"], ["b"]))
        self.assertEqual(read(os.path.join(self.remote, "a.md")), "A")
        self.assertEqual(read(os.path.join(self.local, "b.md")), "B")

    def test_newer_edit_wins(self):
        now = time.time()
        write(os.path.join(self.local, "n.md"), "old", mtime=now - 60)
        write(os.path.join(self.remote, "n.md"), "new", mtime=now)
        report = sync(self.local, self.remote)
        self.assertEqual(report.pulled, ["n"])
        self.assertEqual(read(os.path.join(self.local, "n.md")), "new")

    def test_identical_notes_are_unchanged(self):
        write(os.path.join(self.local, "n.md"), "same")
        write(os.path.join(self.remote, "n.md"), "same")
        self.assertEqual(sync(self.local, self.remote).unchanged, ["n"])
