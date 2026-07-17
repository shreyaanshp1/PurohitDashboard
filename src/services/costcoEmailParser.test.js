import test from "node:test";
import assert from "node:assert/strict";
import { parseCostcoOrderEmail } from "./costcoEmailParser.js";

const sampleBody = `
Thank you for ordering from Costco.com.

Your Order

Executive Gold Star Renewal

Item 35674

$130.00

Quantity 1

Order Number

1295095135

Order Date

June 25, 2026

Membership Number

111864493442

Shipping & Terms

Stop by the membership counter at any Costco location to pick up your new card(s).

Subtotal

$130.00

Shipping & Handling

$0.00

Tax

$0.00

Total

$130.00
`;

test("parses a Costco renewal confirmation into a redacted dashboard record", () => {
  const record = parseCostcoOrderEmail({
    body: sampleBody,
    recipient: "santosh@example.com",
    messageId: "gmail-message-id",
    receivedAt: "2026-06-26T05:38:42",
    subject: "Your Costco.com order number 1295095135 is confirmed"
  });

  assert.equal(record.retailer, "Costco");
  assert.equal(record.accountEmail, "santosh@example.com");
  assert.equal(record.itemName, "Executive Gold Star Renewal");
  assert.equal(record.itemNumber, "35674");
  assert.equal(record.unitPrice, "$130.00");
  assert.equal(record.quantity, "1");
  assert.equal(record.orderNumber, "ending 5135");
  assert.equal(record.membershipNumber, "ending 3442");
  assert.equal(record.orderDate, "June 25, 2026");
  assert.equal(record.subtotal, "$130.00");
  assert.equal(record.tax, "$0.00");
  assert.equal(record.total, "$130.00");
  assert.equal(record.status, "Purchased");
  assert.equal(record.nextAction, "Pick up card at membership counter");
});

test("can keep full identifiers when redaction is disabled", () => {
  const record = parseCostcoOrderEmail({
    body: sampleBody,
    redactIdentifiers: false
  });

  assert.equal(record.orderNumber, "1295095135");
  assert.equal(record.membershipNumber, "111864493442");
});

test("parses a delivery update with order placed date and split item number", () => {
  const record = parseCostcoOrderEmail({
    body: `
Your order was delivered!

Your Order

GE Profile Washer

Item
­1583448­

Quantity
1

Order Number

[1148329891](https://example.com/order)

Order Placed

11/3/2024

Membership Number

­111985512700­
`,
    recipient: "Santosh Aashish <santoshaashish@example.com>",
    subject: "Your Costco.com Order 1148329891 has been delivered"
  });

  assert.equal(record.accountEmail, "santoshaashish@example.com");
  assert.equal(record.itemName, "GE Profile Washer");
  assert.equal(record.itemNumber, "1583448");
  assert.equal(record.orderNumber, "ending 9891");
  assert.equal(record.orderDate, "11/3/2024");
  assert.equal(record.membershipNumber, "ending 2700");
  assert.equal(record.status, "Delivered");
  assert.equal(record.nextAction, "Confirm delivery");
});

test("can read an order number from a cancellation subject", () => {
  const record = parseCostcoOrderEmail({
    body: `
Your Order

Appliance Delivery

Order Placed

11/3/2024
`,
    subject: "Your Costco.com order number 1234567890 has been canceled"
  });

  assert.equal(record.orderNumber, "ending 7890");
  assert.equal(record.status, "Cancelled");
  assert.equal(record.nextAction, "Review cancellation");
});

test("parses a shipped order summary with an HTML product block", () => {
  const record = parseCostcoOrderEmail({
    body: `
<div>Order Shipped</div>
<div>Order Number</div>
<div>1202223060</div>
<div>Order Placed</div>
<div>Jun 7, 2025</div>
<div>Shipping Address</div>
<div>Sasmita Adhikari</div>
<div>16709 GARDEN DR</div>
<div>Uber - Two $50 eGift Cards</div><div>Item # 1844199</div><div>Quantity 2</div>
<div>Subtotal</div>
<div>$99.98</div>
<div>Tax</div>
<div>$0.00</div>
<div>Total</div>
<div>$99.98</div>
`
  });

  assert.equal(record.status, "Shipped");
  assert.equal(record.orderNumber, "ending 3060");
  assert.equal(record.orderDate, "Jun 7, 2025");
  assert.equal(record.itemName, "Uber - Two $50 eGift Cards");
  assert.equal(record.itemNumber, "1844199");
  assert.equal(record.quantity, "2");
  assert.equal(record.subtotal, "$99.98");
  assert.equal(record.tax, "$0.00");
  assert.equal(record.total, "$99.98");
});

test("does not treat Costco footer reminder text as an item", () => {
  const record = parseCostcoOrderEmail({
    body: `
Order Shipped
Thank you for ordering from Costco.com.
Your Order
Sign Up for Email Reminders for the Connection Online
Order Number
1202223060
Order Placed
Jun 7, 2025
Shipping Address
Sasmita Adhikari
16709 GARDEN DR
Uber - Two $50 eGift Cards
Item # 1844199
Quantity 2
Subtotal
$99.98
Tax
$0.00
Total
$99.98
`,
    subject: "Your Costco.com Order Number 1202223060 Was Shipped"
  });

  assert.equal(record.itemName, "Uber - Two $50 eGift Cards");
  assert.equal(record.itemNumber, "1844199");
  assert.equal(record.quantity, "2");
});

test("parses item names when Costco wraps item numbers in zero-width entities", () => {
  const record = parseCostcoOrderEmail({
    body: `
Order Shipped
Order Number
1273840144
Order Placed
Mar 28, 2026
Shipping Address
Sasmita Adhikari
16709 GARDEN DR
>> false | orderItemType >>> Standard | orderItemConfiguredType >>> Standard -->
Seiko 5 Sport Blue Sunray Dial Automatic Men's Watch, 42.5mm
Item # &zwnj;1648035&zwnj;
Quantity 1
Subtotal
$189.99
Shipping & Handling
$0.00
Tax
$11.87
Shipment Total
$201.86
`,
    subject: "Your Costco.com Order Number 1273840144 Was Shipped"
  });

  assert.equal(record.itemName, "Seiko 5 Sport Blue Sunray Dial Automatic Men's Watch, 42.5mm");
  assert.equal(record.itemNumber, "1648035");
  assert.equal(record.quantity, "1");
  assert.equal(record.total, "$201.86");
});
