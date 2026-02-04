#!/bin/bash

# Exit script on any error
set -e

TEMPLATE_FILE="js/firebase-config.template.js"
OUTPUT_FILE="js/firebase-config.js"

echo "Starting Vercel build process..."

# 1. Copy the template file to the final config file
cp "$TEMPLATE_FILE" "$OUTPUT_FILE"
echo "Created $OUTPUT_FILE from template."

# 2. Replace all placeholders with environment variables
sed -i "s|__REACT_APP_FIREBASE_API_KEY__|${REACT_APP_FIREBASE_API_KEY}|g" "$OUTPUT_FILE"
sed -i "s|__REACT_APP_FIREBASE_AUTH_DOMAIN__|${REACT_APP_FIREBASE_AUTH_DOMAIN}|g" "$OUTPUT_FILE"
sed -i "s|__REACT_APP_FIREBASE_PROJECT_ID__|${REACT_APP_FIREBASE_PROJECT_ID}|g" "$OUTPUT_FILE"
sed -i "s|__REACT_APP_FIREBASE_STORAGE_BUCKET__|${REACT_APP_FIREBASE_STORAGE_BUCKET}|g" "$OUTPUT_FILE"
sed -i "s|__REACT_APP_FIREBASE_MESSAGING_SENDER_ID__|${REACT_APP_FIREBASE_MESSAGING_SENDER_ID}|g" "$OUTPUT_FILE"
sed -i "s|__REACT_APP_FIREBASE_APP_ID__|${REACT_APP_FIREBASE_APP_ID}|g" "$OUTPUT_FILE"

echo "Firebase config injected successfully. Build finished."