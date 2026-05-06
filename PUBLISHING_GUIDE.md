# Shiniko - Publishing Guide

## What's Already Done ✅

- [x] App configured with bundle ID: `com.shiniko.app`
- [x] EAS build profiles created (development, preview, production)
- [x] Live Stripe keys configured
- [x] Privacy Policy written
- [x] App Store listing copy written
- [x] Legacy code cleaned up
- [x] Location permission descriptions set
- [x] Dark theme UI configured

---

## Steps to Publish

### 1. Create an Expo Account
1. Go to https://expo.dev/signup
2. Create a free account
3. Install EAS CLI on your computer:
   ```bash
   npm install -g eas-cli
   eas login
   ```

### 2. Link Your Project
1. Clone/download your code from Emergent (use "Save to GitHub" then clone)
2. In the `frontend/` folder, run:
   ```bash
   eas init
   ```
3. This will create a project ID. Update `app.json` → `extra.eas.projectId` with it
4. Update `app.json` → `owner` with your Expo username

### 3. Set Up Developer Accounts

**Apple (iOS) — $99/year:**
1. Go to https://developer.apple.com/programs/
2. Enroll with your Apple ID
3. Wait for approval (~48 hours)

**Google (Android) — $25 one-time:**
1. Go to https://play.google.com/console/signup
2. Complete registration (instant access)

### 4. Enable Stripe Connect
1. Go to https://dashboard.stripe.com/connect
2. Complete the Connect setup (business details, bank account)
3. This enables washer payment accounts & automatic payouts

### 5. Build the App

```bash
cd frontend

# Build for both platforms
eas build --platform all --profile production

# Or build separately:
eas build --platform ios --profile production
eas build --platform android --profile production
```

EAS will handle code signing automatically (Apple certificates, Android keystores).

### 6. Submit to Stores

```bash
# Submit to Apple App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

**For iOS submission, you'll need:**
- Apple Team ID (from developer.apple.com → Membership)
- App Store Connect app (create at appstoreconnect.apple.com)

**For Android submission, you'll need:**
- Google Play Service Account key (JSON file)
- Create app listing in Google Play Console first

### 7. App Store Review Preparation

**Apple Review Notes (paste during submission):**
```
Demo Account: Not required - app creates anonymous users automatically.
Test the app by:
1. Tap "Get a wash" to enter customer mode
2. Enter any car registration (e.g., "AB12 CDE") and colour
3. Tap "Book Now" to see the Stripe payment flow
4. Use test card 4242 4242 4242 4242 to complete payment

Note: The "Wash cars" option is for service providers (car washers) 
who accept and complete wash jobs.
```

**Content Rating:** 
- All ages (no objectionable content)

**App Category:** 
- Primary: Lifestyle
- Secondary: Travel

---

## Environment Variables for Production

The backend needs to be deployed separately (e.g., Railway, Render, AWS) with:
```
MONGO_URL=<your-production-mongodb-url>
DB_NAME=shiniko
STRIPE_SECRET_KEY=sk_live_51T19BIQdOH2nBBZA...
STRIPE_PUBLISHABLE_KEY=pk_live_51T19BIQdOH2nBBZA...
```

Update `frontend/.env` with your production backend URL:
```
EXPO_PUBLIC_BACKEND_URL=https://your-production-api.com
```

---

## Post-Launch Checklist

- [ ] Set up Stripe webhook endpoint in Stripe Dashboard → Developers → Webhooks
  - URL: `https://your-api.com/api/webhook/stripe`
  - Events: `checkout.session.completed`
- [ ] Monitor Stripe Connect dashboard for washer onboarding
- [ ] Set up error tracking (Sentry/Bugsnag)
- [ ] Enable push notification certificates (iOS) in Expo Dashboard
- [ ] Test real payment flow end-to-end before going live
