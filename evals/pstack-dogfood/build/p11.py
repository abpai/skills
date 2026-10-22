import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p11-order-fulfilment")
f = {}
f["package.json"] = r'''
{
  "name": "shop-orders",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
'''
f[".gitignore"] = "node_modules/\n"
f["README.md"] = r'''
# shop-orders

Order lifecycle for the storefront: payment, shipping, delivery, cancellation,
and refunds. Orders are persisted as JSON documents (`data/orders.json` in
development; the same document shape in production storage). The customer
order page renders `toCustomerView()`.

```sh
bun test
```
'''
f["src/order.ts"] = r'''
export interface LineItem {
  id: string;
  sku: string;
  quantity: number;
  priceCents: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: LineItem[];
  isPaid: boolean;
  isShipped: boolean;
  isDelivered: boolean;
  isCancelled: boolean;
  isRefunded: boolean;
  trackingNumber?: string;
  statusLabel: string;
}

export function newOrder(id: string, customerId: string, items: LineItem[]): Order {
  return {
    id,
    customerId,
    items,
    isPaid: false,
    isShipped: false,
    isDelivered: false,
    isCancelled: false,
    isRefunded: false,
    statusLabel: "Awaiting payment",
  };
}

export function totalCents(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}
'''
f["src/labels.ts"] = r'''
import type { Order } from "./order";

export function computeLabel(order: Order): string {
  if (order.isCancelled) {
    if (order.isRefunded) return "Cancelled and refunded";
    return "Cancelled";
  }
  if (order.isRefunded) return "Refunded";
  if (order.isDelivered) return "Delivered";
  if (order.isShipped) {
    if (order.trackingNumber) return `Shipped (tracking ${order.trackingNumber})`;
    return "Shipped";
  }
  if (order.isPaid) return "Preparing your order";
  return "Awaiting payment";
}

export function updateLabel(order: Order): void {
  order.statusLabel = computeLabel(order);
}
'''
f["src/actions.ts"] = r'''
import { updateLabel } from "./labels";
import type { Order } from "./order";

export class OrderError extends Error {}

export function pay(order: Order): void {
  if (order.isCancelled) throw new OrderError("order is cancelled");
  if (order.isPaid) throw new OrderError("order is already paid");
  order.isPaid = true;
  updateLabel(order);
}

export function ship(order: Order, trackingNumber: string): void {
  if (!order.isPaid) throw new OrderError("order is not paid");
  if (order.isCancelled) throw new OrderError("order is cancelled");
  if (order.isShipped) throw new OrderError("order already shipped");
  order.isShipped = true;
  order.trackingNumber = trackingNumber;
  updateLabel(order);
}

export function deliver(order: Order): void {
  if (!order.isShipped) throw new OrderError("order has not shipped");
  order.isDelivered = true;
  updateLabel(order);
}

export function cancel(order: Order): void {
  if (order.isDelivered) throw new OrderError("delivered orders cannot be cancelled");
  if (order.isCancelled) return;
  order.isCancelled = true;
  if (order.isPaid) order.isRefunded = true;
  updateLabel(order);
}

export function refund(order: Order): void {
  if (!order.isPaid) throw new OrderError("order was never paid");
  if (order.isRefunded) throw new OrderError("order already refunded");
  order.isRefunded = true;
}
'''
f["src/view.ts"] = r'''
import { totalCents, type Order } from "./order";

export interface CustomerView {
  orderId: string;
  status: string;
  total: string;
  canCancel: boolean;
  canRequestRefund: boolean;
  items: Array<{ sku: string; quantity: number }>;
}

export function toCustomerView(order: Order): CustomerView {
  return {
    orderId: order.id,
    status: order.statusLabel,
    total: `$${(totalCents(order) / 100).toFixed(2)}`,
    canCancel: !order.isCancelled && !order.isDelivered,
    canRequestRefund: order.isPaid && !order.isRefunded && !order.isCancelled,
    items: order.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
  };
}
'''
f["src/store.ts"] = r'''
import type { Order } from "./order";

export function loadOrders(text: string): Order[] {
  return JSON.parse(text) as Order[];
}

export function saveOrders(orders: Order[]): string {
  return JSON.stringify(orders, null, 2);
}
'''
f["data/orders.json"] = r'''
[
  {
    "id": "o-100",
    "customerId": "c-1",
    "items": [{ "id": "li-1", "sku": "MUG-BLUE", "quantity": 2, "priceCents": 1800 }],
    "isPaid": true, "isShipped": true, "isDelivered": true, "isCancelled": false, "isRefunded": false,
    "trackingNumber": "1Z999", "statusLabel": "Delivered"
  },
  {
    "id": "o-101",
    "customerId": "c-2",
    "items": [
      { "id": "li-2", "sku": "TEE-M", "quantity": 1, "priceCents": 2400 },
      { "id": "li-3", "sku": "CAP", "quantity": 1, "priceCents": 1500 }
    ],
    "isPaid": true, "isShipped": false, "isDelivered": false, "isCancelled": false, "isRefunded": false,
    "statusLabel": "Preparing your order"
  },
  {
    "id": "o-102",
    "customerId": "c-3",
    "items": [{ "id": "li-4", "sku": "POSTER", "quantity": 3, "priceCents": 900 }],
    "isPaid": true, "isShipped": false, "isDelivered": false, "isCancelled": true, "isRefunded": true,
    "statusLabel": "Cancelled and refunded"
  },
  {
    "id": "o-103",
    "customerId": "c-1",
    "items": [{ "id": "li-5", "sku": "MUG-RED", "quantity": 1, "priceCents": 1800 }],
    "isPaid": true, "isShipped": true, "isDelivered": true, "isCancelled": false, "isRefunded": true,
    "trackingNumber": "1Z123", "statusLabel": "Delivered"
  }
]
'''
f["tests/actions.test.ts"] = r'''
import { expect, test } from "bun:test";
import { cancel, deliver, OrderError, pay, refund, ship } from "../src/actions";
import { newOrder } from "../src/order";
import { toCustomerView } from "../src/view";

const order = () => newOrder("o-1", "c-1", [{ id: "li-1", sku: "MUG", quantity: 2, priceCents: 1800 }]);

test("happy path labels", () => {
  const o = order();
  expect(toCustomerView(o).status).toBe("Awaiting payment");
  pay(o);
  expect(toCustomerView(o).status).toBe("Preparing your order");
  ship(o, "1Z999");
  expect(toCustomerView(o).status).toBe("Shipped (tracking 1Z999)");
  deliver(o);
  expect(toCustomerView(o)).toMatchObject({ status: "Delivered", total: "$36.00", canCancel: false });
});

test("cancelling a paid order refunds it", () => {
  const o = order();
  pay(o);
  cancel(o);
  expect(o.isRefunded).toBe(true);
  expect(toCustomerView(o).status).toBe("Cancelled and refunded");
});

test("cannot ship before payment", () => {
  expect(() => ship(order(), "x")).toThrow(OrderError);
});

test("refund requires payment", () => {
  expect(() => refund(order())).toThrow("never paid");
});
'''
write_tree(root, f)
commit(root)
