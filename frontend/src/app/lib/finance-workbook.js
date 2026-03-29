const escapeXml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const normalizeSheetName = (value, index) => {
    const sanitized = String(value || `Sheet${index + 1}`)
        .replace(/[\\/*?:[\]]/g, " ")
        .trim()
        .slice(0, 31);
    return sanitized || `Sheet${index + 1}`;
};

const inferCellType = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return { type: "Number", value: String(value) };
    }
    return { type: "String", value: escapeXml(value ?? "") };
};

export function exportFinanceWorkbook({ fileName, sheets }) {
    const worksheetXml = sheets.map((sheet, sheetIndex) => {
        const sheetName = normalizeSheetName(sheet.name, sheetIndex);
        const headerRow = `
            <Row ss:StyleID="header">
              ${sheet.columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`).join("")}
            </Row>
        `;
        const dataRows = sheet.rows.map((row) => `
            <Row>
              ${sheet.columns.map((column) => {
                  const cell = inferCellType(row[column.key]);
                  return `<Cell><Data ss:Type="${cell.type}">${cell.value}</Data></Cell>`;
              }).join("")}
            </Row>
        `).join("");

        return `
          <Worksheet ss:Name="${escapeXml(sheetName)}">
            <Table>
              ${headerRow}
              ${dataRows}
            </Table>
          </Worksheet>
        `;
    }).join("");

    const workbookXml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#DCE8FF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheetXml}
</Workbook>`;

    const blob = new Blob([workbookXml], { type: "application/vnd.ms-excel" });
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName || "finance-workbook.xls";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}
