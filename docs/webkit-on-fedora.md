# WebKit verification on Nobara/Fedora

Playwright 1.63's Linux WebKit bundle expects ICU 74 and JPEG ABI 8. Nobara 44
provides ICU 77 and JPEG ABI 6. Playwright's dependency-install command uses
Ubuntu/Debian package names, so its `libicu74` / `libjpeg-turbo8` suggestion does
not directly apply to this host.

On this Linux x86-64 host, add the missing libraries to the user-owned WebKit
browser bundle. Its launcher and dependency validator search both
`minibrowser-gtk/sys/lib` and `minibrowser-wpe/sys/lib`. This setup requires no sudo
and leaves the system libraries in place.

## Repeatable setup

Prerequisites: the project's dependencies, the Playwright WebKit download,
`curl`, `dpkg-deb`, `sha256sum`, `cmp`, and `install`. Run from the project root.
The package versions and SHA-256 values below come from Ubuntu's
[ICU download metadata](https://packages.ubuntu.com/noble-updates/amd64/libicu74/download)
and [JPEG download metadata](https://packages.ubuntu.com/noble/amd64/libjpeg-turbo8/download).

```bash
set -eu
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
npx playwright install webkit
webkit="$(node --input-type=module -e 'import { dirname } from "node:path"; import { webkit } from "@playwright/test"; console.log(dirname(webkit.executablePath()));')"
test -d "$webkit/minibrowser-gtk/sys/lib"
test -d "$webkit/minibrowser-wpe/sys/lib"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT

curl --fail --location --max-time 90 -o "$work/icu.deb" \
  https://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu74_74.2-1ubuntu3.1_amd64.deb
curl --fail --location --max-time 90 -o "$work/jpeg.deb" \
  https://archive.ubuntu.com/ubuntu/pool/main/libj/libjpeg-turbo/libjpeg-turbo8_2.1.5-2ubuntu2_amd64.deb
sha256sum --check <<EOF
c9a70989678660eed9a1e904c74fa043da8bec8e2036856fc16e31ced79b04f8  $work/icu.deb
f68b5b23bc8a1688fb787d2aed7e2cdf895a73022f6a5025e183162dac4500b2  $work/jpeg.deb
EOF

dpkg-deb --extract "$work/icu.deb" "$work/root"
dpkg-deb --extract "$work/jpeg.deb" "$work/root"
for backend in minibrowser-gtk minibrowser-wpe; do
  for library in libicudata.so.74 libicui18n.so.74 libicuuc.so.74 libjpeg.so.8; do
    source="$work/root/usr/lib/x86_64-linux-gnu/$library"
    target="$webkit/$backend/sys/lib/$library"
    if [ -e "$target" ]; then
      cmp --silent "$source" "$target"
    else
      install -m 0644 "$source" "$target"
    fi
  done
done
install -m 0644 "$work/root/usr/share/doc/libicu74/copyright" "$webkit/ICU-COMPAT-COPYRIGHT"
install -m 0644 "$work/root/usr/share/doc/libjpeg-turbo8/copyright" "$webkit/JPEG-COMPAT-COPYRIGHT"

npx playwright test --project=webkit
```

Extraction does not run Debian package-maintainer scripts. The setup copies
libraries with the required ABI and leaves the host's incompatible ICU and JPEG
libraries unchanged. If an existing file has different bytes, the recipe stops
for review.

## PDF rendering regression

The production-CSP pixel tests found that embedded JPEGs rendered white through
PDF.js's native `ImageDecoder` path in WebKit. The original JPEG, JPEG2000 image,
and text rendered correctly. Disabling `ImageDecoder` restored the JPEG;
disabling `OffscreenCanvas` alone did not.

`convertPdfToImage` now sets PDF.js's documented `isImageDecoderSupported: false`
option, retaining the portable decoder for conversions and source previews.
Using the portable decoder may be slower on image-heavy PDFs.
The unchanged JPEG/JPEG2000 pixel assertions pass under both production CSP
modes in Chromium, Firefox, and WebKit. Release verification runs the complete
three-engine suite with retries disabled.

## Scope and updates

This setup was tested with the browser bundle described above. Playwright does
not officially support Nobara. After a WebKit revision changes or its browser
cache is deleted, recheck the ABI requirements and reapply the setup. Review the
official package metadata if a checksum changes.
The [version-matched Playwright container](https://playwright.dev/docs/docker) is
the upstream-supported route for unsupported Linux distributions when a
container engine is available. Ubuntu CI uses the normal `--with-deps` install.

Linux WebKit exercises the Safari engine, but does not replace testing Safari on
macOS or a physical iPhone/iPad. Actual device sharing and Photos integration
still need device verification.
