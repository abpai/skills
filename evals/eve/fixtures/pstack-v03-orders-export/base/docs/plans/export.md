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
