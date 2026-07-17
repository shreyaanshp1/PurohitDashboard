import React, { useEffect, useMemo, useRef, useState } from "react";
import { DollarSign, FileUp, FolderPlus, LoaderCircle, ReceiptText, X } from "lucide-react";
import { appendReceipt, uploadReceiptFile } from "../services/purchaseLog.js";
import { useToast } from "./ToastProvider.jsx";

const NEW_FOLDER_VALUE = "__new_retailer_folder__";

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  folderId: NEW_FOLDER_VALUE,
  newRetailer: "",
  amount: "",
  receiptFile: null,
  receiptUrl: "",
  notes: ""
};

export default function ReceiptLogger({ folders = [], onClose, onFolderCreated, onReceiptSaved }) {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const { notifyError, notifySuccess } = useToast();

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => folderName(a).localeCompare(folderName(b))),
    [folders]
  );

  useEffect(() => {
    if (sortedFolders.length && form.folderId === NEW_FOLDER_VALUE && !form.newRetailer) {
      setForm((current) => ({ ...current, folderId: sortedFolders[0].id }));
    }
  }, [form.folderId, form.newRetailer, sortedFolders]);

  const isNewFolder = form.folderId === NEW_FOLDER_VALUE || sortedFolders.length === 0;
  const selectedFolder = sortedFolders.find((folder) => folder.id === form.folderId);
  const retailer = isNewFolder ? form.newRetailer.trim() : folderName(selectedFolder);
  const hasReceiptDetail = Boolean(form.amount || form.receiptFile || form.notes.trim());
  const canCreateFolder = isNewFolder && retailer && !isSubmitting;
  const canSubmit = retailer && hasReceiptDetail && !isSubmitting;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleFileChange(event) {
    const [file] = event.target.files || [];
    updateField("receiptFile", file || null);
  }

  async function handleCreateFolderOnly() {
    if (!canCreateFolder) return;

    setIsSubmitting(true);

    try {
      const folder = await createFolder(retailer);
      setForm((current) => ({ ...current, folderId: folder.id, newRetailer: "" }));
      notifySuccess(`${folder.name} folder is ready in Supabase.`);
    } catch (error) {
      console.error("Failed to create receipt folder", error);
      notifyError("Failed to create folder.", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const folder = isNewFolder ? await createFolder(retailer) : selectedFolder;
      const uploadResult = form.receiptFile ? await uploadReceiptFile(form.receiptFile) : null;
      const uploadedFile = uploadResult?.file || null;
      const result = await appendReceipt({
        date: form.date,
        retailer,
        folderName: folderName(folder) || retailer,
        totalAmount: form.amount,
        receiptUrl: uploadedFile?.url || form.receiptUrl,
        receiptFileName: uploadedFile?.fileName || form.receiptFile?.name || "",
        receiptContentType: uploadedFile?.contentType || form.receiptFile?.type || "",
        notes: form.notes
      });

      notifySuccess(`Receipt saved for ${retailer}.`);
      onReceiptSaved?.(result.receipt);
      setForm({ ...initialForm, date: new Date().toISOString().slice(0, 10), folderId: folder.id });
      onClose?.();
    } catch (error) {
      console.error("Failed to save receipt", error);
      notifyError("Failed to save receipt.", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createFolder(name) {
    const result = await onFolderCreated({ name, retailer: name });
    return result?.folder || result;
  }

  return (
    <article className="purchase-logger receipt-logger">
      <div className="purchase-logger__header">
        <div>
          <p className="eyebrow">Receipt filing</p>
          <h3>Add a Receipt</h3>
        </div>
        {onClose ? (
          <button className="icon-button purchase-logger__close" onClick={onClose} title="Close" type="button">
            <X size={17} />
          </button>
        ) : null}
      </div>

      <form className="purchase-form" onSubmit={handleSubmit}>
        <label>
          <span>Date</span>
          <input onChange={(event) => updateField("date", event.target.value)} type="date" value={form.date} />
        </label>

        <label>
          <span>Retailer Folder</span>
          <select onChange={(event) => updateField("folderId", event.target.value)} value={isNewFolder ? NEW_FOLDER_VALUE : form.folderId}>
            {sortedFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderName(folder)}
              </option>
            ))}
            <option value={NEW_FOLDER_VALUE}>New retailer folder</option>
          </select>
        </label>

        {isNewFolder ? (
          <label>
            <span>Retailer</span>
            <input
              onChange={(event) => updateField("newRetailer", event.target.value)}
              placeholder="Retailer name"
              value={form.newRetailer}
            />
          </label>
        ) : null}

        <label>
          <span>Total</span>
          <div className="input-with-icon">
            <DollarSign size={16} />
            <input
              min="0"
              onChange={(event) => updateField("amount", event.target.value)}
              placeholder="Optional"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </div>
        </label>

        <label className={isNewFolder ? "" : "purchase-form__wide"}>
          <span>Receipt File</span>
          <input
            className="visually-hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
          />
          <button className="file-picker-button" onClick={() => fileInputRef.current?.click()} type="button">
            <FileUp size={17} />
            <span>{form.receiptFile?.name || "Select File"}</span>
          </button>
        </label>

        <label className="purchase-form__wide">
          <span>Notes</span>
          <textarea
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Receipt details"
            rows="3"
            value={form.notes}
          />
        </label>

        <div className="form-actions">
          {isNewFolder ? (
            <button className="secondary-action" disabled={!canCreateFolder} onClick={handleCreateFolderOnly} type="button">
              <FolderPlus size={18} />
              <span>{isSubmitting ? "Creating..." : "Create Folder"}</span>
            </button>
          ) : null}
          <button className="purchase-submit" disabled={!canSubmit} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <ReceiptText size={18} />}
            <span>{isSubmitting ? "Saving..." : "Save Receipt"}</span>
          </button>
        </div>
      </form>
    </article>
  );
}

function folderName(folder) {
  return folder?.retailer || folder?.name || "";
}
