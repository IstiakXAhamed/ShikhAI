# Shikh-AI React Web App

This completed version converts the Figroot/Figma export into a runnable React web app. The original English/Bangla Figroot source snippets are preserved in `figroot-source/`, while the working application code is in `src/`.

## What is included

- React + Vite web app
- English and Bangla UI switching
- Small logo on Login, Signup, and Reset Password pages
- Large logo on Dashboard, AI Chat, and Settings pages
- Supabase Auth integration for email/password signup and login
- Demo auth mode when Supabase `.env` values are not configured, so the UI can be tested immediately
- Future RAG backend integration layer in `src/services/ragApi.js`
- Vercel SPA rewrite config in `vercel.json`

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Connect Supabase

1. Copy `.env.example` to `.env`.
2. Add your Supabase Project URL and anon key:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. In Supabase, enable Email provider under Authentication.
4. Restart the dev server.

The app uses Supabase Auth, so email/password users are stored by Supabase Authentication. Extra user metadata such as name and language is sent during signup.

## Connect the future RAG backend

When your backend is ready, set:

```bash
VITE_RAG_BACKEND_URL=https://your-backend-url.com
VITE_RAG_CHAT_ENDPOINT=/api/chat
```

The frontend sends this JSON payload:

```json
{
  "message": "student question",
  "language": "en",
  "user_id": "supabase-user-id"
}
```

If the user is logged in with Supabase, the request also includes:

```http
Authorization: Bearer <supabase_access_token>
```

Expected backend response:

```json
{
  "answer": "AI answer text",
  "sources": ["Chapter 1: Page 13"]
}
```

## Build for production

```bash
npm run build
npm run preview
```

For Vercel, import this folder as a Vite project. Build command: `npm run build`; output directory: `dist`.
