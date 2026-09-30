# Third-party sources

These are unmodified upstream source snapshots for review and corresponding-source distribution. They are **MIT**, not newly authored GPL files. `licenses/WXT-MIT.txt` and the bundled `THIRD_PARTY_NOTICES.txt` retain their copyright and permission notice.

- `runtime/`: exact npm JavaScript modules that contribute code to the extension, copied by `scripts/audit-licenses.mjs`. Names, versions and SHA-256 hashes are recorded in `licenses/runtime-inventory.json`.
- `wxt-source/`: preferred TypeScript source for WXT 0.21.4 from upstream tag `wxt-v0.21.4`, commit `8fea9b4837282f4ad2a0d085ced6bee1a7de08fb`. The source snapshot includes the package's source tree and package metadata; no website, sample artwork, or test media from upstream are redistributed.
- `@wxt-dev/browser` uses JavaScript source directly; its installed `src/index.mjs` is preserved in `runtime/`. Its npm package metadata declares MIT and refers to the same WXT upstream repository. The browser package in the historical WXT tag is an older version and is deliberately not substituted for the installed version.

Builds use the exact official npm dependencies in `package-lock.json`, rather than altering or importing these audit snapshots. Development tools and optional Python OCR/model installations are not included in the extension or source archive.
