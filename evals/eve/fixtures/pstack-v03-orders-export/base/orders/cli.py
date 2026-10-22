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
