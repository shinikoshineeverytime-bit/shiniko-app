# Shiniko - On-Demand Exterior Car Wash App

## Product Overview
Mobile app (Expo/React Native) for on-demand car washes. Customers book a £25 exterior car wash, a nearby washer accepts and completes the job. Payments are handled via Stripe Connect marketplace model.

## Architecture
- **Frontend**: Expo (React Native) with Expo Router, dark premium UI
- **Backend**: FastAPI + MongoDB + Stripe Connect
- **Real-time**: Socket.IO for chat

## Core Flow
1. Customer selects "Get a wash" → enters car details → clicks "Book Now"
2. Stripe Checkout session created → customer redirected to Stripe-hosted payment page
3. After payment → job created, washers notified
4. Washer accepts job → starts → completes
5. On completion → automatic Stripe Transfer to washer's connected account (95%)
6. Platform keeps 5% fee automatically

## Payment Architecture (Stripe Connect - Marketplace Model)
- **Model**: Separate charges and transfers
- **Customer pays**: £25 via Stripe Checkout → funds to platform account
- **On job completion**: Automatic transfer of £23.75 (95%) to washer's connected Stripe Express account
- **Platform keeps**: £1.25 (5%) per transaction
- **Washer onboarding**: Stripe Express onboarding (bank details, identity verification)
- **Washer payouts**: Handled automatically by Stripe (no manual intervention)

## Key Endpoints
- `POST /api/checkout/create-session` - Create Stripe Checkout for customer payment
- `GET /api/checkout/status/{session_id}` - Poll payment status, creates job when paid
- `POST /api/connect/create-account` - Create Stripe Express account for washer
- `GET /api/connect/account-status/{user_id}` - Check washer's Connect status
- `GET /api/washer/{user_id}/earnings` - Washer earnings summary
- `PUT /api/jobs/{job_id}/complete` - Triggers automatic transfer to washer

## DB Collections
- `users` - Customer/washer profiles
- `jobs` - Wash job lifecycle
- `payment_transactions` - Payment records with split amounts and transfer IDs
- `washer_accounts` - Stripe Connected account info per washer
- `chat_messages` - In-app messaging

## What's Implemented
- [x] Simplified role selection (Get a wash / Wash cars)
- [x] Customer booking flow with location detection
- [x] Stripe Checkout payment (redirect to Stripe-hosted page)
- [x] Payment success page with polling
- [x] Stripe Connect washer onboarding (Express accounts)
- [x] Automatic payment splitting (5% platform / 95% washer)
- [x] Automatic transfer on job completion
- [x] Washer earnings display
- [x] In-app chat (Socket.IO)
- [x] Push notifications
- [x] Premium dark UI with gradients
- [x] Web compatibility (icon fallbacks)
- [x] Publishing documents (Privacy Policy, App Store Listing, Publishing Guide)

## Production Requirements
- Enable Stripe Connect on platform's Stripe Dashboard (https://dashboard.stripe.com/connect)
- Switch to live Stripe keys (pk_live_..., sk_live_...)
- Each washer completes Stripe Express onboarding before accepting jobs

## Backlog
- P1: Ratings & Reviews system
- P2: Additional wash types (Interior, Full Detail)
- P3: Subscription plans
- P4: Washer payout dashboard / history view
