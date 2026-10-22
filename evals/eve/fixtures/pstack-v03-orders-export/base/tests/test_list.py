import io
import os
import unittest

from orders.cli import main

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "orders.json")


def run(*argv):
    out = io.StringIO()
    code = main(["--data", DATA, *argv], out=out)
    return code, out.getvalue()


class ListTests(unittest.TestCase):
    def test_lists_all_orders(self):
        code, text = run("list")
        self.assertEqual(code, 0)
        self.assertEqual(len(text.strip().splitlines()), 8)

    def test_since_filters_by_placed_date(self):
        _, text = run("list", "--since", "2026-03-18")
        ids = [line.split()[0] for line in text.strip().splitlines()[1:]]
        self.assertEqual(ids, ["A-1005", "A-1006", "A-1007"])

    def test_status_filter(self):
        _, text = run("list", "--status", "paid")
        ids = [line.split()[0] for line in text.strip().splitlines()[1:]]
        self.assertEqual(ids, ["A-1003", "A-1007"])


if __name__ == "__main__":
    unittest.main()
