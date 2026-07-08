#!/bin/bash
# =====================================================================
# PROVLAJKY – spouštěč. Dvojklikem spustí server a otevře aplikaci.
# =====================================================================
cd "$(dirname "$0")"

echo "================================"
echo "   PROVLAJKY – spouštím..."
echo "================================"

# 1) Zkontroluj Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js není nainstalován."
  echo "   Stáhni ho z https://nodejs.org a spusť tento soubor znovu."
  echo ""
  read -p "Stiskni Enter pro zavření..."
  exit 1
fi

# 2) Nainstaluj závislosti při prvním spuštění
if [ ! -d node_modules ]; then
  echo "📦 První spuštění – instaluji závislosti (nodemailer)..."
  npm install
fi

# 2b) Uvolni port 8000, kdyby tam visel starý server (python/node)
PIDS=$(lsof -ti tcp:8000 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "♻️  Uvolňuji port 8000 (ukončuji starý server: $PIDS)..."
  kill $PIDS 2>/dev/null
  sleep 1
  # když nezabrala jemná verze, tvrději
  PIDS=$(lsof -ti tcp:8000 2>/dev/null)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
  sleep 1
fi

# 3) Otevři aplikaci v prohlížeči (s krátkým zpožděním, ať server naběhne)
( sleep 1.5; open "http://localhost:8000" ) &

# 4) Spusť server (běží, dokud okno nezavřeš)
echo ""
echo "✅ Aplikace běží na http://localhost:8000"
echo "   (Toto okno nechej otevřené. Zavřením okna server vypneš.)"
echo ""
node server.js
