#!/usr/bin/env bash
# ============================================================================
# POLICY-LINT — RLS-/SECURITY-DEFINER-Hygiene für Migrationen + Modul-Schemata.
# Siehe docs/MODULE_GUIDE.md.
#
# Geltungsbereich: GEÄNDERTE SQL unter
#   • supabase/migrations/*.sql
#   • modules/*/schema/*  und  modules/*/rpc/*   (rpc inkludiert, weil dort die
#     SECURITY-DEFINER-Modul-RPCs liegen — die search_path-Regel muss greifen).
#
# FAIL bei:
#   [A] Policy mit  TO anon | TO public  kombiniert mit USING (true)/WITH CHECK (true)
#   [B] Catch-all-Policy namens  all_auth
#   [C] SECURITY DEFINER ohne nachfolgendes  SET search_path  (pro Funktion)
#
# SQL-Kommentare werden vor der Prüfung entfernt → keine Fehlalarme auf Doku.
# Aufruf:  scripts/lint-policies.sh [datei ...]   (ohne Argumente: git-diff vs BASE_REF)
# ============================================================================
set -euo pipefail

violations=0

check_file() {
  f="$1"
  [ -f "$f" ] || return 0
  out=$(perl -0777 -ne '
    my $src=$_;
    $src =~ s{/\*.*?\*/}{}gs;        # Block-Kommentare
    $src =~ s{--[^\n]*}{}g;          # Zeilen-Kommentare
    my $low=lc $src;
    my $bad=0;
    while ($low =~ /create\s+policy\s+("?)([a-z0-9_]+)\1[\s\S]*?;/g) {
      my $stmt=$&; my $name=$2;
      if ($name eq "all_auth") { print "  [B] Catch-all-Policy all_auth\n"; $bad=1; }
      my $anon = ($stmt =~ /\bto\s+(anon|public)\b/);
      my $tru  = ($stmt =~ /\busing\s*\(\s*true\s*\)/ or $stmt =~ /\bwith\s+check\s*\(\s*true\s*\)/);
      if ($anon and $tru) { print "  [A] Policy $name: TO anon/public + USING/CHECK (true)\n"; $bad=1; }
      # [B2] Muster-basiert: Blanket-Schreibrecht fuer authenticated/public ohne Rollen-Helper.
      my $is_write = ($stmt !~ /\bfor\s+select\b/);             # (1) ALL/INSERT/UPDATE/DELETE oder kein FOR (=ALL)
      my $has_to   = ($stmt =~ /\bto\s+/);
      my $roles    = "";
      if ($has_to) { ($roles) = $stmt =~ /\bto\s+(.*?)(?:\busing\b|\bwith\s+check\b|;)/s; $roles = "" unless defined $roles; }
      my $target_ok  = (!$has_to) || ($roles =~ /\b(authenticated|public)\b/);                                  # (2)
      my $has_helper = ($stmt =~ /(is_admin|is_management_or_admin|can_write_deals|can_manage_all_tasks|auth\.uid)/); # (4)
      if ($is_write && $target_ok && $tru && !$has_helper) {   # (3) = $tru: USING(true)/WITH CHECK(true)
        my $cmd  = ($stmt =~ /\bfor\s+(all|insert|update|delete)\b/) ? uc($1) : "ALL";
        my $role = (!$has_to) ? "none" : (($roles =~ /\bpublic\b/) ? "public" : "authenticated");
        print "  [B2] Blanket-Schreibpolicy ohne Rollen-Helper: $name ($cmd TO $role USING/CHECK true)\n"; $bad=1;
      }
    }
    my @chunks = split /(?=create\s+(?:or\s+replace\s+)?function)/i, $low;
    for my $c (@chunks) {
      next unless $c =~ /security\s+definer/;
      unless ($c =~ /set\s+search_path/) {
        my ($fn) = $c =~ /function\s+([a-z0-9_.\"]+)/;
        $fn = "?" unless defined $fn;
        print "  [C] SECURITY DEFINER ohne SET search_path: $fn\n"; $bad=1;
      }
    }
    exit($bad?1:0);
  ' "$f") && rc=0 || rc=$?
  if [ "${rc:-0}" -ne 0 ]; then
    echo "::error file=$f::POLICY-LINT-Verstoss"
    echo "FAIL $f"
    printf '%s\n' "$out"
    violations=$((violations+1))
  else
    echo "OK   $f"
  fi
}

in_scope() {
  case "$1" in
    supabase/migrations/*.sql) return 0;;
    modules/*/schema/*|modules/*/rpc/*) return 0;;
    *) return 1;;
  esac
}

n=0
if [ "$#" -gt 0 ]; then
  for f in "$@"; do check_file "$f"; n=$((n+1)); done
else
  BASE_REF="${BASE_REF:-origin/main}"
  range=""
  if git rev-parse --verify -q "$BASE_REF" >/dev/null 2>&1; then
    range="${BASE_REF}...HEAD"
  elif git rev-parse --verify -q HEAD~1 >/dev/null 2>&1; then
    range="HEAD~1...HEAD"
  fi
  if [ -n "$range" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      in_scope "$f" || continue
      check_file "$f"; n=$((n+1))
    done < <(git diff --name-only --diff-filter=ACM "$range" 2>/dev/null || true)
  fi
fi

if [ "$n" -eq 0 ]; then echo "POLICY-LINT: keine relevanten SQL-Dateien — OK"; exit 0; fi
if [ "$violations" -gt 0 ]; then echo "::error::POLICY-LINT: $violations Datei(en) mit Verstoss."; exit 1; fi
echo "POLICY-LINT: alles gruen ($n Datei(en))."
