/**
 * FILE: api/_intakeWorkbook.js
 *
 * BUILD THE CONTRACTOR'S NEW PROJECT INTAKE FORM AS A REAL .XLSX.
 *
 * The contractor's instruction is that the form and its documents are emailed
 * in. They have an existing workbook and a person who reads dozens of them a
 * week, so this reproduces their layout — same section order, same row
 * meanings, same wording — rather than inventing a tidier one. A handoff
 * document that makes the receiving coordinator hunt is a handoff document
 * that gets bounced.
 *
 * Formulas are written as VALUES, not as Excel formulas. The arithmetic is
 * already verified in src/project/intakeSchema.js and computed once there; if
 * this file re-expressed it as `=SUM(...)` there would be two implementations
 * of the cost build-up that could disagree — the exact failure this codebase
 * has hit repeatedly. The spreadsheet shows what the app calculated.
 *
 * Used by: api/intake.js
 */
import ExcelJS from 'exceljs';

const money = (v) => (Number(v) || 0);

/** Their palette, approximately — dark header bands with light section rules. */
const HEAD = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9F0' } };
const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2A3D' } };

export async function buildIntakeWorkbook({ intake, costs, services, sellerName = '', contractorName = '' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SolarHealth';
  wb.created = new Date();

  // Sheet named for the customer, as their example was ("Bean").
  const surname = String(intake.customerName || 'Project').trim().split(/\s+/).pop() || 'Project';
  const ws = wb.addWorksheet(surname.slice(0, 28));

  ws.columns = [
    { width: 32 }, { width: 22 }, { width: 12 }, { width: 28 }, { width: 24 }, { width: 16 }
  ];

  const sectionRow = (row, label, col = 1) => {
    const cell = ws.getCell(row, col);
    cell.value = label;
    cell.font = { bold: true, size: 11, color: { argb: 'FF0B2A3D' } };
    cell.fill = SECTION_FILL;
  };
  const pair = (row, label, value, labelCol = 1) => {
    ws.getCell(row, labelCol).value = label;
    ws.getCell(row, labelCol).font = { color: { argb: 'FF475569' } };
    ws.getCell(row, labelCol + 1).value = value == null || value === '' ? '' : value;
    ws.getCell(row, labelCol + 1).font = { bold: true };
  };

  // ---- title ----
  ws.mergeCells('A3:F3');
  const title = ws.getCell('A3');
  title.value = 'New Project Intake Form';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.fill = TITLE_FILL;
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(3).height = 26;

  // ---- customer / rep ----
  sectionRow(5, 'Customer Information');
  sectionRow(5, 'Sales Rep Information', 4);
  pair(6, 'Customer Name:', intake.customerName);
  pair(6, 'Sales Rep Name:', intake.repName, 4);
  pair(7, 'Customer Phone Number:', intake.customerPhone);
  pair(7, 'Date Submitted:', intake.dateSubmitted || new Date().toISOString().slice(0, 10), 4);
  pair(8, 'Email Address:', intake.customerEmail);
  sectionRow(8, 'Payment Information', 4);
  pair(9, 'Home Address:', intake.homeAddress);
  pair(9, 'Payment Type (Cash, Loan, PPA):', intake.paymentType, 4);
  pair(10, 'Finance Company:', intake.financeCompany, 4);
  pair(11, 'Interest Rate:', intake.interestRate === '' || intake.interestRate == null
    ? '' : Number(intake.interestRate), 4);
  ws.getCell(11, 5).numFmt = '0.00%';

  // ---- project details ----
  sectionRow(12, 'Project Details');
  const headers = ['Services Needed', 'Type', 'Quantity', 'Cost', 'Notes'];
  headers.forEach((h, i) => {
    const c = ws.getCell(13, i + 1);
    c.value = h;
    c.font = HEAD;
    c.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });

  let row = 14;
  for (const line of services) {
    const entry = (intake.services && intake.services[line.id]) || {};
    ws.getCell(row, 1).value = line.label;
    ws.getCell(row, 2).value = entry.type || '';
    ws.getCell(row, 3).value = entry.quantity === '' || entry.quantity == null ? '' : Number(entry.quantity);
    ws.getCell(row, 4).value = entry.cost === '' || entry.cost == null ? '' : money(entry.cost);
    ws.getCell(row, 4).numFmt = '$#,##0.00';
    ws.getCell(row, 5).value = entry.notes || '';
    row++;
  }

  // ---- costs ----
  row++;
  sectionRow(row, 'Project Cost'); row++;
  ['Additional Fees', 'Cost', 'Notes'].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h; c.font = HEAD;
    c.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });
  row++;

  const costLine = (label, value, note = '') => {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 2).value = money(value);
    ws.getCell(row, 2).numFmt = '$#,##0.00';
    if (note) ws.getCell(row, 3).value = note;
    row++;
  };

  if (costs.feeApplies) {
    costLine('Loan Fees', costs.loanFees,
      `${(costs.loanFeeRate * 100).toFixed(2)}% of ${money(costs.loanFeeBase).toFixed(2)}`);
  }
  costLine('Commission', costs.commission);

  ws.getCell(row, 1).value = 'Total Project Cost';
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 2).value = money(costs.totalProjectCost);
  ws.getCell(row, 2).numFmt = '$#,##0.00';
  ws.getCell(row, 2).font = { bold: true };
  row++;

  pair(row, 'PE Prepaid Lease? Y/N', intake.prepaidLease ? 'Y' : 'N');
  if (intake.gatewayNote) ws.getCell(row, 3).value = intake.gatewayNote;
  row++;
  pair(row, 'PE Prepaid Amount:', costs.prepaid || '');
  ws.getCell(row, 2).numFmt = '$#,##0.00'; row++;
  pair(row, 'SDCP/SGIP? Enter amount', costs.rebate || '');
  ws.getCell(row, 2).numFmt = '$#,##0.00'; row++;

  ws.getCell(row, 1).value = 'Net Total:';
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 2).value = money(costs.netTotal);
  ws.getCell(row, 2).numFmt = '$#,##0.00';
  ws.getCell(row, 2).font = { bold: true, size: 12 };
  row += 2;

  // ---- documents ----
  sectionRow(row, 'Submission Instructions'); row++;
  ws.getCell(row, 1).value = 'Documents attached with this form';
  ws.getCell(row, 1).font = HEAD;
  row++;
  const docs = Object.values(intake.documents || {});
  if (docs.length === 0) {
    ws.getCell(row, 1).value = '— none attached —';
    ws.getCell(row, 1).font = { color: { argb: 'FFB45309' }, italic: true };
    row++;
  } else {
    for (const d of docs) {
      ws.getCell(row, 1).value = d.label || d.id;
      ws.getCell(row, 2).value = d.filename || '';
      row++;
    }
  }

  row++;
  ws.getCell(row, 1).value = `Submitted via SolarHealth${sellerName ? ` by ${sellerName}` : ''}`
    + `${contractorName ? ` to ${contractorName}` : ''} on ${new Date().toLocaleString('en-US')}.`;
  ws.getCell(row, 1).font = { size: 9, color: { argb: 'FF94A3B8' } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
