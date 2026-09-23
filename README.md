# Interview Connect

**Practice like it's the real interview.** Interview Connect is an interview-practice platform for college students and job seekers. It combines AI-generated interviews, AI or human interviewers, standardized AI grading, personalized feedback, gamification, and a fair three-strike conduct system.

> AI creates the customized interview. An AI or a human conducts it. AI grades every interview.

## Quick start

```bash
npm install              # also runs `prisma generate`
cp .env.example .env     # optional: the defaults work out of the box
npm run setup            # create the SQLite DB and load demo data
npm run dev              # http://localhost:3000
```

Demo accounts (password **`demo1234`**, also available as one-click buttons on the sign-in page):

| Account | Email | What it shows |
|---|---|---|
| Student | `maya@demo.interviewconnect.app` | 8 graded interviews with an improving trend, badges, a streak, an upcoming human interview with Priya |
| Student (1 strike) | `jordan@…` | Conduct warning; pending instant-match request |
| Student (2 strikes) | `alex@…` | Final warning; pending appeal; recorded no-show |
| Student (3 strikes) | `sam@…` | Banned account; can only view strikes and appeal |
| Students | `taylor@…`, `noah@…` | Open request in the matching pool; mixed history |
| Interviewer (professional) | `priya@…` | Pending request, booked interview, ratings, Top Interviewer badge |
| Interviewers | `marcus@…`, `elena@…`, `chris@…` (student), `devon@…` (student, 1 strike) | |
| Admin | `admin@demo.interviewconnect.app` | Pending reports, appeals, analytics, audit log |

(All demo emails end in `@demo.interviewconnect.app`.)

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run setup` | `prisma db push` + seed |
| `npm run db:seed` | Reload demo data (clears existing data) |
| `npm run start:prod` | Production start: syncs the database schema, then starts the server |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm test` | Unit tests: question engine, grading rubric, follow-ups, matching, conduct, validation |
| `npm run test:e2e` | End-to-end API tests against a real `next start` server and a fresh seeded DB (run `npm run build` first) |

## Stack

- **Next.js 15** (App Router, React 19, TypeScript, strict mode), Tailwind CSS
- **Prisma**: SQLite locally, PostgreSQL in production — chosen automatically from `DATABASE_URL` by `scripts/db.mjs`
- **Claude** via the official `@anthropic-ai/sdk` (structured outputs + Zod) for question generation, follow-ups and grading
- **WebRTC** peer-to-peer video with API-relayed signaling, **Web Speech API** for live transcription, `speechSynthesis` for the AI interviewer's voice
- Custom session auth (bcrypt, httpOnly cookie, hashed tokens in the DB), optional Google OAuth

## Architecture

```
src/
  app/
    (marketing)/          landing page
    (auth)/               sign in / sign up
    onboarding/           student & interviewer onboarding
    (app)/                authenticated app shell
      dashboard, interviews, interviews/new, interviews/[id], …/results, …/wrap-up
      performance, leaderboard, notifications, profile, conduct
      interviewer/, interviewer/availability
      admin/ (users, interviewers, interviews, reports, strikes, appeals, ratings, analytics)
    (room)/interviews/[id]/lobby|room   full-screen device check and interview rooms
    api/                  REST route handlers (all auth/role checks happen here)
  lib/
    ai/                   Claude client, question engine + bank, follow-ups, grading, answer analysis
    services/             interviews, room (live state + controls), matching, grading pipeline,
                          conduct, gamification, performance/recommendations, notifications, analytics
    auth/                 sessions, guards, Google OAuth
  hooks/                  room-state polling, WebRTC, speech recognition, local media
  components/             UI kit, rooms, charts, admin, onboarding, …
prisma/schema.prisma      32 tables (see below)
prisma/seed.ts            demo data
tests/                    unit + end-to-end tests
```

### Core flows

