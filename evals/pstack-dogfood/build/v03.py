import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit, diff_fingerprint

root = fixture_root("v03-orders-export")
base = {}
base[".gitignore"] = "__pycache__/\n"
base["README.md"] = r'''
# orders

Small CLI over the shop's order snapshot (`data/orders.json`, refreshed nightly).

```sh
python -m orders list --since 2026-03-01 --status shipped
python -m unittest
```
'''
base["orders/__init__.py"] = ""
base["orders/__main__.py"] = r'''
import sys

from .cli import main

sys.exit(main())
'''
base["orders/store.py"] = r'''
import json
from dataclasses import dataclass
from datetime import date

STATUSES = ("pending", "paid", "shipped", "cancelled")


@dataclass(frozen=True)
class Order:
    id: str
    customer: str
    placed_on: date
    status: str
    total_cents: int
    note: str = ""


def load(path):
    with open(path) as fh:
        raw = json.load(fh)
    orders = []
    for item in raw:
        if item["status"] not in STATUSES:
            raise ValueError(f"order {item['id']}: unknown status {item['status']!r}")
        orders.append(
            Order(
                id=item["id"],
                customer=item["customer"],
                placed_on=date.fromisoformat(item["placed_on"]),
                status=item["status"],
                total_cents=int(item["total_cents"]),
                note=item.get("note", ""),
            )
        )
    return orders
'''
base["orders/table.py"] = r'''
def money(cents):
    return f"{cents / 100:,.2f}"


def render(orders):
    rows = [("ID", "PLACED", "STATUS", "TOTAL", "CUSTOMER")]
    rows += [
        (o.id, o.placed_on.isoformat(), o.status, money(o.total_cents), o.customer) for o in orders
    ]
    widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    lines = ["  ".join(cell.ljust(w) for cell, w in zip(row, widths)).rstrip() for row in rows]
    return "\n".join(lines)
'''
base["orders/cli.py"] = r'''
import argparse
import os
import sys
from datetime import date

from . import store, table


def _date(value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a date: {value!r} (expected YYYY-MM-DD)")


def _filters():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--since", type=_date, help="only orders placed on or after this date")
    parser.add_argument("--status", choices=store.STATUSES, help="only orders with this status")
    return parser


def cmd_list(args, out):
    orders = store.load(args.data)
    if args.since:
        orders = [o for o in orders if o.placed_on >= args.since]
    if args.status:
        orders = [o for o in orders if o.status == args.status]
    print(table.render(orders), file=out)
    return 0


def build_parser():
    parser = argparse.ArgumentParser(prog="orders")
    parser.add_argument(
        "--data",
        default=os.environ.get("ORDERS_DATA", "data/orders.json"),
        help="order snapshot to read",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    list_cmd = sub.add_parser("list", parents=[_filters()], help="print orders as a table")
    list_cmd.set_defaults(func=cmd_list)
    return parser


def main(argv=None, out=None):
    args = build_parser().parse_args(argv)
    return args.func(args, out or sys.stdout)
'''
base["data/orders.json"] = r'''
[
  {"id": "A-1001", "customer": "Smith, Jane", "placed_on": "2026-02-11", "status": "shipped", "total_cents": 4599},
  {"id": "A-1002", "customer": "Lee Kwan", "placed_on": "2026-02-27", "status": "cancelled", "total_cents": 1250, "note": "customer asked to cancel"},
  {"id": "A-1003", "customer": "O'Brien Hardware", "placed_on": "2026-03-01", "status": "paid", "total_cents": 128000, "note": "deliver to \"loading dock B\""},
  {"id": "A-1004", "customer": "Martinez, Ana", "placed_on": "2026-03-05", "status": "shipped", "total_cents": 2399},
  {"id": "A-1005", "customer": "Northwind Traders", "placed_on": "2026-03-18", "status": "pending", "total_cents": 56010},
  {"id": "A-1006", "customer": "Chen Wei", "placed_on": "2026-04-02", "status": "shipped", "total_cents": 999, "note": "gift wrap, no invoice"},
  {"id": "A-1007", "customer": "Smith, Jane", "placed_on": "2026-04-09", "status": "paid", "total_cents": 15000}
]
'''
base["tests/__init__.py"] = ""
base["tests/test_list.py"] = r'''
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
'''
base["docs/plans/export.md"] = r'''
# Plan: `orders export --format csv`

Outcome: a CSV export of orders that finance can open directly in a spreadsheet.

1. Add `orders/export.py` with `write_csv(orders, out)` using the standard
   `csv` module so commas, quotes, and newlines in customer names and notes are
   quoted correctly. Columns: `id,customer,placed_on,status,total,note`, with
   `total` formatted as dollars (`45.99`).
2. Register an `export` subcommand in `orders/cli.py` with
   `--format {csv}` (default `csv`) and `--output PATH` (default stdout).
   Build it with `parents=[_filters()]` so its options stay consistent with
   `list`.
3. In the export handler, load orders and apply the `--status` filter the same
   way `list` does, then call `write_csv`.
4. Tests in `tests/test_export.py`: header row, one row per order, quoting of
   `Smith, Jane` and the quoted note, and the status filter. Run
   `python -m unittest`.
'''

