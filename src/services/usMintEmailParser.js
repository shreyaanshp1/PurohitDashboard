const labels = {
  orderNumber: "Order Number",
  orderDate: "Order Date",
  item: "Item",
  product: "Product",
  productName: "Product Name",
  description: "Description",
  itemDescription1: "ItemDescription1",
  itemDescription: "ItemDescription",
  quantity: "Quantity",
  qty: "Qty",
  unitOfMeasure: "UnitOfMeasure",
  unitType: "UnitType",
  subtotal: "Subtotal",
  merchandiseTotal: "Merchandise Total",
  total: "Total",
  orderTotal: "Order Total"
};

const cleanLines = (body) =>
  String(body || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|td|th|table|li|h[1-6])>/gi, "\n")
    .split(/\r?\n/)
    .map((line) =>
      decodeHtmlEntities(line)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

export function parseUsMintOrderEmail({ body, recipient = "", messageId = "", receivedAt = "", subject = "" }) {
  const lines = cleanLines(body);
  const orderNumber = readOrderNumber(lines, subject);
  const itemName = readItemName(lines);
  const itemDescription = readItemDescription(lines);
  const unitOfMeasure = readUnitOfMeasure(lines);
  const quantity = readQuantity(lines);
  const status = detectStatus(subject, lines);

  return {
    retailer: "US Mint",
    accountEmail: extractEmailAddress(recipient),
    sourceMessageId: messageId,
    receivedAt,
    orderNumber,
    orderDate: readAfterAnyLabel(lines, ["Order Date", "Date Ordered", "Order Placed"]),
    itemName: itemDescription || itemName,
    itemDescription: itemDescription || itemName,
    unitOfMeasure: unitOfMeasure || "---",
    unitType: unitOfMeasure || "---",
    quantity,
    subtotal: readMoneyAfterAnyLabel(lines, [labels.subtotal, labels.merchandiseTotal]),
    total: readMoneyAfterAnyLabel(lines, [labels.orderTotal, labels.total]),
    status,
    nextAction: status === "Confirmed" ? "Track fulfillment" : "Review order"
  };
}

function readOrderNumber(lines, subject) {
  const bodyOrderNumber = readOrderNumberFromLabels(lines);
  if (bodyOrderNumber) return bodyOrderNumber;

  const subjectText = String(subject || "");
  return (
    subjectText.match(/\border\s*(?:number|#)\s*[:#]?\s*([A-Z0-9]{5,})/i)?.[1] ||
    subjectText.match(/\bconfirmed\s+([A-Z0-9]{5,})/i)?.[1] ||
    ""
  );
}

function readOrderNumberFromLabels(lines) {
  const labelOptions = ["Order Number", "Order #", "Order No."];

  for (const label of labelOptions) {
    const value = readAfterLabel(lines, label);
    const extracted = extractOrderNumberText(value);
    if (extracted) return extracted;

    const labelPattern = escapeRegExp(label);
    const index = lines.findIndex((line) => new RegExp(`^${labelPattern}\\s*:?$`, "i").test(line));
    if (index < 0) continue;

    for (const nearbyLine of lines.slice(index + 1, index + 5)) {
      const nearbyExtracted = extractOrderNumberText(nearbyLine);
      if (nearbyExtracted) return nearbyExtracted;
    }
  }

  return "";
}

function extractOrderNumberText(value) {
  return String(value || "")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .match(/\b(?:USM)?[A-Z0-9]{5,}\b/i)?.[0] || "";
}

function readItemDescription(lines) {
  const labeledValue =
    readVariableValue(lines, [labels.itemDescription1, labels.itemDescription]) ||
    readAfterAnyLabel(lines, [labels.itemDescription1, labels.itemDescription]);
  if (labeledValue && isLikelyItemName(labeledValue)) return cleanItemName(labeledValue);
  return "";
}

function readUnitOfMeasure(lines) {
  const value =
    readVariableValue(lines, [labels.unitOfMeasure, labels.unitType]) ||
    readAfterAnyLabel(lines, [labels.unitOfMeasure, labels.unitType]);
  return value ? value.split(/\s+/)[0].trim() : "";
}

function readItemName(lines) {
  const labeledValue = readAfterAnyLabel(lines, [labels.item, labels.productName, labels.product, labels.description]);
  const labeledCandidate = cleanItemName(labeledValue);
  if (labeledCandidate && isLikelyItemName(labeledCandidate)) return labeledCandidate;

  const quantityIndex = lines.findIndex((line) => /^(qty|quantity)\b/i.test(line));
  const stopIndex = quantityIndex >= 0 ? quantityIndex : lines.findIndex((line) => /^subtotal\b/i.test(line));
  const searchEnd = stopIndex >= 0 ? stopIndex : Math.min(lines.length, 40);

  for (let index = 0; index < searchEnd; index += 1) {
    const candidate = cleanItemName(lines[index]);
    if (candidate && isLikelyItemName(candidate)) return candidate;
  }

  return "";
}

function readQuantity(lines) {
  const directValue = readAfterAnyLabel(lines, [labels.quantity, labels.qty]);
  const directMatch = directValue.match(/\d+(?:\.\d+)?/);
  if (directMatch) return directMatch[0];

  const inlineMatch = lines.join(" ").match(/\b(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i);
  return inlineMatch?.[1] || "";
}

function readMoneyAfterAnyLabel(lines, labelOptions) {
  for (const label of labelOptions) {
    const value = readMoneyAfterLabel(lines, label);
    if (value) return value;
  }

  return "";
}

function readMoneyAfterLabel(lines, label) {
  const labelPattern = escapeRegExp(label);
  const inline = lines.find((line) => new RegExp(`^${labelPattern}\\b`, "i").test(line) && moneyFromText(line));
  if (inline) return moneyFromText(inline);

  const index = lines.findIndex((line) => new RegExp(`^${labelPattern}$`, "i").test(line));
  if (index < 0) return "";

  for (const line of lines.slice(index + 1, index + 5)) {
    const money = moneyFromText(line);
    if (money) return money;
  }

  return "";
}

function readAfterAnyLabel(lines, labelOptions) {
  for (const label of labelOptions) {
    const value = readAfterLabel(lines, label);
    if (value) return value;
  }

  return "";
}

function readAfterLabel(lines, label) {
  const labelPattern = escapeRegExp(label);
  const inline = lines.find((line) => new RegExp(`^${labelPattern}\\s*:?\\s+.+$`, "i").test(line));
  if (inline) return inline.replace(new RegExp(`^${labelPattern}\\s*:?\\s+`, "i"), "");

  const index = lines.findIndex((line) => new RegExp(`^${labelPattern}\\s*:?$`, "i").test(line));
  return index >= 0 ? lines[index + 1] || "" : "";
}

function readVariableValue(lines, variableNames) {
  for (const line of lines) {
    for (const variableName of variableNames) {
      const variablePattern = escapeRegExp(variableName);
      const quoted = line.match(new RegExp(`["']?${variablePattern}["']?\\s*[:=]\\s*["']([^"']+)["']`, "i"));
      if (quoted?.[1]) return quoted[1].trim();

      const bare = line.match(new RegExp(`["']?${variablePattern}["']?\\s*[:=]\\s*([^|,]+)`, "i"));
      if (bare?.[1]) return bare[1].trim();
    }
  }

  return "";
}

function cleanItemName(value) {
  return String(value || "")
    .replace(/\b(?:item|product|product name|description)\s*:?/i, "")
    .replace(/\b(?:qty|quantity|subtotal|total)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyItemName(value) {
  if (!value || value.length < 4) return false;
  if (isMoney(value) || /^\d+$/.test(value)) return false;
  if (/^(order|order number|order date|subtotal|total|qty|quantity|shipping|billing|payment|thank you|confirmed)$/i.test(value)) {
    return false;
  }
  if (/^(us mint|u\.s\. mint|united states mint)$/i.test(value)) return false;
  if (/united states mint|customer service|privacy policy|terms of use|unsubscribe|view order/i.test(value)) return false;
  return /coin|medal|proof|set|roll|bag|silver|gold|mint|eagle|dollar|quarter|commemorative|uncirculated/i.test(value);
}

function detectStatus(subject, lines) {
  const text = [subject, ...lines.slice(0, 20)].join(" ").toLowerCase();
  return /confirm|confirmed/.test(text) ? "Confirmed" : "Imported";
}

function moneyFromText(value) {
  return String(value || "").match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
}

function isMoney(value) {
  return /^\$[\d,]+(?:\.\d{2})?$/.test(value);
}

function extractEmailAddress(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || String(value || "").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&reg;/gi, "")
    .replace(/&trade;/gi, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
