import test from "node:test";
import assert from "node:assert/strict";
import { parseUsMintOrderEmail } from "./usMintEmailParser.js";

test("parses a US Mint confirmed order email", () => {
  const record = parseUsMintOrderEmail({
    body: `
Thank you for your order from the United States Mint.

Order Number
USM12345678

Order Date
07/04/2026

Product Name
2026 American Eagle One Ounce Silver Proof Coin

Quantity
3

Subtotal
$285.00

Order Total
$289.95
`,
    recipient: "collector@example.com",
    messageId: "us-mint-message-id",
    receivedAt: "2026-07-04T13:00:00Z",
    subject: "United States Mint order confirmed USM12345678"
  });

  assert.equal(record.retailer, "US Mint");
  assert.equal(record.accountEmail, "collector@example.com");
  assert.equal(record.sourceMessageId, "us-mint-message-id");
  assert.equal(record.orderNumber, "USM12345678");
  assert.equal(record.orderDate, "07/04/2026");
  assert.equal(record.itemName, "2026 American Eagle One Ounce Silver Proof Coin");
  assert.equal(record.quantity, "3");
  assert.equal(record.subtotal, "$285.00");
  assert.equal(record.total, "$289.95");
  assert.equal(record.status, "Confirmed");
  assert.equal(record.nextAction, "Track fulfillment");
});

test("parses inline US Mint labels", () => {
  const record = parseUsMintOrderEmail({
    body: `
Order #: 987654321
Order Date: July 1, 2026
Item: 2026 Morgan and Peace Silver Dollar Reverse Proof Set
Qty: 2
Merchandise Total: $370.00
Total: $379.90
`,
    subject: "Your U.S. Mint order is confirmed"
  });

  assert.equal(record.orderNumber, "987654321");
  assert.equal(record.orderDate, "July 1, 2026");
  assert.equal(record.itemName, "2026 Morgan and Peace Silver Dollar Reverse Proof Set");
  assert.equal(record.quantity, "2");
  assert.equal(record.subtotal, "$370.00");
  assert.equal(record.total, "$379.90");
  assert.equal(record.status, "Confirmed");
});

test("does not treat a US Mint order link URL as the order number", () => {
  const record = parseUsMintOrderEmail({
    body: `
Order Number
https://catalog.usmint.gov/order-history/123
USM99887766
ItemDescription1="2026 Proof Set"
UnitOfMeasure="EA"
Quantity
1
Subtotal
$40.00
Total
$44.95
`,
    subject: "United States Mint order confirmed USM99887766"
  });

  assert.equal(record.orderNumber, "USM99887766");
  assert.equal(record.itemName, "2026 Proof Set");
  assert.equal(record.unitOfMeasure, "EA");
  assert.equal(record.unitType, "EA");
});

test("falls back to dash unit type when UnitOfMeasure is missing", () => {
  const record = parseUsMintOrderEmail({
    body: `
Order Number
123456789
ItemDescription1: 2026 Silver Medal Set
Quantity
1
Total
$99.95
`,
    subject: "United States Mint order confirmed 123456789"
  });

  assert.equal(record.itemName, "2026 Silver Medal Set");
  assert.equal(record.unitOfMeasure, "---");
  assert.equal(record.unitType, "---");
});
