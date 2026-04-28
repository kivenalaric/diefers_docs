const axios = require('axios');
const puppeteer = require('puppeteer');

/**
 * Downloads the signed PDF.
 *
 * Primary:  GET /proposals/document/pdf?referenceId={uuid}
 *           Requires an agency-level or Private Integration API key.
 *           Returns 401 with a location key — swap GHL_API_KEY for an agency key to enable this.
 *
 * Fallback: Headless browser renders the InfoSubmit viewer and uses page.pdf()
 *           to capture the fully-rendered document. Works with any key.
 */
async function downloadSignedPdf(viewerUrl) {
  const referenceId = (viewerUrl.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1];
  if (!referenceId) throw new Error(`Could not extract referenceId from: ${viewerUrl}`);

  // --- Primary: direct API download (needs agency/private-integration key) ---
  try {
    const pdfUrl = `https://services.leadconnectorhq.com/proposals/document/pdf?referenceId=${referenceId}`;
    console.log(`[GHL] Trying direct PDF download: ${pdfUrl}`);
    const res = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
      validateStatus: null,
    });

    if (res.status === 200) {
      const buf = Buffer.from(res.data);
      if (buf.subarray(0, 4).toString('ascii') === '%PDF') {
        console.log(`[GHL] PDF downloaded via API (${buf.length} bytes)`);
        return buf;
      }
    }
    console.log(`[GHL] Direct API returned ${res.status} — falling back to browser renderer`);
  } catch (err) {
    console.log(`[GHL] Direct API error: ${err.message} — falling back to browser renderer`);
  }

  // --- Fallback: render the viewer page and export as PDF ---
  console.log('[GHL] Launching browser to render document viewer...');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set a realistic viewport so the document renders at full width
    await page.setViewport({ width: 1200, height: 900 });

    // Navigate — viewer may return 404 for HTML but the SPA still renders
    await page.goto(viewerUrl, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});

    // Extra wait for any deferred rendering after network goes idle
    await new Promise((r) => setTimeout(r, 5000));

    // Capture the rendered page as a PDF
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    const buf = Buffer.from(pdfBytes);
    console.log(`[GHL] PDF captured via browser renderer (${buf.length} bytes)`);
    return buf;
  } finally {
    await browser.close();
  }
}

async function getAssignedUserEmail(contactId) {
  const contactRes = await axios.get(
    `https://services.leadconnectorhq.com/contacts/${contactId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
    }
  );

  const assignedUserId = contactRes.data.contact?.assignedTo;
  if (!assignedUserId) {
    console.log(`[GHL] No assigned user found for contact ${contactId}`);
    return null;
  }

  const userRes = await axios.get(
    `https://services.leadconnectorhq.com/users/${assignedUserId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
    }
  );

  const email = userRes.data.email;
  console.log(`[GHL] Assigned attorney email: ${email}`);
  return email;
}

async function updateContactField(contactId, fieldKey, value) {
  await axios.put(
    `https://services.leadconnectorhq.com/contacts/${contactId}`,
    { customFields: [{ key: fieldKey, field_value: value }] },
    {
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    }
  );
  console.log(`[GHL] Updated contact ${contactId} field "${fieldKey}" = ${value}`);
}

module.exports = { downloadSignedPdf, updateContactField, getAssignedUserEmail };
