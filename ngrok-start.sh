#!/bin/bash

# Script to start ngrok with skip browser warning for OAuth testing
# This bypasses the ngrok warning page that appears on first visit

PORT=${1:-5000}

echo "Starting ngrok tunnel on port $PORT with skip browser warning..."
echo "This will bypass the ngrok warning page for OAuth testing"
echo ""

ngrok http $PORT \
  --request-header-add="ngrok-skip-browser-warning: true"
