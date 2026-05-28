# 🏠 Brewis Family

The Brewis Family home page — adventures, faith, family & friends.

## Getting started locally

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in your Supabase URL and anon key (find these in your Supabase project under **Settings → API**).

### 3. Run the dev server
```bash
npm run dev
```
Visit [http://localhost:5173](http://localhost:5173)

### 4. Build for production
```bash
npm run build
```

## Deploying to Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add your environment variables in Vercel's project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

Every `git push` to `main` will trigger an automatic redeploy.

## Tech stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [Supabase](https://supabase.com) for authentication
- Deployed on [Vercel](https://vercel.com)
