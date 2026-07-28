// utils/watermark.js
// Ajoute un filigrane discret (nom acheteur + n° commande + date) sur chaque page d'un PDF.
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { readFileBytes } = require('./fileStorage');

async function watermarkPdf(source, { buyerName, orderNumber, date }) {
  const bytes = await readFileBytes(source);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const label = `Achete par : ${buyerName} — Commande #${orderNumber} — ${date}`;

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(label, {
      x: width * 0.08,
      y: height * 0.04,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.55,
      rotate: degrees(0),
    });
  }
  return pdfDoc.save();
}

// Genere un aperçu contenant uniquement les N premieres pages du PDF complet.
async function extractPreview(source, numPages) {
  const bytes = await readFileBytes(source);
  const srcDoc = await PDFDocument.load(bytes);
  const outDoc = await PDFDocument.create();
  const total = srcDoc.getPageCount();
  const take = Math.min(numPages, total);
  const indices = Array.from({ length: take }, (_, i) => i);
  const copied = await outDoc.copyPages(srcDoc, indices);
  copied.forEach((p) => outDoc.addPage(p));
  return outDoc.save();
}

module.exports = { watermarkPdf, extractPreview };
