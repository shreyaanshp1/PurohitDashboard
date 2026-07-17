export function buildGmailQueryBatches({ query, historyStartYear = "", historyEndYear = "" }) {
  const startYear = Number.parseInt(historyStartYear, 10);

  if (!Number.isFinite(startYear)) {
    return [{ label: "Latest", query }];
  }

  const currentYear = new Date().getFullYear();
  const parsedEndYear = Number.parseInt(historyEndYear, 10);
  const endYear = Number.isFinite(parsedEndYear) ? parsedEndYear : currentYear;
  const safeEndYear = Math.min(Math.max(endYear, startYear), currentYear);
  const batches = [];

  for (let year = safeEndYear; year >= startYear; year -= 1) {
    batches.push({
      label: String(year),
      query: `${query} after:${year}/01/01 before:${year + 1}/01/01`
    });
  }

  return batches;
}