- **Start an interview:** *How* (AI / Human) → *What* (Behavioral / Technical / Full) → role, company, job description (paste or upload), resume → difficulty and duration → start now or schedule.
- **AI interview:** the plan is generated up front but revealed **one question at a time**. After each answer the AI either asks a follow-up grounded in what you said or moves on; it paces to the duration, answers your questions at the end, and closes. The candidate state API never returns the plan or hidden metadata. The room is **hands-free** by default: the mic opens when the interviewer finishes speaking (and stays closed while they talk), and a ~2.5 s pause (longer for very short answers) ends the turn, with a visible countdown and a "Hold on, I'm not done" button. The interviewer reacts ("Mm-hm.") while it thinks. Typing and a manual Send button always work.
- **Human interview:** AI generates the guide (question, what it tests, suggested follow-ups, grading criteria). Only the interviewer receives it. Both participants pass a camera/mic/network check, and the interview starts only when both are ready. The interviewer asks questions, which appear on the candidate's screen, and can generate AI follow-ups, add private notes, pause, send conduct warnings, report conduct, and end the interview. The candidate's speech is transcribed live, with typed input as a fallback.
- **Matching:** each eligible interviewer gets a fit score (role, type, industry, experience, time zone, rating, weekly load, and a penalty for recent repeat pairings). The system then picks **randomly** among the top candidates. Students can pick *another student*, *professional*, or *anyone*. "Match me now" sends a request (15-minute expiry, then re-match), and the request also appears in an open pool interviewers can claim. Scheduled bookings use interviewer availability slots, with double-booking prevented in a transaction. The interviewer's identity is revealed only after booking.
- **Grading pipeline:** transcript → Q&A pairs → type/role/JD rubric → AI evaluation → category scores (only the categories that apply to the interview type) → overall → strengths, improvements, per-question feedback with STAR analysis → recommendation from the student's real history. AI quotes are checked against the transcript, and fabricated quotes are dropped. Human interviews wait up to 15 minutes for the interviewer's optional feedback, which the AI summarizes but which never sets the score.
- **Conduct:** potential signals (inactivity, ignored warnings, leaving early) are *ConductEvents*. Warnings come first. Reports (from an interviewer, a participant, or the system for repeatedly ignored warnings) are always **pending** until an admin reviews them. Confirming a report issues the next strike: strike 1 is a warning, strike 2 a final warning, strike 3 bans the account and cancels upcoming sessions. Banned users can still sign in to see their history and appeal. An approved appeal overturns the strike and can restore the account. Technical problems are logged as separate *TechnicalEvents* and never count as misconduct. No-shows are tracked separately and never create an automatic strike.
- **Gamification:** a points ledger (interviews, streaks, improvement, conducting interviews, quality feedback, onboarding), 8 levels, 8 badges, a daily streak, and student and interviewer leaderboards. It lives outside the interview room.

### Database

`users, auth_sessions, oauth_accounts, profiles, student_profiles, interviewer_profiles, resumes, job_descriptions, interviews, interview_questions, interview_answers, interview_sessions, interview_transcripts, interview_feedback, ai_evaluations, interviewer_notes, interviewer_ratings, matches, availability, rtc_signals, points, badges, user_badges, notifications, conduct_events, technical_events, conduct_reports, strikes, appeals, admin_actions, analytics_events, rate_limits`, with foreign keys, timestamps and indexes throughout.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite) or a Postgres URL |
| `APP_URL` | yes | Public base URL, used for OAuth callbacks and email links |
| `ANTHROPIC_API_KEY` | recommended | Enables Claude for questions, follow-ups, candidate Q&A and grading |
| `AI_MODEL` | no | Overrides the default model (`claude-opus-5`) |
| `ELEVENLABS_API_KEY` | no | Human-sounding voices for the AI interviewers (server-side only) |
| `ELEVENLABS_VOICE_AVA` / `_MARCUS` / `_ELENA`, `ELEVENLABS_MODEL` | no | Override the per-interviewer voice IDs and the TTS model (default `eleven_multilingual_v2`, the most lifelike; `eleven_flash_v2_5` is faster and cheaper) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google sign-in. Redirect URI: `${APP_URL}/api/auth/google/callback` |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | no | TURN relay for video behind strict NATs. Served only to signed-in users |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Email copies of important notifications |
| `STORAGE_DIR` | no | Private file storage directory (default `./storage`) |

## What needs external credentials

