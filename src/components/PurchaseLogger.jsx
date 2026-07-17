import React, { useMemo, useState } from "react";
import { DollarSign, LoaderCircle, ReceiptText, Sparkles, X } from "lucide-react";
import { appendPurchase } from "../services/purchaseLog.js";
import { useToast } from "./ToastProvider.jsx";

const storeProfiles = {
  Costco: {
    categories: ["Warehouse", "Gift Cards", "Membership", "Electronics", "Groceries", "Travel", "Gas", "Other"],
    hint: "Best for warehouse receipts, renewals, gift cards, and Costco.com purchases.",
    notesPlaceholder: "Order #, item names, membership used, buyer, resale notes...",
    rewardRate: 0.02,
    rewardLabel: "Executive 2% estimate"
  },
  Target: {
    categories: ["Household", "Groceries", "Electronics", "Online", "Personal Care", "Other"],
    hint: "Capture Circle promos, card discounts, and fulfillment notes.",
    notesPlaceholder: "Promo, pickup/shipping status, buyer, item notes...",
    rewardRate: 0.01,
    rewardLabel: "Base reward estimate"
  },
  Amazon: {
    categories: ["Online", "Electronics", "Household", "Business Supplies", "Returns", "Other"],
    hint: "Useful for marketplace orders, returns, and reimbursement tracking.",
    notesPlaceholder: "ASIN/order ID, seller, return window, buyer...",
    rewardRate: 0.01,
    rewardLabel: "Base reward estimate"
  },
  "Grocery Store": {
    categories: ["Groceries", "Household", "Dining", "Other"],
    hint: "Quick logging for everyday spend and grocery card rewards.",
    notesPlaceholder: "Store location, key items, coupon notes...",
    rewardRate: 0.01,
    rewardLabel: "Base reward estimate"
  },
  Walmart: {
    categories: ["Household", "Groceries", "Online", "Electronics", "Other"],
    hint: "Track store, pickup, and shipped Walmart purchases.",
    notesPlaceholder: "Order #, pickup/shipping status, item notes...",
    rewardRate: 0.01,
    rewardLabel: "Base reward estimate"
  },
  Other: {
    categories: ["Online", "Household", "Electronics", "Dining", "Travel", "Other"],
    hint: "Use this for any source that does not have a dedicated flow yet.",
    notesPlaceholder: "Source, order #, items, buyer, special handling...",
    rewardRate: 0.01,
    rewardLabel: "Base reward estimate"
  }
};

const stores = Object.keys(storeProfiles);

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  store: "Costco",
  customStore: "",
  amount: "",
  category: "Groceries",
  notes: "",
  rewardsEarned: ""
};

export default function PurchaseLogger({ onClose }) {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notifyError, notifySuccess } = useToast();

  const storeName = form.store === "Other" ? form.customStore.trim() : form.store;
  const amount = Number.parseFloat(form.amount || "0");
  const storeProfile = storeProfiles[form.store] || storeProfiles.Other;
  const estimatedRewards = useMemo(() => estimateRewards(amount, storeProfile.rewardRate), [amount, storeProfile.rewardRate]);
  const rewardsEarned = form.rewardsEarned === "" ? estimatedRewards : Number.parseFloat(form.rewardsEarned);
  const canSubmit = storeName && amount > 0 && form.category && !isSubmitting;

  function updateField(field, value) {
    setForm((current) => {
      if (field !== "store") return { ...current, [field]: value };

      const nextProfile = storeProfiles[value] || storeProfiles.Other;
      const nextCategory = nextProfile.categories.includes(current.category) ? current.category : nextProfile.categories[0];
      return { ...current, store: value, category: nextCategory, rewardsEarned: "" };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      await appendPurchase({
        date: form.date,
        storeName,
        totalAmount: amount,
        category: form.category,
        itemsNotes: form.notes,
        rewardsEarned
      });

      notifySuccess(`Successfully logged ${formatCurrency(amount)} at ${storeName}!`);
      setForm({ ...initialForm, date: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      console.error("Failed to log purchase", error);
      notifyError("Failed to log purchase. Please try again.", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="purchase-logger">
      <div className="purchase-logger__header">
        <div>
          <p className="eyebrow">Purchase logging</p>
          <h3>Log a Purchase</h3>
        </div>
        <span className="purchase-logger__badge">
          <Sparkles size={15} />
          {storeProfile.rewardLabel}
        </span>
        {onClose ? (
          <button className="icon-button purchase-logger__close" onClick={onClose} title="Close" type="button">
            <X size={17} />
          </button>
        ) : null}
      </div>

      <div className="purchase-logger__context">
        <div>
          <span>{storeName || form.store}</span>
          <strong>{estimatedRewards ? formatCurrency(estimatedRewards) : "$0.00"}</strong>
        </div>
        <p>{storeProfile.hint}</p>
      </div>

      <form className="purchase-form" onSubmit={handleSubmit}>
        <label>
          <span>Date</span>
          <input onChange={(event) => updateField("date", event.target.value)} type="date" value={form.date} />
        </label>

        <label>
          <span>Store</span>
          <select onChange={(event) => updateField("store", event.target.value)} value={form.store}>
            {stores.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </label>

        {form.store === "Other" ? (
          <label>
            <span>Store name</span>
            <input
              onChange={(event) => updateField("customStore", event.target.value)}
              placeholder="Local market"
              value={form.customStore}
            />
          </label>
        ) : null}

        <label>
          <span>Amount</span>
          <div className="input-with-icon">
            <DollarSign size={16} />
            <input
              min="0"
              onChange={(event) => updateField("amount", event.target.value)}
              placeholder="124.50"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </div>
        </label>

        <label>
          <span>Category</span>
          <select onChange={(event) => updateField("category", event.target.value)} value={form.category}>
            {storeProfile.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Rewards earned</span>
          <input
            min="0"
            onChange={(event) => updateField("rewardsEarned", event.target.value)}
            placeholder={estimatedRewards ? formatCurrency(estimatedRewards) : "$0.00"}
            step="0.01"
            type="number"
            value={form.rewardsEarned}
          />
        </label>

        <label className="purchase-form__wide">
          <span>Items / Notes</span>
          <textarea
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder={storeProfile.notesPlaceholder}
            rows="3"
            value={form.notes}
          />
        </label>

        <button className="purchase-submit" disabled={!canSubmit} type="submit">
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <ReceiptText size={18} />}
          <span>{isSubmitting ? "Logging..." : "Log Purchase"}</span>
        </button>
      </form>
    </article>
  );
}

function estimateRewards(amount, rewardRate) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Number((amount * rewardRate).toFixed(2));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}
