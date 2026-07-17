export function normalizePurchase(purchase) {
  const totalAmount = toMoneyNumber(purchase.totalAmount ?? purchase.amount);
  const rewardsEarned = toMoneyNumber(purchase.rewardsEarned ?? 0);
  const storeName = String(purchase.storeName ?? purchase.store ?? "").trim();
  const category = String(purchase.category ?? "").trim();
  const itemsNotes = String(purchase.itemsNotes ?? purchase.notes ?? "").trim();
  const date = purchase.date || new Date().toISOString().slice(0, 10);

  if (!storeName) throw new Error("Store name is required.");
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error("Total amount must be greater than 0.");
  if (!category) throw new Error("Category is required.");

  return {
    date,
    storeName,
    totalAmount,
    category,
    itemsNotes,
    rewardsEarned
  };
}

function toMoneyNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const normalized = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : Number.NaN;
}
