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
