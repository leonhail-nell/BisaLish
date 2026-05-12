# BisaLish

A Bisaya (Cebuano) ↔ English translator built with Next.js 15, React, MUI, and TypeScript. Returns three natural translation suggestions (natural, literal, formal) per phrase.

## Features

- Bisaya ↔ English translation with three tone variants
- Voice input (Web Speech API)
- Save favorite translations
- Offline cache for previously-translated phrases
- Server-side API route keeps your AI key private
- Built-in per-IP rate limit
- Mobile-responsive layout

## Tech stack

- **Next.js 15** (App Router) + **React 18**
- **TypeScript**
- **MUI v6** (Material UI) + Emotion
- **Edge runtime** for the `/api/translate` route
- AI providers: **Claude (Anthropic)** or **OpenAI** — switch with one env variable

## Project structure

```
BisaLish/
├── app/
│   ├── api/translate/route.ts   # Server-side AI call
│   ├── layout.tsx               # Root layout + MUI provider
│   ├── page.tsx                 # Main page
│   ├── theme.ts                 # MUI theme
│   ├── storage.ts               # localStorage helpers (favorites + cache)
│   ├── types.ts                 # Shared types
│   └── globals.css
├── components/
│   ├── Header.tsx
│   ├── TranslatePanel.tsx
│   ├── FavoritesPanel.tsx
│   ├── DirectionToggle.tsx
│   ├── TextInputBox.tsx
│   ├── SamplePhrases.tsx
│   └── SuggestionCard.tsx
├── package.json
├── tsconfig.json
├── next.config.mjs
├── .env.local.example
└── README.md
```

## Setup

### 1. Install dependencies

```bash
cd BisaLish
npm install
```

### 2. Create your `.env.local`

Copy the example and fill in one key:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set:

- `AI_PROVIDER` — either `anthropic` (recommended) or `openai`
- `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com), **or**
- `OPENAI_API_KEY` from [platform.openai.com](https://platform.openai.com/api-keys)

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import it on [vercel.com](https://vercel.com).
3. Add the same env variables (`AI_PROVIDER`, `ANTHROPIC_API_KEY`, etc.) in Vercel project settings.
4. Deploy — first build takes about a minute.

## Customizing the prompt

The translation prompt lives in `app/api/translate/route.ts` (`buildPrompt`). It currently asks for three tones: natural, literal, formal. You can change those tones or add more by editing the prompt and the parsing logic.

## What's next (roadmap)

- **Phase 3** — User accounts (Supabase) so favorites sync across devices
- **Phase 4** — React Native (Expo) mobile build using the same backend
- **v2** — Optional on-device model for true offline translation
- Dialect picker (Cebu / Davao / Cagayan de Oro)
- Translation history with search
- Premium tier (unlimited translations)

## Notes

- The Web Speech API uses **Filipino (fil-PH)** for Bisaya voice input since native Cebuano support is rare. Accuracy varies — best on Chrome/Edge desktop.
- Cache and favorites are stored in `localStorage` only, scoped to each device and browser.
- The Edge runtime is fast and cheap, but if you need Node-only APIs swap `runtime = 'edge'` for `'nodejs'` in `app/api/translate/route.ts`.

## License

MIT — do whatever you want, just don't blame me if the translations confuse your titas.
