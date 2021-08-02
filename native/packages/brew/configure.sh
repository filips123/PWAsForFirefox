#!/usr/bin/env bash
set -euo pipefail

# Internal script used by Homebrew formula to prepare project for Homebrew installation
# Needs to be run in the "native" directory of the repository
# Usage: ./configure.sh {VERSION} {BIN} {LIBEXEC}

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 {VERSION} {BIN} {LIBEXEC}" > /dev/stderr
    exit 1
fi

VERSION=$1
BIN=$2
LIBEXEC=$3

# Set the correct version in the source files
sed -i"" -e "s/version = \"0.0.0\"/version = \"$VERSION\"/g" Cargo.toml
sed -i"" -e "s/DISTRIBUTION_VERSION = '0.0.0'/DISTRIBUTION_VERSION = '$VERSION'/g" userchrome/profile/chrome/pwa/chrome.jsm

# Set the path in the manifest to the Homebrew libexec directory
cp manifests/macos.json manifests/brew.json
sed -i"" -e "s@/usr/local/libexec/firefoxpwa-connector@$LIBEXEC/firefoxpwa-connector@g" manifests/brew.json
