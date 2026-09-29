#!/usr/bin/env bash
# ============================================================================
# SIH26096 — build the two deliverables, or run the gates on a machine that has
# no Unity installed.
#
#   Tools/build.sh            both targets
#   Tools/build.sh windows    Builds/Windows/AmbedkarDigitalHeritage.exe
#   Tools/build.sh android    Builds/Android/AmbedkarDigitalHeritage.apk
#   Tools/build.sh check      content, character, C# and browser gates only
#
# The gates always run first: a build that would ship uncited content or an
# unimplemented clip fails here rather than in front of a judging panel.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNITY_PROJECT="$ROOT/UnityProject"
BUILD_WINDOWS="$ROOT/Builds/Windows"
BUILD_ANDROID="$ROOT/Builds/Android"
UNITY="${UNITY_PATH:-Unity}"

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

run_gates() {
  bold "Content gate"
  python3 "$ROOT/Tools/validate_content.py"

  bold "Character specification audit"
  python3 "$ROOT/Tools/audit_character_spec.py"

  bold "Unity C# static check (ids, clips, content schema)"
  python3 "$ROOT/Tools/check_csharp.py"

  if command -v node >/dev/null 2>&1; then
    bold "Browser build validation"
    node "$ROOT/web/tools/validate_build.js"
    if [ -d "$ROOT/web/src" ]; then
      bold "Browser build test suites"
      bash "$ROOT/web/tools/run_tests.sh"
    fi
  else
    echo "node not found — skipping the browser gates (the Unity gates above still ran)"
  fi
}

require_unity() {
  command -v "$UNITY" >/dev/null 2>&1 || fail \
    "Unity ($UNITY) not found. Install Unity 6000.0.23f1, or set UNITY_PATH to the editor binary.
     The gates can still be run with:  Tools/build.sh check"
}

build_windows() {
  require_unity
  bold "Building Windows x64 (IL2CPP)"
  mkdir -p "$BUILD_WINDOWS"
  "$UNITY" -quit -batchmode -nographics \
    -projectPath "$UNITY_PROJECT" \
    -executeMethod Heritage.Editor.BuildScript.BuildWindows \
    -logFile "$BUILD_WINDOWS/build.log"
  [ -f "$BUILD_WINDOWS/AmbedkarDigitalHeritage.exe" ] || fail \
    "Build finished without producing Builds/Windows/AmbedkarDigitalHeritage.exe — see $BUILD_WINDOWS/build.log"
  echo "Windows build: $BUILD_WINDOWS/AmbedkarDigitalHeritage.exe"
}

build_android() {
  require_unity
  bold "Building Android ARM64 (IL2CPP)"
  mkdir -p "$BUILD_ANDROID"
  "$UNITY" -quit -batchmode -nographics \
    -projectPath "$UNITY_PROJECT" \
    -executeMethod Heritage.Editor.BuildScript.BuildAndroid \
    -logFile "$BUILD_ANDROID/build.log"
  [ -f "$BUILD_ANDROID/AmbedkarDigitalHeritage.apk" ] || fail \
    "Build finished without producing Builds/Android/AmbedkarDigitalHeritage.apk — see $BUILD_ANDROID/build.log"
  echo "Android build: $BUILD_ANDROID/AmbedkarDigitalHeritage.apk"
}

TARGET="${1:-both}"
case "$TARGET" in
  check)
    run_gates
    bold "Gates passed."
    ;;
  windows)
    run_gates; build_windows
    ;;
  android)
    run_gates; build_android
    ;;
  both)
    run_gates; build_windows; build_android
    bold "Both deliverables are in Builds/."
    ;;
  *)
    fail "Unknown target '$TARGET'. Use: check | windows | android | both"
    ;;
esac
