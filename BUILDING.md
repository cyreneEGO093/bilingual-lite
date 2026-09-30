# Reproducible build / AMO source instructions

Release: 0.3.0. License: GPL-3.0-only, with unmodified MIT runtime components.

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

Outputs are `dist/firefox-mv3/`, `dist/chrome-mv3/` and `dist/bilingual-lite-0.3.0-{firefox,chrome}.zip`. Compare extracted file contents rather than ZIP bytes, since archive timestamps may vary. Minification uses Vite; no obfuscation or remote execution is used. `web-ext` is pinned as a development tool for Mozilla validation and is not included in the installed extension.

PNG icons and legal texts are included in the source archive. `assets/icon.svg` is the original editable artwork. Regenerating PNGs is optional (`node scripts/create-icons.mjs`, with Playwright Chromium installed or `TEST_BROWSER_PATH` set), and is not part of the release build. The build records actually included npm runtime modules under `.wxt/license-audit/`; `npm run audit:licenses` regenerates their notices, module hashes and exact source snapshots. A new runtime dependency fails this audit pending license review.

## Functional review without a paid API account

1. Run `node scripts/reviewer-server.mjs`. It binds only to `127.0.0.1:8787`.
2. Load `dist/firefox-mv3/manifest.json` as a temporary extension using `about:debugging#/runtime/this-firefox`.
3. In extension Options set API Endpoint to `http://127.0.0.1:8787/v1`, clear API Key, leave the default model names, and save.
4. Open `http://127.0.0.1:8787/`, enable scrolling or whole-page translation, switch bilingual/translated-only, and scroll. The local server returns clearly labelled synthetic translations.
5. Open `http://127.0.0.1:8787/manga`, hover the image, test full translation, manual crop, clear/restore and move/resize handles.
6. Close translation and confirm original content is restored. Ctrl+C stops the fixture server. No API key, account or payment is needed for this local workflow.

These fixtures exercise actual extension networking, rendering and settings, but do not test a third-party model's translation quality. Real inference requires a user's BYOK service account; no credentials are distributed with the source or binary. If reviewers require live-service testing, the publisher must supply any temporary restricted credentials privately through AMO, never inside the public package.

## Submission context

- Minimum desktop Firefox 140, with built-in consent for `websiteContent` and `authenticationInfo`. Android manifest minimum is 142 to support the same consent declaration, but this release is validated for desktop only and should be submitted for desktop.
- Broad HTTP(S) host access supports content scripts, user-configurable HTTPS APIs and cross-origin image downloads. Actual remote API and image-download requests require HTTPS; loopback HTTP is allowed for local services. Page content is sent only when translation is enabled or invoked.
- Pixiv request header adjustment is limited to extension-initiated HTTPS GET requests to `pximg.net`; it sends only the constant `https://www.pixiv.net/` origin as Referer and no site cookies.
- No analytics, remote scripts, native messaging, downloaded model execution or image inpainting. Model outputs are validated and inserted as text, never executable HTML.
- Private browsing is disabled for this release to avoid mixing in-memory translation caches across private and normal windows.
- The extension ID `bilingual-lite@example.org` is a stable technical identifier from the development versions, not a contact email. Keep it stable for updates unless deliberately creating a distinct add-on.
- The installable ZIP contains only runtime files, icons and privacy/license resources. Submission instructions, test fixtures, audit material and third-party source snapshots are in the **separate source archive**, not the installed extension.

Official source requirements: https://extensionworkshop.com/documentation/publish/source-code-submission/
