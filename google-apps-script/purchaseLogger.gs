const DEFAULT_SHEET_NAME = "Purchases";
const PURCHASE_HEADER = [
  "Date",
  "Store Name",
  "Total Amount",
  "Category",
  "Items/Notes",
  "Rewards Earned",
  "Logged At"
];

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("PURCHASE_LOG_SECRET");

    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonResponse({ success: false, error: "Unauthorized purchase log request." });
    }

    const sheetId = properties.getProperty("GOOGLE_SHEET_ID") || payload.sheetId;
    const sheetName = properties.getProperty("GOOGLE_SHEET_NAME") || payload.sheetName || DEFAULT_SHEET_NAME;

    if (!sheetId) {
      return jsonResponse({ success: false, error: "Missing GOOGLE_SHEET_ID script property." });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    ensureHeader(sheet);

    const purchase = payload.purchase || {};
    const row = [
      purchase.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      purchase.storeName || "",
      Number(purchase.totalAmount || 0),
      purchase.category || "",
      purchase.itemsNotes || "",
      Number(purchase.rewardsEarned || 0),
      new Date()
    ];

    sheet.appendRow(row);

    return jsonResponse({
      success: true,
      rowNumber: sheet.getLastRow(),
      sheetName: sheet.getName()
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doGet() {
  return jsonResponse({ success: true, service: "purchase-logger" });
}

function ensureHeader(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, PURCHASE_HEADER.length);
  const existingHeader = headerRange.getValues()[0];
  const hasHeader = existingHeader.some(function (cell) {
    return cell;
  });

  if (!hasHeader) {
    headerRange.setValues([PURCHASE_HEADER]);
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
