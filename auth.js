/**
 * One-time script to get a Google OAuth2 refresh token.
 * Run: node auth.js
 * Then add the printed GOOGLE_REFRESH_TOKEN to your .env file.
 */
require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const url = client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'consent',
});

console.log('\n=== Google Drive OAuth2 Setup ===\n');
console.log('Step 1: Open this URL in your browser:\n');
console.log(url);
console.log('\nStep 2: Sign in with the Google account that owns your Drive folder.');
console.log('Step 3: Click Allow, then copy the code shown.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the code here: ', async (code) => {
  try {
    const { tokens } = await client.getToken(code.trim());
    console.log('\n✓ Success! Add this line to your .env file:\n');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\nThen remove or comment out GOOGLE_SERVICE_ACCOUNT_KEY_PATH from .env');
  } catch (err) {
    console.error('Error getting token:', err.message);
  }
  rl.close();
});
