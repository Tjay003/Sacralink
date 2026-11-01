/**
 * RFC 4180 compliant CSV export utility with UTF-8 Byte Order Mark (BOM).
 *
 * Ensures full compatibility with Microsoft Excel, Google Sheets, Numbers,
 * and handles special characters (commas, newlines, quotes, '#', and unicode symbols).
 */

/**
 * Escapes a cell value according to RFC 4180:
 * - Wraps empty, null, or undefined values safely as empty string.
 * - Wraps fields containing commas, double quotes, or newlines in double quotes.
 * - Replaces any internal double quotes with two double quotes ("").
 */
export function escapeCsvCell(cell: unknown): string {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Builds an RFC 4180 compliant CSV string with CRLF (\r\n) line terminators.
 */
export function buildCsvString(rows: unknown[][]): string {
    return rows
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');
}

/**
 * Triggers a client-side download of a CSV file using a UTF-8 BOM Blob and temporary object URL.
 */
export function downloadCsv(filename: string, rows: unknown[][]): void {
    const csvContent = buildCsvString(rows);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
