#!/usr/bin/env bash
# ============================================================================
# CONTRACT-LINT — Modul darf Core nicht direkt schreiben.  Siehe docs/MODULE_GUIDE.md.
#
# Scannt src/modules/** (TS/TSX). Ein Modul darf Raw-Core-Tabellen
#   deals | contacts | companies | pipelines | deal_activities | tasks | users
# nur LESEN (.select). SCHREIBEN (.insert/.update/.delete/.upsert) an Core ist
# verboten — Core-Mutationen laufen ausschliesslich über einen Core-RPC (.rpc(...)).
#
# FAIL, wenn .from('<core>') im selben Statement (kein ; dazwischen) von einem
# Write-Method gefolgt wird.
# ============================================================================
set -euo pipefail

ROOT="src/modules"
if [ ! -d "$ROOT" ]; then
  echo "CONTRACT-LINT: kein $ROOT/ — OK (noch keine Module)"
  exit 0
fi

violations=0
n=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  n=$((n+1))
  out=$(perl -0777 -ne '
    my $core="deals|contacts|companies|pipelines|deal_activities|tasks|users";
    my $bad=0;
    while (/\.from\(\s*[\x27"\x60]($core)[\x27"\x60]\s*\)(?:(?!;)[\s\S]){0,300}?\.(insert|update|delete|upsert)\s*\(/g) {
      print "  Raw-Core-Write: .from(...$1...) ... .$2( -> Core-Schreiben muss via core-RPC (.rpc())\n";
      $bad=1;
    }
    exit($bad?1:0);
  ' "$f") && rc=0 || rc=$?
  if [ "${rc:-0}" -ne 0 ]; then
    echo "::error file=$f::CONTRACT-LINT-Verstoss"
    echo "FAIL $f"
    printf '%s\n' "$out"
    violations=$((violations+1))
  fi
done < <(find "$ROOT" -type f \( -name '*.ts' -o -name '*.tsx' \))

if [ "$n" -eq 0 ]; then echo "CONTRACT-LINT: keine TS-Dateien in $ROOT/ — OK"; exit 0; fi
if [ "$violations" -gt 0 ]; then echo "::error::CONTRACT-LINT: $violations Datei(en) mit Raw-Core-Write."; exit 1; fi
echo "CONTRACT-LINT: alles gruen ($n Datei(en), kein Raw-Core-Write)."
