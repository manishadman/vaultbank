import PDFDocument from 'pdfkit';
import { formatCad } from '../lib/money.js';

function formatAmount(minor) {
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

export function toCsv(transactions) {
  const header = ['reference', 'createdAt', 'type', 'status', 'description', 'amountCad', 'currency'];
  const lines = transactions.map((tx) =>
    [
      tx.referenceNumber,
      new Date(tx.createdAt).toISOString(),
      tx.type,
      tx.status,
      `"${tx.description.replaceAll('"', '""')}"`,
      formatAmount(tx.amountMinor),
      tx.currency,
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function toPdf(transactions, user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('VaultBank statement');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444').text('Educational simulator. These figures are not real money.');
    doc.text(`Customer: ${user.fullName} <${user.email}>`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();
    doc.fillColor('#111').fontSize(10);
    for (const tx of transactions) {
      doc.text(
        `${new Date(tx.createdAt).toISOString().slice(0, 16).replace('T', ' ')}  ${tx.referenceNumber}  ${tx.type}  ${tx.status}`,
      );
      doc.text(`${tx.description}    ${formatCad(tx.amountMinor)} ${tx.currency}`);
      doc.moveDown(0.4);
    }
    if (!transactions.length) doc.text('No transactions matched this statement.');
    doc.end();
  });
}
