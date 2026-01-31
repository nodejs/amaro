#!/bin/sh


set -ex

ROOT=$(cd "$(dirname "$0")/.." && pwd)

# Read the version from Cargo.toml of the binding_typescript_wasm
CURRENT_VERSION=$(grep '^version' "$ROOT/deps/swc/bindings/binding_typescript_wasm/Cargo.toml" | awk -F\" '{print $2}')

# Print the version
echo "The version installed version is: $CURRENT_VERSION"

NEW_VERSION=$(npm view @swc/wasm-typescript version)

echo "Comparing $CURRENT_VERSION with $NEW_VERSION"
if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
    echo "Skipped because @swc/wasm-typescript is on the latest version."
    exit 0
fi

echo "Making temporary workspace..."

WORKSPACE=$(mktemp -d 2> /dev/null || mktemp -d -t 'tmp')

cleanup () {
  EXIT_CODE=$?
  [ -d "$WORKSPACE" ] && rm -rf "$WORKSPACE"
  exit $EXIT_CODE
}

trap cleanup INT TERM EXIT

cd "$WORKSPACE"

TARBALL=$(curl -sL "https://api.github.com/repos/swc-project/swc/releases/tags/v$NEW_VERSION" | jq -r '.tarball_url')

TARBALL_NAME="swc-$NEW_VERSION.tar.gz"

curl -sL -o "$TARBALL_NAME" "$TARBALL"

mkdir swc

tar xvfz "$TARBALL_NAME" --strip 1 -C swc

cd swc

DEPS_FOLDER="$ROOT/deps/swc"

rm -rf "$DEPS_FOLDER"

mkdir -p "$DEPS_FOLDER"

mv Cargo.toml "$DEPS_FOLDER"

mv Cargo.lock "$DEPS_FOLDER"

mv LICENSE "$DEPS_FOLDER"

mv bindings "$DEPS_FOLDER/bindings"

mv xtask "$DEPS_FOLDER/xtask"

mv .cargo "$DEPS_FOLDER/.cargo"

mv rust-toolchain "$DEPS_FOLDER/rust-toolchain"

mv crates "$DEPS_FOLDER/crates"

# Keep workspace tools (needed by Cargo workspace members like tools/generate-code)
mv tools "$DEPS_FOLDER/tools"

# Remove all unused folders (using -depth to process bottom-up)
find "$DEPS_FOLDER" -depth -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true
find "$DEPS_FOLDER" -depth -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find "$DEPS_FOLDER" -depth -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$DEPS_FOLDER" -depth -type d -name "benches" -exec rm -rf {} + 2>/dev/null || true
find "$DEPS_FOLDER" -depth -type d -name "fixture" -exec rm -rf {} + 2>/dev/null || true
find "$DEPS_FOLDER" -depth -type d -name "fixtures" -exec rm -rf {} + 2>/dev/null || true

# Remove test files
find "$DEPS_FOLDER" -type f -name "*test*.rs" -exec rm -f {} + 2>/dev/null || true
find "$DEPS_FOLDER" -type f -name "*spec*.rs" -exec rm -f {} + 2>/dev/null || true

# Remove testing crates (not needed for builds)
rm -rf "$DEPS_FOLDER/crates/testing" 2>/dev/null || true
rm -rf "$DEPS_FOLDER/crates/testing_macros" 2>/dev/null || true
rm -rf "$DEPS_FOLDER/crates/swc_ecma_testing" 2>/dev/null || true
rm -rf "$DEPS_FOLDER/crates/swc_ecma_transforms_testing" 2>/dev/null || true
rm -rf "$DEPS_FOLDER/crates/swc_plugin_backend_tests" 2>/dev/null || true

echo "All done!"
echo ""
echo "Please git add swc and commit the new version:"
echo ""
echo "$ git add -A deps/swc"
echo "$ git commit -m \"deps: update swc to $NEW_VERSION\""
echo ""
# The last line of the script should always print the new version,
# as we need to add it to $GITHUB_ENV variable.
echo "NEW_VERSION=$NEW_VERSION"
