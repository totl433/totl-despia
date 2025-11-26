#!/bin/bash
# Register devices for mini-league members
# Usage: ADMIN_DEVICE_REGISTRATION_SECRET="your-secret" ./register-devices.sh

SECRET="${ADMIN_DEVICE_REGISTRATION_SECRET:-}"
BASE_URL="https://totl-staging.netlify.app/.netlify/functions/adminRegisterDevice"

if [ -z "$SECRET" ]; then
  echo "Error: ADMIN_DEVICE_REGISTRATION_SECRET environment variable is required"
  echo "Usage: ADMIN_DEVICE_REGISTRATION_SECRET=\"your-secret\" ./register-devices.sh"
  exit 1
fi

echo "Registering devices..."

# Register Jof's device
echo "Registering Jof's device..."
curl -X POST "${BASE_URL}?secret=${SECRET}" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"4542c037-5b38-40d0-b189-847b8f17c222","playerId":"8e576d7a-76dc-4cb2-9c35-c74f6760ec39","platform":"ios"}'
echo -e "\n"

# Register SP's device
echo "Registering SP's device..."
curl -X POST "${BASE_URL}?secret=${SECRET}" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"9c0bcf50-370d-412d-8826-95371a72b4fe","playerId":"90552486-8c1e-4dda-8de8-3521c7f08aa6","platform":"ios"}'
echo -e "\n"

# Register ThomasJamesBird's device
echo "Registering ThomasJamesBird's device..."
curl -X POST "${BASE_URL}?secret=${SECRET}" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"36f31625-6d6c-4aa4-815a-1493a812841b","playerId":"33762d5d-bc28-4326-8333-807f57ddffd3","platform":"ios"}'
echo -e "\n"

echo "Done! Check Supabase to verify registrations."

