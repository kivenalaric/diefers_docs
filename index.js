require('dotenv').config();

const express = require('express');
const { downloadSignedPdf } = require('./ghl');
const { getOrCreateClientFolder, uploadPdf, shareWithEmail } = require('./drive');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/webhook', async (req, res) => {
  const { name, email, link } = req.query;
  // "doc name" is the document name from {{document.name}}
  const docName = req.query['doc name'] || req.query['doc_name'] || req.query['contract'] || '';

  console.log(`\n[Webhook] Received — name: "${name}", email: "${email}", doc: "${docName}"`);
  console.log(`[Webhook] viewer link: ${link || '(none)'}`);

  // Respond immediately so GHL doesn't time out
  res.status(200).json({ received: true });

  if (!name || !email) {
    console.error('[Webhook] Missing required params (name, email). Skipping.');
    return;
  }

  if (!link) {
    console.error('[Webhook] No viewer link provided. Skipping.');
    return;
  }

  processDocument({ name, email, docName, link }).catch((err) => {
    console.error('[Webhook] Unhandled error in processDocument:', err.message || err);
  });
});

async function processDocument({ name, email, docName, link }) {
  // 1. Extract PDF from the InfoSubmit viewer via headless browser
  const pdfBuffer = await downloadSignedPdf(link);
  console.log(`[GHL] PDF captured — ${pdfBuffer.length} bytes`);

  // 2. Find or create the client's Drive folder
  const { drive, folderId } = await getOrCreateClientFolder(name, email);

  // 3. Upload the PDF
  const fileName = docName
    ? `${docName} - ${name}.pdf`
    : `Signed Document - ${name}.pdf`;

  const fileId = await uploadPdf(drive, folderId, fileName, pdfBuffer);

  // 4. Share folder and file with client
  await shareWithEmail(drive, folderId, email);
  await shareWithEmail(drive, fileId, email);

  console.log(`[Done] Document processed successfully for ${name} <${email}>`);
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
