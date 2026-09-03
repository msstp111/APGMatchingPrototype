#!/usr/bin/env bash
# Runs both halves of the prototype in one go (macOS / Linux equivalent of dev.ps1).
#
#   ./dev.sh
#
# Starts the API (http://localhost:5286) in the background and the Angular dev server
# (http://localhost:4200) in the foreground. Ctrl+C stops the dev server and the API with it.
# Run the two halves in separate terminals instead if you want the API's log in front of you.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The solution targets net9.0. On a machine with only the .NET 10 runtime installed, this lets the
# app run on it. Harmless when a real .NET 9 runtime is present.
export DOTNET_ROLL_FORWARD="${DOTNET_ROLL_FORWARD:-Major}"

# nvm-managed Node: pick up the default (Angular 22 needs ^22.22.3 || ^24.15.0).
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; nvm use default >/dev/null 2>&1 || true; fi

echo "Starting the API on http://localhost:5286 ..."
dotnet run --project "$root/src/Apg.Api" --launch-profile http &
api=$!
cleanup() { echo "Stopping the API ..."; kill "$api" 2>/dev/null || true; wait "$api" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "Starting the Angular dev server on http://localhost:4200 ..."
cd "$root/web"
npm start
