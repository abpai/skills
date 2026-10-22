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