change = {}
change["orders/export.py"] = r'''
import csv

from .table import money

COLUMNS = ("id", "customer", "placed_on", "status", "total", "note")


def write_csv(orders, out):
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(COLUMNS)
    for o in orders:
        writer.writerow(
            (o.id, o.customer, o.placed_on.isoformat(), o.status, money(o.total_cents).replace(",", ""), o.note)
        )
'''
change["orders/cli.py"] = r'''
import argparse
import os
import sys
from datetime import date

from . import export, store, table


def _date(value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a date: {value!r} (expected YYYY-MM-DD)")


def _filters():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--since", type=_date, help="only orders placed on or after this date")
    parser.add_argument("--status", choices=store.STATUSES, help="only orders with this status")
    return parser


def cmd_list(args, out):
    orders = store.load(args.data)
    if args.since:
        orders = [o for o in orders if o.placed_on >= args.since]
    if args.status:
        orders = [o for o in orders if o.status == args.status]
    print(table.render(orders), file=out)
    return 0


def cmd_export(args, out):
    orders = store.load(args.data)
    if args.status:
        orders = [o for o in orders if o.status == args.status]
    if args.output:
        with open(args.output, "w", newline="") as fh:
            export.write_csv(orders, fh)
    else:
        export.write_csv(orders, out)
    return 0


def build_parser():
    parser = argparse.ArgumentParser(prog="orders")
    parser.add_argument(
        "--data",
        default=os.environ.get("ORDERS_DATA", "data/orders.json"),
        help="order snapshot to read",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    list_cmd = sub.add_parser("list", parents=[_filters()], help="print orders as a table")
    list_cmd.set_defaults(func=cmd_list)
    export_cmd = sub.add_parser("export", parents=[_filters()], help="export orders")
    export_cmd.add_argument("--format", choices=("csv",), default="csv")
    export_cmd.add_argument("--output", help="write to this file instead of stdout")
    export_cmd.set_defaults(func=cmd_export)
    return parser


def main(argv=None, out=None):
    args = build_parser().parse_args(argv)
    return args.func(args, out or sys.stdout)
'''
change["tests/test_export.py"] = r'''
import csv
import io
import os
import tempfile
import unittest

from orders.cli import main

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "orders.json")


def export(*argv):
    out = io.StringIO()
    code = main(["--data", DATA, "export", *argv], out=out)
    return code, out.getvalue()


class ExportTests(unittest.TestCase):
    def test_header_and_one_row_per_order(self):
        code, text = export("--format", "csv")
        self.assertEqual(code, 0)
        rows = list(csv.reader(io.StringIO(text)))
        self.assertEqual(rows[0], ["id", "customer", "placed_on", "status", "total", "note"])
        self.assertEqual(len(rows), 8)

    def test_quotes_commas_and_quotes(self):
        _, text = export()
        self.assertIn('"Smith, Jane"', text)
        self.assertIn('"deliver to ""loading dock B"""', text)
        rows = list(csv.reader(io.StringIO(text)))
        self.assertEqual(rows[1][1], "Smith, Jane")

    def test_total_is_plain_dollars(self):
        _, text = export()
        rows = {r[0]: r for r in csv.reader(io.StringIO(text))}
        self.assertEqual(rows["A-1003"][4], "1280.00")

    def test_status_filter(self):
        _, text = export("--status", "shipped")
        ids = [r[0] for r in list(csv.reader(io.StringIO(text)))[1:]]
        self.assertEqual(ids, ["A-1001", "A-1004", "A-1006"])

    def test_output_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "orders.csv")
            code, text = export("--output", path)
            self.assertEqual(code, 0)
            self.assertEqual(text, "")
            with open(path, newline="") as fh:
                self.assertEqual(len(list(csv.reader(fh))), 8)


if __name__ == "__main__":
    unittest.main()
'''

write_tree(root, base)
commit(root)
write_tree(root, change)
print(diff_fingerprint(root))