| Integration | Without credentials | With credentials |
|---|---|---|
| **AI (Claude)** | A clearly labelled **development engine**: a curated, role-specific question bank personalized from the resume, job description and company; rule-based follow-ups; and a transparent rubric grader that quotes only your real answers. The UI says so wherever it applies. | Claude generates custom plans, adaptive follow-ups and standardized evaluations. The server-side refusal fallback is enabled. |
| **Video** | Works: peer-to-peer WebRTC with public STUN. | TURN makes it reliable behind corporate or campus firewalls. |
| **Interviewer voice** | The browser's built-in speech voice, matched to each persona where possible. | ElevenLabs streams a natural voice per interviewer (Ava, Marcus, Elena), with lip-sync driven by the real audio. `/api/interviews/[id]/tts` only speaks lines the interviewer actually said in that interview, or a fixed set of short reactions, and only to that interview's candidate. |
| **Transcription** | Works in Chrome, Edge and Safari via the browser's Web Speech API. Other browsers use typed answers, and the UI says so. | Server-side transcription (Whisper, Deepgram, …) is a documented next step. |
| **Google OAuth** | Hidden. Email and password auth works. | "Continue with Google" appears. |
| **Email** | In-app notifications only. Emails are skipped and logged as not configured. | Resend delivers important notifications. |
| **Recording** | **Not implemented.** The UI says "not recorded", and consent is captured for the transcript only. | `recordingConsent` and the storage layer are in place for a future recorder. |

## Deploying (Railway)

The repo includes `railway.json`, so Railway knows how to build (`npm run build`), start (`npm run start:prod`) and health-check (`/api/health`) the app.

1. On [railway.app](https://railway.app), create a project and choose **Deploy from GitHub repo** → this repository.
2. In the project, click **+ New → Database → PostgreSQL**.
3. On the app service, open **Variables** and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference to the database Railway created)
   - `APP_URL` = your public URL, e.g. `https://interview-connect.up.railway.app`
   - `ANTHROPIC_API_KEY` = your key
   - `STORAGE_DIR` = `/data/storage`
   - `ELEVENLABS_API_KEY` = your key (optional — natural interviewer voices)
4. On the app service, open **Settings → Volumes**, add a volume mounted at `/data` (keeps uploaded resumes across deploys), and under **Networking** click **Generate Domain**.
5. Open your site, sign up with your own email, then make yourself admin (admin can never be chosen at sign-up): in the Railway CLI run `railway ssh`, then `npm run make-admin -- you@example.com`.
6. Optional: load the demo accounts once with `railway run npm run db:seed` (Railway CLI), or leave the site empty for real users.

Any Postgres URL works: the build detects `postgres://` and uses a generated Postgres copy of the schema. Local development keeps using SQLite.

## Security & privacy

- Roles and account status are read from the database on every request and never trusted from the client. Admin can't be self-assigned.
- Every API route validates input with Zod and enforces authorization server-side. There is no endpoint that lets a student or interviewer write scores, strikes, roles or account status.
- Candidates never receive the interview plan, hidden grading metadata or interviewer notes. Interviewers see only what they need: first name and last initial, school, role, resume and job description for their assigned interview.
- Resumes are stored outside `/public`, validated by magic bytes, and served only to the owner, the assigned interviewer, or an admin.
- Session tokens are stored hashed. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production. Sign-up, login, uploads, reports and AI endpoints are rate-limited. Security headers are set, and camera/mic permissions are limited to the app's own origin.
- Analytics store event names and ids only, never free text.
- The database uses SQLite, so row-level security isn't available. Access control lives in the service layer. On Postgres you can add RLS policies as defense in depth.

## Limitations

- Realtime uses short-interval polling (room state about every 2s, signaling about every 1s). That's fine at this scale; a WebSocket or SSE layer is the next step for scale.
- Background jobs (question generation, grading) run in-process with Next.js `after()`. For multi-instance deployments, move them to a queue.
- The development question bank is broad but finite. Real customization depth comes with the AI key.

## Recommended next steps

1. Add `ANTHROPIC_API_KEY` and evaluate grading consistency on a labelled set of transcripts.
2. Deploy on Postgres, and add a job queue for grading and reminders.
3. Add TURN (e.g. Cloudflare Calls or Twilio) and server-side transcription for browsers without speech support.
4. Add opt-in recording with explicit two-party consent and encrypted storage.
5. Add WebSocket presence and signaling, plus calendar invites (ICS/Google Calendar) for scheduled interviews.
