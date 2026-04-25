#!/bin/bash
set -euo pipefail

CORRECT="ttgvhqygmgtnjgwunuwz"
FORBIDDEN="qgvedroebvmwhnjmeyip"

if [ ! -f .env ]; then
  echo "::warning::.env nicht im Repo"
  exit 0
fi

if grep -q "$FORBIDDEN" .env 2>/dev/null; then
  echo "❌ FEHLER: .env zeigt auf falsche Supabase-Instanz ($FORBIDDEN)!"
  echo "Korrekt: $CORRECT"
  exit 1
fi

if ! grep -q "$CORRECT" .env 2>/dev/null; then
  echo "❌ FEHLER: .env enthält weder erwartete Instanz noch verbotene — Inhalt prüfen."
  exit 1
fi

echo "✅ .env OK: $CORRECT"
