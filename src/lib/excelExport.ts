import * as XLSX from "xlsx";

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

export function exportToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string
) {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      const val = col.accessor(row);
      return val ?? "";
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-width columns
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...data.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, fileName);
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}
