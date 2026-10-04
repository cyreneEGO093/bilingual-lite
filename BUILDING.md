# Reproducible build / AMO source instructions

Release: 0.4.0. License: GPL-3.0-only, with unmodified MIT runtime components.

## Environment and commands

Tested on Windows x64 with Node.js 24.19.0 and npm 11.17.0. Install Node.js from https://nodejs.org/ (Node 24 LTS recommended). The build scripts are portable Node/npm commands; no PowerShell, Python, browser binary, proxy, GPU, API key or account is required to build. Linux/ARM builds have not been run in this workspace.

Unzip the source archive into an empty directory, open that directory in a terminal, and run:

```text
npm ci
npm test
npm run build
npm run lint:firefox
npm run zip
```

`npm ci` downloads public packages from the official npm registry using `package-lock.json`. The WXT postinstall prepares local types. The optional esbuild native helper is a build tool, not extension runtime code. Do not run `npm update` or replace the lockfile when reproducing this release.

Outputs are `dist/firefox-mv3/`, `dist/chrome-mv3/` and `dist/bilingual-lite-0.4.0-{firefox,chrome}.zip`. Compare extracted file contents rather than ZIP bytes, since archive timestamps may vary. Minification uses Vite; no obfuscation or remote execution is used. `web-ext` is pinned as a development tool for Mozilla validation and is not included in the installed extension.

PNG icons and legal texts are included in the source archive. `assets/icon.svg` is the original editable artwork. Regenerating PNGs is optional (`node scripts/create-icons.mjs`, with Playwright Chromium installed or `TEST_BROWSER_PATH` set), and is not part of the release build. The build records actually included npm runtime modules under `.wxt/license-audit/`; `npm run audit:licenses` regenerates their notices, module hashes and exact source snapshots. A new runtime dependency fails this audit pending license review.

## Functional review without a paid API account

1. Run `node scripts/reviewer-server.mjs`. It binds only to `127.0.0.1:8787`.
2. Load `dist/firefox-mv3/manifest.json` as a temporary extension using `about:debugging#/runtime/this-firefox`.
3. In extension Options set API Endpoint to `http://127.0.0.1:8787/v1`, clear API Key, leave the default model names, and save.
4. Open `http://127.0.0.1:8787/`, enable scrolling or whole-page translation, switch bilingual/translated-only, and scroll. The local server returns clearly labelled synthetic translations.
5. Open `http://127.0.0.1:8787/manga`, hover the image, test full translation, manual crop, clear/restore and move/resize handles. The toolbar avoids bubbles and can be collapsed with its button or Esc (Esc cancels selection first). `/mobile` exercises a fixed chat composer; `/mobile-manga` provides a responsive image for touch testing.
6. Close translation and confirm original content is restored. Ctrl+C stops the fixture server. No API key, account or payment is needed for this local workflow.

These fixtures exercise actual extension networking, rendering and settings, but do not test a third-party model's translation quality. Real inference requires a user's BYOK service account; no credentials are distributed with the source or binary. If reviewers require live-service testing, the publisher must supply any temporary restricted credentials privately through AMO, never inside the public package.

## Optional Android interaction tests

Building the extension does not require Android tools. The following setup is only needed to run `npm run test:android`:

1. Install Android SDK Platform Tools, the Android Emulator and an Android 14 x86_64 system image from Google's official SDK distribution. Install official Firefox for Android and geckodriver. Use a dedicated test emulator/device without personal data; this test starts Firefox with an isolated temporary profile and changes device orientation.
2. Start the emulator and confirm it is booted with `adb devices`. Enable ADB debugging. The tested emulator used 720×1280 pixels, density 320, 1536 MB RAM and Android's software keyboard enabled. Do not use a hardware keyboard that suppresses the IME. The test uses Firefox's `automationtest` launch extra to suppress first-run interruptions ([Mozilla implementation](https://bugzilla.mozilla.org/show_bug.cgi?id=2064671)); use Firefox 157 for this workflow. The tested AOSP image supports the runner's internal-storage mode; do not assume a non-root physical device can use this mode.
3. Set `ADB_BIN` to the absolute adb executable path, `GECKODRIVER_PATH` to geckodriver, and `TEST_ANDROID_DEVICE` to the serial shown by adb (for example `emulator-5554`). No custom proxy or API key is needed. Then run `npm run zip` and `npm run test:android` from the source root. The runner starts geckodriver with internal Android test storage, temporarily installs the Firefox ZIP, and uses `adb reverse` for its loopback mock server.
4. The test covers responsive settings, background requests, translation modes, movable/collapsible controls, a real Android soft keyboard, native taps/long press, image selection, bubble move/resize and landscape. Screenshots use synthetic fixtures only. The runner closes its session and removes its port forwarding when finished.

Validated with Windows x64, Android Emulator 37.2.12, Android 14 (API 34), Platform Tools 37.0.1, geckodriver 0.37.1 and Firefox Android 157.0. This is emulator validation, not physical-device or iOS coverage. Test screenshots are under `evidence/android-*.png`.

For manual Android review, forward the review server with `adb -s <serial> reverse tcp:8787 tcp:8787`, configure the same loopback endpoint in the extension, and open `/mobile` and `/mobile-manga`. Remove the forwarding afterwards. Temporary add-on installation requires a development/debugging workflow; the unsigned ZIP is not a normal Android install package.

## Submission context

- Minimum desktop Firefox 140 and Android Firefox 142, with built-in consent for `websiteContent` and `authenticationInfo`. Submit 0.4.0 as an update to the existing add-on and verify AMO lists Android compatibility as well as desktop. The manifest already declares `gecko_android`; AMO derives its Android range from that declaration ([Mozilla compatibility guidance](https://extensionworkshop.com/documentation/publish/version-compatibility/)). Tested Android version: 157.0 on Android 14 emulator; lower declared versions and physical phones have not been individually tested.
- Broad HTTP(S) host access supports content scripts, user-configurable HTTPS APIs and cross-origin image downloads. Actual remote API and image-download requests require HTTPS; loopback HTTP is allowed for local services. Page content is sent only when translation is enabled or invoked.
- Pixiv request header adjustment is limited to extension-initiated HTTPS GET requests to `pximg.net`; it sends only the constant `https://www.pixiv.net/` origin as Referer and no site cookies.
- No analytics, remote scripts, native messaging, downloaded model execution or image inpainting. Model outputs are validated and inserted as text, never executable HTML.
- Private browsing is disabled for this release to avoid mixing in-memory translation caches across private and normal windows.
- Starting with 0.3.2, the Firefox extension ID is `{cfc2c8e0-b3a6-45b3-9496-56c70387c2bb}`. This is a new add-on identity, not an update identity for 0.3.0/0.3.1. Keep this new ID stable for all subsequent store updates; settings under the previous identity are not migrated automatically.
- The installable ZIP contains only runtime files, icons and privacy/license resources. Submission instructions, test fixtures, audit material and third-party source snapshots are in the **separate source archive**, not the installed extension.

Official source requirements: https://extensionworkshop.com/documentation/publish/source-code-submission/
