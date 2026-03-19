# 🚀 Shiniko Publishing Guide

## Step 1: Switch Stripe to Live Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click the **"Test mode"** toggle (top right) to switch to **Live mode**
3. Go to **Developers → API keys**
4. Copy your **Live** keys:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`

5. Update your app's environment files:
   
   **Backend** (`/app/backend/.env`):
   ```
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   ```
   
   **Frontend** (`/app/frontend/.env`):
   ```
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   ```

---

## Step 2: Create Developer Accounts

### Apple App Store
1. Go to [developer.apple.com](https://developer.apple.com)
2. Enroll in Apple Developer Program ($99/year)
3. Wait for approval (usually 24-48 hours)

### Google Play Store
1. Go to [play.google.com/console](https://play.google.com/console)
2. Create a developer account ($25 one-time)
3. Complete identity verification

---

## Step 3: Set Up EAS Build

Run these commands in your terminal:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure your project
cd /app/frontend
eas build:configure
```

---

## Step 4: Build Your App

### For iOS:
```bash
eas build --platform ios
```
- This creates an `.ipa` file
- Takes about 15-20 minutes

### For Android:
```bash
eas build --platform android
```
- This creates an `.aab` file
- Takes about 10-15 minutes

---

## Step 5: Submit to App Stores

### iOS App Store:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in app details (use APP_STORE_LISTING.md)
4. Upload your `.ipa` using **Transporter** app or:
   ```bash
   eas submit --platform ios
   ```
5. Submit for review

### Google Play Store:
1. Go to [Google Play Console](https://play.google.com/console)
2. Click **"Create app"**
3. Fill in app details (use APP_STORE_LISTING.md)
4. Upload your `.aab` file or:
   ```bash
   eas submit --platform android
   ```
5. Submit for review

---

## Step 6: Review Times

| Store | Typical Review Time |
|-------|---------------------|
| App Store | 1-3 days |
| Play Store | 1-7 days (first app may take longer) |

---

## Step 7: After Approval

Once approved:
- Your app will be live on the stores!
- Users can download and use it
- Payments will go to your Stripe account
- You'll receive your 5% fee automatically

---

## Need Help?

- **Expo Docs**: https://docs.expo.dev/submit/introduction/
- **EAS Build**: https://docs.expo.dev/build/introduction/
- **Stripe Docs**: https://stripe.com/docs

---

## Your Revenue

For every £25 wash:
- **You receive**: £1.25 (5%)
- **Washer receives**: £23.75 (95%)
- **Stripe fee**: ~£0.44 (1.4% + 20p, from washer portion)

---

Good luck with Shiniko! 🚗💧
