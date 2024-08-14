#!/bin/sh


set -ex

ROOT=$(cd "$(dirname "$0")/.." && pwd)

# Read the version from Cargo.toml of the binding_typescript_wasm
CURRENT_VERSION=$(grep '^version' "$ROOT/deps/swc/bindings/binding_typescript_wasm/Cargo.toml" | awk -F\" '{print $2}')

# Print the version
echo "The version installed version is: $CURRENT_VERSION"

if [[ -n "${NEW_SWC_VERSION}" ]]; then
    NEW_VERSION="${NEW_SWC_VERSION}"
else
    NEW_VERSION=$(npm view @swc/wasm-typescript version)
fi

echo "Comparing $CURRENT_VERSION with $NEW_VERSION"
if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
    echo "Skipped because @swc/wasm-typescript is on the latest version."
    exit 0
fi

echo "Updating SWC to $NEW_VERSION"

cd "$ROOT/deps/swc"

git fetch origin refs/tags/v${NEW_VERSION}:refs/tags/v${NEW_VERSION} --depth=1
git checkout v${NEW_VERSION}

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
