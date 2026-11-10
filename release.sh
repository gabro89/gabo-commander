#!/usr/bin/env bash
# Release a new version · új verzió kiadása
#
#   ./release.sh                 # patch: 1.1.0 → 1.1.1
#   ./release.sh minor           # 1.1.0 → 1.2.0
#   ./release.sh major           # 1.1.0 → 2.0.0
#   ./release.sh 1.4.2           # exact version
#   ./release.sh minor --dry-run # only show what would happen
#   ./release.sh minor --yes     # no confirmation
#
# Steps: checks → VERSION → CHANGELOG ("## Unreleased" becomes "## X.Y.Z – date";
# if it is empty, the commit subjects since the last tag are used) → commit → tag vX.Y.Z → push.
# The tag push makes GitHub Actions create the GitHub Release page, and servers then show the update notice.
# On Windows run it from Git Bash.
set -euo pipefail
cd "$(dirname "$0")"

BUMP=patch DRY=0 YES=0
for a in "$@"; do
  case "$a" in
    patch|minor|major) BUMP=$a ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP=$a ;;
    -n|--dry-run) DRY=1 ;;
    -y|--yes) YES=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $a  (see ./release.sh --help)" >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; R=$'\e[31m'; N=$'\e[0m'; else B="" G="" R="" N=""; fi
die() { printf '%s✗ %s%s\n' "$R" "$*" "$N" >&2; exit 1; }
step() { printf '%s→%s %s\n' "$B" "$N" "$*"; }

# ------------------------------------------------------------------ checks
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not a git repository."
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = main ] || die "Releases are made from 'main' (you are on '$BRANCH')."
DIRTY="$(git status --porcelain | grep -v ' CHANGELOG.md$' || true)"
[ -z "$DIRTY" ] || die "Commit or stash your changes first (only CHANGELOG.md may be uncommitted):
$DIRTY"
step "Fetching origin…"
git fetch -q --tags origin
if [ -n "$(git rev-list HEAD..origin/main 2>/dev/null)" ]; then die "origin/main has commits you don't have: git pull first."; fi

CUR="$(tr -d '[:space:]' < VERSION)"
[[ "$CUR" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || die "VERSION is not X.Y.Z: '$CUR'"
MA=${BASH_REMATCH[1]} MI=${BASH_REMATCH[2]} PA=${BASH_REMATCH[3]}
case "$BUMP" in
  patch) NEW="$MA.$MI.$((PA + 1))" ;;
  minor) NEW="$MA.$((MI + 1)).0" ;;
  major) NEW="$((MA + 1)).0.0" ;;
  *) NEW="$BUMP" ;;
esac
[[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Invalid version: $NEW"
newer() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)" = "$1" ] && [ "$1" != "$2" ]; }
newer "$NEW" "$CUR" || die "$NEW is not newer than the current $CUR."
TAG="v$NEW"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then die "Tag $TAG already exists."; fi

LAST_TAG="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
RANGE="${LAST_TAG:+$LAST_TAG..}HEAD"

# ------------------------------------------------------------------ release notes
section() {   # the body of the "## <heading>" section whose heading starts with $1
  awk -v h="## $1" '
    /^## / { if (p) exit; if (index($0, h) == 1) { p = 1; next } }
    p' CHANGELOG.md
}
NOTES="$(section 'Unreleased' | grep -v '^<!--' | sed -e '/./,$!d')"
GENERATED=0
if ! printf '%s' "$NOTES" | grep -q '[^[:space:]]'; then
  NOTES="$(git log --no-merges --format='- %s' "$RANGE")"
  [ -n "$NOTES" ] || die "Nothing to release: no commits since ${LAST_TAG:-the beginning} and '## Unreleased' is empty."
  GENERATED=1
fi
DATE="$(date +%F)"

printf '\n%sGabo Commander %s → %s%s   (%s, last tag: %s)\n\n' "$B" "$CUR" "$NEW" "$N" "$DATE" "${LAST_TAG:-none}"
[ "$GENERATED" = 1 ] && echo "('## Unreleased' is empty – notes from the commit messages:)"
printf '%s\n\n' "$NOTES"

if [ "$DRY" = 1 ]; then echo "Dry run – nothing changed."; exit 0; fi
if [ "$YES" = 0 ]; then
  printf '%sRelease %s and push it to GitHub? [y/N]: %s' "$B" "$TAG" "$N"
  read -r ans
  case "$ans" in y|Y|yes|i|I|igen) ;; *) die "Cancelled." ;; esac
fi

# ------------------------------------------------------------------ quick checks
step "Checking syntax…"
PY=""   # Windowson a "python3" lehet a Microsoft Store álparancsa: csak a ténylegesen működőt használjuk
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -z "$PY" ] || "$PY" -c "import ast,sys; ast.parse(open('server.py',encoding='utf-8').read())" || die "server.py has a syntax error."
if command -v node >/dev/null 2>&1; then for f in static/*.js; do node --check "$f" || die "$f has a syntax error."; done; fi
for f in *.sh; do bash -n "$f" || die "$f has a syntax error."; done

# ------------------------------------------------------------------ write, commit, tag, push
step "Updating VERSION and CHANGELOG.md…"
printf '%s\n' "$NEW" > VERSION
tmp="$(mktemp)"
if grep -q '^## Unreleased[[:space:]]*$' CHANGELOG.md; then
  # "## Unreleased" stays (empty) on top, its content moves under the new version heading
  NOTES="$NOTES" awk -v h="## $NEW – $DATE" -v gen="$GENERATED" '
    !done && /^## Unreleased[[:space:]]*$/ {
      print; print ""; print h; print ""
      if (gen == 1) { print ENVIRON["NOTES"]; print "" }
      done = 1; skip = 1; next
    }
    skip && /^[[:space:]]*$/ { next }
    { skip = 0; print }' CHANGELOG.md > "$tmp"
else
  NOTES="$NOTES" awk -v h="## $NEW – $DATE" '
    !done && /^## / { print "## Unreleased"; print ""; print h; print ""; print ENVIRON["NOTES"]; print ""; done = 1 }
    { print }
    END { if (!done) { print ""; print h; print ""; print ENVIRON["NOTES"] } }' CHANGELOG.md > "$tmp"
fi
cat "$tmp" > CHANGELOG.md && rm -f "$tmp"

git add VERSION CHANGELOG.md
git commit -q -m "Release $TAG"
git tag -a "$TAG" -m "Gabo Commander $NEW" -m "$NOTES"
step "Pushing main and $TAG…"
git push -q origin main
git push -q origin "$TAG"

URL="$(git remote get-url origin | sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##')"
printf '\n%s✓ Released %s%s\n' "$G" "$TAG" "$N"
echo "  Release page (ready in ~1 minute): $URL/releases/tag/$TAG"
echo "  On the servers:                    sudo gabo-commander update"
