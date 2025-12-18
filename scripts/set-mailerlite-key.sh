#!/bin/bash

# Script to set MailerLite API key in Netlify
# Usage: ./scripts/set-mailerlite-key.sh

MAILERLITE_KEY="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiOTUyNjM3MTlmMmU0NGI1Zjk4MmRlNTNkY2MzNDIwYjY4NGFmMmNiOTY5ODFkZDExNDczNmI4YzhkZTc5OTQ1NWRjMDM1MThjYWZiOWQ2MTQiLCJpYXQiOjE3NjYwOTY5MTUuODIxODUyLCJuYmYiOjE3NjYwOTY5MTUuODIxODU0LCJleHAiOjQ5MjE3NzA1MTUuODE0MTcsInN1YiI6IjE4ODc2NDYiLCJzY29wZXMiOltdfQ.m7rbK7DngeoyzWpe1q4bx7UZ7_ncVTUI80JlIIxmwRM33o3mAaB52TfP1LPhRsQoolH2PRo788Pd8HIxrQJQFySfScEK56S5hX53H7LUXvVN8GG8KBjJZvBifjN8FAtMaOzw-v8QZcWVuQFAjhQrV_wq3k7QfBptVww53pwpebiCn9EZvAGCijXIUsLyz7JcDS8HmA44vzKd4DBjo6fPSKV65MqJkhT6VUYIp3NKdemDvICXLSfx2InGvL0Kn1QBYtVPNYpT_qV809ebEAJuswQq3m0INgjPkbzD4oLmhWw-YLB04QkbmaYW2izgE4zIflPAjKJNLuy4IarBfYj-lyD1N1naOCzsN1BR6peUYTe4FnGC8xtDaD8RN1Ab0sEG-U8WqmKyrl7NHFZMhtManu3aOaoSSDEWYSt-dHQSw3IbVX_pMktSKPfX4F3GFmd-eTQBDX_To4YpiikM8sIttSS_d26F-T3Io84gsQPJhzK9oztcqBKT_jrTnkQlfK8-PnCrf8uJztS_pz7MJKEIP9fh7lTygyo-yvjcbgEUPqkNgyXlbmjb2me8lCMbC7_FvhMGjxq6p7gGjojE3XBV-I5kG1EZOjga_BOENWsA65XZbgor6vaGrUxyL8zSgm6bXVJc0SKkFzHqlyXJS4WzZU-ppOruNWlRTwnwmlq8f90"

echo "Setting MailerLite API key in Netlify..."
echo ""
echo "First, make sure you're logged in to Netlify:"
echo "  netlify login"
echo ""
echo "Then link your site (if not already linked):"
echo "  netlify link"
echo ""
echo "Setting environment variable..."
netlify env:set MAILERLITE_API_KEY "$MAILERLITE_KEY" --context production
netlify env:set MAILERLITE_API_KEY "$MAILERLITE_KEY" --context deploy-preview
netlify env:set MAILERLITE_API_KEY "$MAILERLITE_KEY" --context branch-deploy

echo ""
echo "✅ Done! Environment variable set for all contexts."
echo "You may need to trigger a new deploy for it to take effect."

