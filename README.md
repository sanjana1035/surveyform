# Simple Survey App

Minimal Express app that lets you create basic forms/surveys and share them via a link.

Features:

- Create a survey with a title and newline/comma-separated questions
- Get a shareable URL for the survey
- Submit responses and view results
- Simple JSON storage in `data.json`

Run locally:

```bash
npm install
npm start
```

Open http://localhost:3000

Notes:

- This is a minimal demo. For production use, add authentication, validation, and persistent DB (Postgres, MongoDB).
- To integrate with Typeform/Tally you'd either embed their form HTML or call their APIs; this app mimics basic functionality locally.
- To integrate with Typeform/Tally you can embed their form using an iframe or paste the provider embed HTML (script + iframe) when creating a survey.

Embedding examples

- Typeform (iframe):

<iframe src="https://form.typeform.com/to/your_form_id" width="100%" height="800" frameborder="0"></iframe>

- Tally (iframe):

<iframe src="https://tally.so/embed/your_form_id" width="100%" height="800" frameborder="0"></iframe>

Paste either the iframe HTML into the "Embed HTML" box or provide the iframe URL in "Embed URL" when creating a survey. Embedded forms are rendered on the survey page but external providers handle submissions.

Typeform API import & sync

You can import a Typeform into this app (so it appears in the local list) and optionally sync responses. Steps:

1. Create a `.env` file at the project root with your Typeform token:

```
TYPEFORM_TOKEN=your_typeform_personal_token
```

2. Install dependencies and start the app:

```bash
npm install
npm start
```

3. Import a Typeform (replace `FORM_ID`):

```bash
curl -X POST http://localhost:3000/import/typeform -H "Content-Type: application/json" -d '{"typeformId":"FORM_ID"}'
```

4. Sync responses for the imported local form (replace `LOCAL_ID` with the returned `form.id` from the import call):

```bash
curl -X POST http://localhost:3000/sync/typeform/LOCAL_ID
```

Notes:

- This app stores synced responses as raw objects (displayed in the results view). For full mapping to form questions you can extend the sync code to map Typeform answer fields to local questions.
- The Typeform API requires a valid token with permissions to read the form and responses.

Deployment (GitHub + Vercel)

- Create a GitHub repository and push this project to it:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

- This repository includes a GitHub Actions workflow at `.github/workflows/ci-and-deploy.yml` which installs dependencies and will deploy to Vercel when a `VERCEL_TOKEN` secret is configured.

- To enable automatic deploys to Vercel:
  1. Sign in to Vercel and create a new project connected to the GitHub repo (or use the Vercel dashboard).
  2. In the GitHub repo, go to Settings → Secrets and create a secret named `VERCEL_TOKEN` containing a Vercel personal token.
  3. Push to `main` and the workflow will run. The deploy step will run only if `VERCEL_TOKEN` is present.

- If you prefer to deploy manually with the Vercel CLI locally, run:

```bash
npx vercel --prod
```
