import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_UPLOAD_DIR = "uploads/receipts";
const DEFAULT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function saveReceiptFile(file) {
  const normalized = normalizeFilePayload(file);
  const buffer = decodeFileData(normalized.data);
  const maxBytes = Number(process.env.RECEIPT_FILE_MAX_BYTES || DEFAULT_MAX_FILE_BYTES);

  if (!buffer.length) throw new Error("Receipt file is empty.");
  if (buffer.length > maxBytes) throw new Error("Receipt file is too large.");

  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFileName(normalized.fileName)}`;
  const filePath = path.join(uploadDir(), storedName);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer, { mode: 0o600 });

  return {
    success: true,
    file: {
      fileName: normalized.fileName,
      storedName,
      contentType: normalized.contentType,
      size: buffer.length,
      url: `/api/receipt-files/${encodeURIComponent(storedName)}`
    }
  };
}

export async function readReceiptFile(storedName) {
  const safeName = sanitizeFileName(storedName);
  if (safeName !== storedName) throw new Error("Invalid receipt file name.");

  const filePath = path.join(uploadDir(), safeName);
  const buffer = await readFile(filePath);

  return {
    buffer,
    contentType: contentTypeForFile(safeName)
  };
}

function normalizeFilePayload(file) {
  const fileName = String(file.fileName || file.name || "").trim();
  const contentType = String(file.contentType || file.type || "application/octet-stream").trim();
  const data = String(file.data || "").trim();

  if (!fileName) throw new Error("Receipt file name is required.");
  if (!data) throw new Error("Receipt file data is required.");

  return {
    fileName,
    contentType,
    data
  };
}

function decodeFileData(data) {
  const [, base64 = data] = data.match(/^data:[^;]+;base64,(.+)$/) || [];
  return Buffer.from(base64, "base64");
}

function uploadDir() {
  const configured = process.env.RECEIPT_FILE_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function sanitizeFileName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function contentTypeForFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const types = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp"
  };

  return types[ext] || "application/octet-stream";
}
