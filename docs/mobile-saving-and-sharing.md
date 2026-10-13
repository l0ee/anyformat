# Mobile saving and native sharing

All conversion and export preparation stays in the browser. The Share action
passes the completed file to the device's native share menu only when tapped.

## Available actions

- **PNG/JPEG on iPhone/iPad:** Save to Photos… opens a full-resolution image
  preview. Touch and hold the image and choose Save Image or Add to Photos,
  if available. Download file and native Share… remain alternatives.
- **PNG/JPEG on Android:** Save image uses browser downloading. Check Downloads
  or Files; automatic appearance in Gallery depends on the device.
- **PDF:** Download PDF remains available. On iOS, check Files or choose Save to
  Files from the native menu when offered.
- **WebP/SVG:** Download and native sharing when the browser accepts that exact
  file. There is no Photos-saving promise for these formats.
- **Vector Studio:** Choose Image format and Image scale in Save or share an
  image, tap Prepare image, then use the ready file's actions. Source/settings
  changes invalidate prepared exports. Existing direct downloads still work.

Native sharing requires browser support, a secure context (HTTPS in production),
and a fresh user gesture. Sharing is capability-checked for the actual file,
independently of operating-system detection. A Telegram URL-sharing link cannot
attach these local files; choose Telegram in the native menu or download and
attach the file manually. Available apps and actions are controlled by the OS.

Cancelling does not cause a download. A resolved share request does not confirm
that a photo was saved or a message sent. Photos access is not granted to the
website by detecting iOS. The image-saving preview preserves native long-press
and context-menu behavior.

## Physical-device acceptance checklist

**Status: not yet verified on physical devices.** Automated tests validate UI,
file payloads, activation, cancellation, and URL cleanup using mocked sharing;
they do not validate the native share targets or photo-library outcomes.

Record device model, OS version, browser version, receiving-app version, and
test date for each run. Use the HTTPS deployment, including both normal browser
mode and installed PWA mode if applicable.

| Device/browser | Required manual verification | Status |
| --- | --- | --- |
| iPhone Safari | PNG/JPEG long-press saving, PDF download, Telegram attachments | Pending |
| iPhone Chrome | Image saving instructions, Downloads/Files, native sharing | Pending |
| iPad Safari (desktop identification) | Photos preview, labels, sharing | Pending |
| Android Chrome | Image download location, PDF download, Telegram attachments | Pending |
| Samsung Internet, if available | Capability detection and sharing fallback | Pending |

For every relevant device:

1. Convert a transparent PNG and a JPEG. Confirm preview resolution and saving
   behavior, including whether a native Save Image/Add to Photos action exists.
2. Share each image to Telegram and another available app. Confirm attachment
   contents, filenames, dimensions, and any receiving-app image transformations.
3. Download/share a PDF. Confirm it remains a document and can be found in Files.
4. Cancel sharing. Confirm there is no automatic download or failure message.
5. Prepare a Vector Studio PNG at 1× and 2×. Confirm the separate Share tap
   opens the native menu and sends the chosen size.
6. Edit settings or change scale. Confirm the earlier prepared file is no
   longer offered and photo-preview URLs are replaced/closed appropriately.
7. Test unsupported sharing (including an in-app browser if available). Confirm
   download and manual-attachment guidance remain usable.

## References

- [Web Share specification](https://w3c.github.io/web-share/)
- [MDN: Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [WebKit report: missing Save Image on iOS 16](https://bugs.webkit.org/show_bug.cgi?id=255544)
  (historical report, not evidence of every current iOS version's behavior)
- [Apple: Find downloads](https://support.apple.com/en-us/102440)
- [Google: Android downloads](https://support.google.com/chrome/answer/95759?hl=en&co=GENIE.Platform%3DAndroid)
- [Google: iOS downloads and image saving](https://support.google.com/chrome/answer/95759?hl=en&co=GENIE.Platform%3DiOS)
- [Telegram: Sharing Button](https://core.telegram.org/widgets/share)
