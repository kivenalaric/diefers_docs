require('dotenv').config();

const express = require('express');
const { downloadSignedPdf, updateContactField, getAssignedUserEmail } = require('./ghl');
const { getOrCreateClientFolder, uploadPdf, shareWithEmail } = require('./drive');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/webhook', async (req, res) => {
  const { email, link } = req.query;
  const contactId = req.query['id'];
  const docName = req.query['doc name'] || req.query['doc_name'] || req.query['contract'] || '';
  const name = req.query['name'] || (email ? email.split('@')[0] : '');
  const attorneyEmail = req.query['attorney_email'] || '';

  console.log(`\n[Webhook] Received — name: "${name}", email: "${email}", doc: "${docName}"`);
  console.log(`[Webhook] viewer link: ${link || '(none)'}`);

  // Respond immediately so GHL doesn't time out
  res.status(200).json({ received: true });

  if (!email) {
    console.error('[Webhook] Missing required param (email). Skipping.');
    return;
  }

  if (!link) {
    console.error('[Webhook] No viewer link provided. Skipping.');
    return;
  }

  processDocument({ name, email, docName, link, contactId, attorneyEmail }).catch((err) => {
    console.error('[Webhook] Unhandled error in processDocument:', err.message || err);
  });
});

async function processDocument({ name, email, docName, link, contactId, attorneyEmail }) {
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

  // 5. Share folder with assigned attorney
  let resolvedAttorneyEmail = attorneyEmail;
  if (!resolvedAttorneyEmail && contactId) {
    try {
      resolvedAttorneyEmail = await getAssignedUserEmail(contactId);
    } catch (err) {
      console.warn(`[GHL] Could not look up attorney via API: ${err.message}`);
    }
  }
  if (resolvedAttorneyEmail) {
    await shareWithEmail(drive, folderId, resolvedAttorneyEmail);
  } else {
    console.warn('[GHL] No attorney email found — skipping attorney folder share');
  }

  // 6. Update GHL contact field with the Drive folder link
  const driveUrl = `https://drive.google.com/drive/folders/${folderId}`;
  if (contactId) {
    await updateContactField(contactId, 'signed_contract_doc', driveUrl);
  } else {
    console.warn('[GHL] No contact ID received — skipping custom field update');
  }

  console.log(`[Done] Document processed successfully for ${name} <${email}>`);
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
