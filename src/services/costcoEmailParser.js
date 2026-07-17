const labels = {
  orderNumber: "Order Number",
  orderDate: "Order Date",
  orderPlaced: "Order Placed",
  membershipNumber: "Membership Number",
  item: "Item",
  quantity: "Quantity",
  subtotal: "Subtotal",
  shippingHandling: "Shipping & Handling",
  tax: "Tax",
  total: "Total",
  shipmentTotal: "Shipment Total"
};

const cleanLines = (body) =>
  String(body)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|td|th|table|li|h[1-6])>/gi, "\n")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&(zwnj|zwj|ZeroWidthSpace);|&#820[3-5];/gi, "")
        .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

const last4 = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : ""; // A MAJOR CHANGE FROM -4 to (0, 10)
};

const redact = (value, shouldRedact) => {
  if (!value) return "";
  return shouldRedact ? `ending ${last4(value)}` : value;
};

const readAfterLabel = (lines, label) => {
  const labelPattern = escapeRegExp(label);
  const inline = lines.find((line) => new RegExp(`^${labelPattern}\\s+.+$`, "i").test(line));
  if (inline) return inline.replace(new RegExp(`^${labelPattern}\\s+`, "i"), "");

  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  return index >= 0 ? lines[index + 1] || "" : "";
};

const readAfterAnyLabel = (lines, labelOptions) => {
  for (const label of labelOptions) {
    const value = readAfterLabel(lines, label);
    if (value) return value;
  }

  return "";
};

export function parseCostcoOrderEmail({
  body,
  recipient = "",
  messageId = "",
  receivedAt = "",
  subject = "",
  redactIdentifiers = true
}) {
  const lines = cleanLines(body);
  const orderIndex = lines.findIndex((line) => /^Your Order$/i.test(line));
  const itemLineIndex = lines.findIndex((line) => isItemLine(line));
  
  // CHANGED: Prioritize reading from the subject before falling back to the body
  const orderNumber = readOrderNumberFromSubject(subject) || readAfterLabel(lines, labels.orderNumber);
  
  const membershipNumber = readAfterLabel(lines, labels.membershipNumber);
  const itemNumber = readItemNumber(lines);
  const status = detectOrderStatus({ body, lines, subject });
  const unitPrice = readUnitPrice(lines, itemLineIndex);
  const itemName = readItemName(lines, orderIndex);

  return {
    retailer: "Costco",
    accountEmail: extractEmailAddress(recipient),
    sourceMessageId: messageId,
    receivedAt,
    itemName,
    itemNumber,
    unitPrice,
    quantity: readQuantity(lines),
    orderNumber: redact(orderNumber, redactIdentifiers),
    orderNumberLast4: last4(orderNumber),
    orderDate: readAfterAnyLabel(lines, [labels.orderDate, labels.orderPlaced]),
    membershipNumber: redact(membershipNumber, redactIdentifiers),
    membershipNumberLast4: last4(membershipNumber),
    subtotal: readAfterLabel(lines, labels.subtotal),
    shippingHandling: readAfterLabel(lines, labels.shippingHandling),
    tax: readAfterLabel(lines, labels.tax),
    total: readAfterAnyLabel(lines, [labels.total, labels.shipmentTotal]),
    status,
    nextAction: nextActionForStatus(status, body)
  };
}

