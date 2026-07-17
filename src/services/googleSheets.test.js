import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchaseRow, normalizePurchaseForSheet, parseGoogleSheetsResponse } from "./googleSheets.js";

test("normalizes purchase data for Google Sheets", () => {
  const purchase = normalizePurchaseForSheet({
    date: "2026-06-28",
    storeName: "Costco",
    totalAmount: "$124.50",
    category: "Groceries",
    itemsNotes: "Coffee, snacks",
    rewardsEarned: "2.49"
  });

  assert.deepEqual(purchase, {
    date: "2026-06-28",
    storeName: "Costco",
    totalAmount: 124.5,
    category: "Groceries",
    itemsNotes: "Coffee, snacks",
    rewardsEarned: 2.49
  });
});

test("builds the purchase row in the expected column order", () => {
  assert.deepEqual(
    buildPurchaseRow({
      date: "2026-06-28",
      storeName: "Target",
      totalAmount: 55.5,
      category: "Household",
      itemsNotes: "Paper towels",
      rewardsEarned: 0.56
    }),
    ["2026-06-28", "Target", 55.5, "Household", "Paper towels", 0.56]
  );
});

test("rejects Apps Script sign-in HTML instead of treating it as success", () => {
  assert.throws(
    () => parseGoogleSheetsResponse("<!DOCTYPE html><html><title>Sign in - Google Accounts</title></html>"),
    /Apps Script returned an HTML page/
  );
});
