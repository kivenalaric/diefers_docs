# Diefer Doc Sending — GHL Signed Doc → Google Drive

A lightweight Node.js webhook server that listens for GoHighLevel (GHL) "document signed" events, downloads the signed PDF via the GHL API, and saves it into the correct Google Drive folder for that client.

---

## How it works

1. GHL fires a `GET /webhook` request with query params when a contract is signed.
2. The server responds `200 OK` immediately (so GHL doesn't time out).
3. In the background it:
   - Downloads the PDF from the GHL Proposals/Contracts API.
   - Finds or creates a Drive folder named `"{name} - {email}"` inside your configured parent folder.
   - Uploads the PDF as `"{contract} - {name}.pdf"`.
   - Shares the folder and the file with the client's email (reader access).

---

## Setup

### 1. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **Google Drive API** for the project.
3. Create a **Service Account** (IAM & Admin → Service Accounts → Create).
4. Generate a JSON key for the service account and save it as `service-account.json` in this project root.
5. In Google Drive, open the parent folder where client folders should live.
6. Click **Share** and add the service account email (e.g. `diefer-test@dieferdocs.iam.gserviceaccount.com`) as **Editor**.

> The `GOOGLE_DRIVE_PARENT_FOLDER_ID` is the long ID in the Drive URL when you open that folder:
> `https://drive.google.com/drive/folders/THIS_PART_IS_THE_ID`

### 2. Fill in `.env`

Copy `.env.example` to `.env` and fill in the values:

```env
PORT=3000
GHL_API_KEY=your_ghl_api_key_here
GOOGLE_DRIVE_PARENT_FOLDER_ID=your_parent_folder_id_here
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json
```

`GHL_API_KEY` is a Location API key from GHL → Settings → Integrations → API Keys.

### 3. Install dependencies

```bash
npm install
```

---

## Running locally

```bash
node index.js
```

The server starts on port `3000` (or whatever `PORT` is set to).

---

## Exposing it publicly for GHL (local testing)

GHL must reach your server over the internet. Use [ngrok](https://ngrok.com/):

```bash
# Install ngrok, then:
ngrok http 3000
```

ngrok will print a public URL like `https://abc123.ngrok-free.app`.

Set your GHL webhook URL to:

```
https://abc123.ngrok-free.app/webhook
```

---

## Production deployment

Deploy to any Node.js host. Recommended options:

| Platform | Notes |
|----------|-------|
| [Railway](https://railway.app) | Simplest — connect GitHub repo, set env vars |
| [Render](https://render.com) | Free tier available, auto-deploys from Git |
| [Fly.io](https://fly.io) | More control, scales to zero |

Set the same environment variables from `.env` in the platform's dashboard.

---

## GHL Webhook Configuration

In GoHighLevel:
- Go to **Settings → Integrations → Webhooks** (or the Proposals/Contracts notification settings).
- Set the webhook URL to `https://your-domain.com/webhook`.
- Ensure GHL is configured to fire on **document signed** events with the query params:
  `name`, `email`, `id`, `link`, `contract`, `docs`

---

## File structure

```
index.js                  — Express server + webhook handler
ghl.js                    — GHL PDF download function
drive.js                  — Google Drive folder/file/sharing logic
.env                      — Your secrets (never commit this)
service-account.json      — Google service account key (never commit this)
package.json
.gitignore
README.md
```
# diefers_docs
