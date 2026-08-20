# 🍋 Squeeze — AI Luau Script Generator for Roblox

Squeeze is a full-stack AI platform built specifically for Roblox game creators and developers. It converts plain-English gameplay mechanics, DataStores, UI components, and systems into clean, optimized, production-ready **Luau** scripts that can be dropped straight into Roblox Studio.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
The application will launch on **`http://localhost:3000`** with Express backend + Vite React frontend.

---

## 🔑 Environment Variables Guide

| Variable | Description | Where to Get |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Primary high-performance AI engine for generating Roblox Luau | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `ANTHROPIC_API_KEY` | Optional Claude API key backend | [Anthropic Console](https://console.anthropic.com/settings/keys) |
| `DATABASE_URL` | PostgreSQL connection string for Prisma | [Supabase](https://supabase.com) or [Neon](https://neon.tech) |
| `JWT_SECRET` / `NEXTAUTH_SECRET` | 32+ character random string for user session encryption | Run `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key for Checkout & Customer Portal | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for Stripe Webhook events | [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks) |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for the **Pitcher ($14/mo)** plan | Create product in Stripe Products catalog |
| `STRIPE_PRICE_STUDIO_MONTHLY` | Stripe Price ID for the **Stand ($39/mo)** plan | Create product in Stripe Products catalog |
| `RESEND_API_KEY` | API Key for sending automated welcome & confirmation emails | [Resend](https://resend.com) |
| `APP_URL` | Public domain / URL for callbacks & webhooks | e.g. `http://localhost:3000` or `https://squeeze.gg` |

---

## 📦 Database & Prisma Setup (PostgreSQL / Supabase / Neon)

1. Create a free PostgreSQL database on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Copy your Connection String (`DATABASE_URL`) into `.env`.
3. Generate Prisma client and push the schema:
```bash
npx prisma generate
npx prisma db push
```
*(In preview/demo mode, Squeeze automatically uses a local persistent file store `data/squeeze_db.json` so you can test all features immediately without configuring an external DB).*

---

## 💳 Stripe Webhook Configuration

1. In the [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks), add a new endpoint:
   - **URL**: `https://your-domain.com/api/stripe/webhook`
   - **Events to listen for**:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
2. Copy the **Signing Secret** (`whsec_...`) to `STRIPE_WEBHOOK_SECRET` in `.env`.
3. For local testing with the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 🎮 Roblox Studio Plugin Architecture

> **Important architectural note:**
> Roblox Studio plugins run as isolated Luau environments inside Roblox Studio on the creator's machine. They communicate with the Squeeze API via Roblox's `HttpService`.
>
> 1. **In the Web App**: Users generate scripts, debug errors, browse their history, and manage their subscription.
> 2. **In Roblox Studio**: Creators install the Squeeze plugin from the Roblox Creator Marketplace (or paste the Squeeze Injector Module into `ServerScriptService`), authenticate with their Squeeze API token, and receive scripts placed directly into the correct Explorer instance (e.g. `ServerScriptService`, `StarterPlayerScripts`, `ReplicatedStorage`).

---

## 🚢 Deployment (Vercel / Cloud Run / Railway)

### Deploying to Vercel
1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Configure all environment variables from `.env.example` in Vercel Project Settings.

---

© 2026 Squeeze Labs. Built for Roblox Creators.
