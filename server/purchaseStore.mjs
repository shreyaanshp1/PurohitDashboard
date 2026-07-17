import { appendPurchaseToSupabase, listRecentPurchasesFromSupabase } from "./supabaseClient.mjs";

export async function appendPurchase(purchase) {
  const driver = getStorageDriver();

  if (driver === "supabase") {
    return appendPurchaseToSupabase(purchase);
  }

  throw unsupportedDriverError(driver);
}

export async function listRecentPurchases(limit) {
  const driver = getStorageDriver();

  if (driver === "supabase") {
    return listRecentPurchasesFromSupabase(limit);
  }

  throw unsupportedDriverError(driver);
}

function getStorageDriver() {
  return (process.env.PURCHASE_STORAGE_DRIVER || "supabase").toLowerCase();
}

function unsupportedDriverError(driver) {
  return new Error(`Unsupported PURCHASE_STORAGE_DRIVER: ${driver}. Airtable is disabled; use PURCHASE_STORAGE_DRIVER=supabase.`);
}
