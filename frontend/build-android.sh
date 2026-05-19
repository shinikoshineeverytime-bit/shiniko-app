#!/bin/bash
# ============================================
# SHINIKO - Google Play AAB Build Script
# ============================================
# Run this on your computer (Mac/Windows/Linux x86_64)
# Requires: Node.js 18+, npm
#
# This script will:
# 1. Install EAS CLI
# 2. Log you into Expo
# 3. Link the project
# 4. Build an Android AAB for Google Play
# 5. Give you a download link for the .aab file
# ============================================

set -e

echo ""
echo "=========================================="
echo "  SHINIKO - Android Build for Google Play"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is required. Install from https://nodejs.org"
    exit 1
fi

# Step 1: Install EAS CLI
echo "Step 1/4: Installing EAS CLI..."
npm install -g eas-cli@latest

# Step 2: Login to Expo
echo ""
echo "Step 2/4: Logging into Expo..."
echo "(Create a free account at https://expo.dev if you don't have one)"
eas login

# Step 3: Link project
echo ""
echo "Step 3/4: Linking project to your Expo account..."
cd "$(dirname "$0")"
eas init

echo ""
echo "Step 4/4: Building Android AAB..."
echo "This builds in Expo's cloud (~10-15 minutes)"
echo ""

eas build --platform android --profile production --non-interactive

echo ""
echo "=========================================="
echo "  BUILD COMPLETE!"
echo "=========================================="
echo ""
echo "Download the .aab file from the link above."
echo ""
echo "To upload to Google Play:"
echo "  1. Go to https://play.google.com/console"
echo "  2. Create your app > Production > Create new release"
echo "  3. Upload the .aab file"
echo "  4. Fill in the store listing and submit for review"
echo ""
