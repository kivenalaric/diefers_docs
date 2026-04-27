const { google } = require('googleapis');
const { Readable } = require('stream');

function getDriveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

async function findFolder(drive, folderName, parentFolderId) {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = [
    `name = '${escapedName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${parentFolderId}' in parents`,
    `trashed = false`,
  ].join(' and ');

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return res.data.files.length > 0 ? res.data.files[0].id : null;
}

async function createFolder(drive, folderName, parentFolderId) {
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id;
}

async function getOrCreateClientFolder(clientName, clientEmail) {
  const drive = getDriveClient();
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  const folderName = `${clientName} - ${clientEmail}`;

  let folderId = await findFolder(drive, folderName, parentId);

  if (folderId) {
    console.log(`[Drive] Found existing folder: "${folderName}" (${folderId})`);
  } else {
    folderId = await createFolder(drive, folderName, parentId);
    console.log(`[Drive] Created new folder: "${folderName}" (${folderId})`);
  }

  return { drive, folderId };
}

async function uploadPdf(drive, folderId, fileName, pdfBuffer) {
  const stream = Readable.from(pdfBuffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  console.log(`[Drive] Uploaded file: "${res.data.name}" (${res.data.id})`);
  return res.data.id;
}

async function shareWithEmail(drive, resourceId, email) {
  await drive.permissions.create({
    fileId: resourceId,
    requestBody: {
      type: 'user',
      role: 'reader',
      emailAddress: email,
    },
    sendNotificationEmail: false,
    supportsAllDrives: true,
  });
  console.log(`[Drive] Shared resource (${resourceId}) with ${email}`);
}

module.exports = { getOrCreateClientFolder, uploadPdf, shareWithEmail };
