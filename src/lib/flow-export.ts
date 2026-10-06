import type { FlowReport } from "./flow-report"

const ink = "#14241E"
const paper = "#F3EFE6"
const accent = "#0E6B52"
const passFill = "#E4F3EC"
const failFill = "#F8ECDC"
const failInk = "#8D4E14"

export function reportWorkbook(report: FlowReport) {
  const rows = [
    styledRow("brand", ["P", "Promptie flow test"]),
    styledRow("label", ["Store", report.url]),
    styledRow("label", ["Started", report.startedAt]),
    styledRow("label", ["Stripe", report.stripeMode]),
    styledRow("label", ["Coupon", report.couponUsed ? report.couponCode : "Not used"]),
    styledRow("label", ["Order id", report.orderId || "Not created"]),
    styledRow("label", ["Mail id", report.email || "Not entered"]),
    styledRow("label", ["Password set", report.memberPassword || "Not set"]),
    styledRow("head", ["Check", "Result", "Detail"]),
    ...report.checks.map((item) =>
      styledRow(item.status === "pass" ? "pass" : "fail", [item.name, item.status.toUpperCase(), item.detail]),
    ),
  ]
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="brand"><Font ss:Bold="1" ss:Size="16" ss:Color="#FFFFFF"/><Interior ss:Color="${accent}" ss:Pattern="Solid"/></Style>
<Style ss:ID="label"><Font ss:Color="${ink}"/><Interior ss:Color="${paper}" ss:Pattern="Solid"/></Style>
<Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="${ink}" ss:Pattern="Solid"/></Style>
<Style ss:ID="pass"><Font ss:Bold="1" ss:Color="${accent}"/><Interior ss:Color="${passFill}" ss:Pattern="Solid"/></Style>
<Style ss:ID="fail"><Font ss:Bold="1" ss:Color="${failInk}"/><Interior ss:Color="${failFill}" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="Flow test">
<Table>
<Column ss:Width="180"/><Column ss:Width="120"/><Column ss:Width="420"/>
${rows.join("\n")}
</Table>
</Worksheet>
</Workbook>`
}

function styledRow(style: string, cells: string[]) {
  const data = cells
    .map((value) => `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
    .join("")
  return `<Row>${data}</Row>`
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function reportPdf(report: FlowReport) {
  const lines = [
    "Promptie flow test",
    report.url,
    `Stripe ${report.stripeMode}    Coupon ${report.couponUsed ? report.couponCode : "not used"}`,
    `Order id ${report.orderId || "not created"}`,
    `Mail id ${report.email || "not entered"}`,
    `Password set ${report.memberPassword || "not set"}`,
    "",
    ...report.checks.map((item) => `${item.status === "pass" ? "PASS" : "FAIL"}  ${item.name} — ${item.detail}`),
  ]
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += 28) pages.push(lines.slice(index, index + 28))
  const objects: string[] = []
  const kids: string[] = []
  pages.forEach((pageLines, pageIndex) => {
    const commands = [
      "0.078 0.141 0.118 rg",
      "0 760 612 32 re f",
      "0.055 0.420 0.322 rg",
      "36 766 18 18 re f",
      "1 1 1 rg",
      "BT /F1 12 Tf 42 770 Td (P) Tj ET",
      "BT /F2 12 Tf 64 770 Td (Promptie) Tj ET",
      "0.078 0.141 0.118 rg",
    ]
    pageLines.forEach((line, lineIndex) => {
      const y = 730 - lineIndex * 22
      const fail = line.startsWith("FAIL")
      const pass = line.startsWith("PASS")
      if (fail) commands.push("0.553 0.306 0.078 rg")
      else if (pass) commands.push("0.055 0.420 0.322 rg")
      else commands.push("0.078 0.141 0.118 rg")
      commands.push(`BT /F1 10 Tf 36 ${y} Td (${pdfText(line)}) Tj ET`)
    })
    const stream = commands.join("\n")
    const contentId = objects.length + 1
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const pageId = objects.length + 1
    objects.push(
      `<< /Type /Page /Parent ${pages.length * 2 + 3} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${pages.length * 2 + 1} 0 R /F2 ${pages.length * 2 + 2} 0 R >> >> >>`,
    )
    kids.push(`${pageId} 0 R`)
    void pageIndex
  })
  const font1 = objects.length + 1
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  const font2 = objects.length + 1
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
  const pagesId = objects.length + 1
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`)
  const catalogId = objects.length + 1
  objects.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  void font1
  void font2

  let body = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  body += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(body)
}

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 140)
}