function readItemNumber(lines) {
  const itemLine = lines.find((line) => isItemLine(line));
  if (itemLine) return itemLine.match(/\bItem\s*#?\s*([A-Z0-9-]+)/i)?.[1]?.replace(/\D/g, "") || "";

  const value = readAfterLabel(lines, labels.item);
  return value.replace(/\D/g, "");
}

function readItemName(lines, orderIndex) {
  const fromProductBlock = readItemNameFromProductBlock(lines);
  if (fromProductBlock) return fromProductBlock;

  if (orderIndex < 0) return "";

  const nearbyItemIndex = lines.findIndex(
    (line, index) => index > orderIndex && index <= orderIndex + 8 && (isItemLine(line) || /^Item$/i.test(line))
  );
  const fallbackWindowEnd = nearbyItemIndex >= 0 ? nearbyItemIndex : Math.min(lines.length, orderIndex + 4);

  for (let index = orderIndex + 1; index < fallbackWindowEnd; index += 1) {
    const candidate = cleanItemName(lines[index]);
    if (candidate && isLikelyItemName(candidate)) return candidate;
  }

  return "";
}

function readItemNameFromProductBlock(lines) {
  const itemIndexes = lines
    .map((line, index) => (isItemLine(line) || /^Item$/i.test(line) ? index : -1))
    .filter((index) => index >= 0);

  for (const itemIndex of itemIndexes) {
    if (!hasNearbyQuantity(lines, itemIndex)) continue;

    const inlineName = cleanItemName(lines[itemIndex]?.match(/^(.*?)\s+\bItem\s*#?\s*\d+/i)?.[1] || "");
    if (inlineName && isLikelyItemName(inlineName)) return inlineName;

    const startIndex = Math.max(0, itemIndex - 5);
    for (let index = itemIndex - 1; index >= startIndex; index -= 1) {
      const candidate = cleanItemName(lines[index]);
      if (candidate && isLikelyItemName(candidate)) return candidate;
    }
  }

  return "";
}

function hasNearbyQuantity(lines, itemIndex) {
  return lines.slice(itemIndex, itemIndex + 5).some((line) => /\bQuantity\b/i.test(line));
}

function readQuantity(lines) {
  const directValue = readAfterLabel(lines, labels.quantity);
  if (directValue) return directValue.replace(/[^\d.]/g, "");

  return lines.join(" ").match(/\bQuantity\s+(\d+(?:\.\d+)?)/i)?.[1] || "";
}

function readUnitPrice(lines, itemLineIndex) {
  if (itemLineIndex < 0) return "";

  for (const line of lines.slice(itemLineIndex + 1)) {
    if (isStopLabel(line)) return "";
    if (isMoney(line)) return line;
  }

  return "";
}

function isItemLine(value) {
  return /\bItem\s*#?\s*[A-Z0-9-]+/i.test(value);
}

function detectOrderStatus({ body, lines, subject }) {
  const subjectText = String(subject || "").toLowerCase();
  const leadText = [subject, ...lines.slice(0, 70)].join("\n").toLowerCase();
  const cancellationText = [subject, ...lines.slice(0, 30)].join("\n").toLowerCase();
  const hasLine = (pattern) => lines.some((line) => pattern.test(line));

  if (/cancel(?:led|ed|ation)/.test(cancellationText)) return "Cancelled";
  if (/refund (?:has been|was|will be) (?:issued|processed)/.test(cancellationText)) return "Cancelled";
  if (/delivered/.test(subjectText) || hasLine(/^(your order was delivered!|delivered)$/i)) return "Delivered";
  if (/nearby|out for delivery/.test(subjectText) || hasLine(/^out for delivery$/i)) return "Out for delivery";
  if (/shipped|on (?:its|the) way/.test(subjectText) || hasLine(/^(order shipped|shipped)$/i)) return "Shipped";
  if (/confirmed|purchased/.test(subjectText) || hasLine(/^order purchased$/i) || /thank you for ordering/.test(leadText)) return "Purchased";
  if (/technical and warranty|recent purchase/.test(leadText)) return "Purchased";

  return "Imported";
}

function nextActionForStatus(status, body) {
  if (status === "Cancelled") return "Review cancellation";
  if (status === "Delivered") return "Confirm delivery";
  if (status === "Out for delivery") return "Track delivery";
  if (status === "Shipped") return "Track shipment";
  if (/membership counter/i.test(body || "")) return "Pick up card at membership counter";
  if (status === "Purchased") return "Review order details";
  return "Review email";
}

function readOrderNumberFromSubject(subject) {
  return String(subject || "").match(/order(?:\s+number)?\s+#?\s*(\d{6,})/i)?.[1] || "";
}

function extractEmailAddress(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || String(value || "").trim();
}

function isMoney(value) {
  return /^\$[\d,]+(\.\d{2})?$/.test(value);
}

function cleanItemName(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\bItem\s*#?\s*\d+.*$/i, "")
    .replace(/\bQuantity\s+\d+(?:\.\d+)?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnorableItemCandidate(value) {
  const normalized = value.toLowerCase();
  if (isMoney(value)) return true;
  if (Object.values(labels).some((label) => normalized === label.toLowerCase())) return true;
  if (/^[-\d\s,]+$/.test(value)) return true;
  if (/^\d{3,}/.test(value)) return true;
  if (/\b[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/.test(value)) return true;
  if (/>>|orderitem|tracking|package|phone|consent|customer service|return policy|limited time offers/i.test(value)) return true;
  if (/sign up|email reminders|connection online|costcogrocery|shop confidently|view order|track my/i.test(value)) return true;
  return [
    "shipping address",
    "billing address",
    "order contact information",
    "view order",
    "track my delivery",
    "view or change order",
    "thank you for ordering from costco.com"
  ].includes(normalized);
}

function isLikelyItemName(value) {
  return /[a-z]/i.test(value) && !isIgnorableItemCandidate(value);
}

function isStopLabel(value) {
  return Object.values(labels).some((label) => value.toLowerCase() === label.toLowerCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
