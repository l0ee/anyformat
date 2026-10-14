# PDF codec fixture

`blue.jp2` is a generated 32 × 32 solid-blue JPEG2000 image, created with
ImageMagick (`magick -size 32x32 xc:blue -quality 100 blue.jp2`). It contains
no third-party artwork. The production-CSP test embeds it in a PDF using
`JPXDecode` and checks the rendered pixels, so a silently dropped image fails
the test. Running the test does not require ImageMagick.
