# Auto-Update — Design Spec

**Status:** Draft for review
**Scope:** Native macOS and Windows apps + real update data in the web simulator
**Model:** Adapted from Sentinel's updater (Tauri updater plugin + minisign + explicit promotion), rebuilt on GitHub Releases since Mouseflare has no Tauri layer and no CDN.

---

## 1. Goal

A user who installed Mouseflare once should get new versions without ever
re-visiting the repo: the app quietly notices a new stable release, downloads
it, verifies it cryptographically, and swaps itself on relaunch. A "Check for
Updates" action gives an immediate, visible answer.

### Non-goals (v1)

- No OS-level code signing / notarization (tracked separately; the updater's
  own signature check is what protects the update path, same as Sentinel).
- No delta updates — artifacts are ~1 MB zips; full downloads are fine.
- No per-user opt-in channels beyond stable vs. dev (the Settings UI already
  has a stable/beta channel selector; beta maps to the dev channel below).
- No auto-update of the web simulator (it's a website; it *displays* update
  info but never self-updates).

---

## 2. What we borrow from Sentinel, and what changes

| Sentinel | Mouseflare | Why it changes |
|---|---|---|
| Tauri updater plugin | Hand-rolled per-platform updaters (Swift / C#) | No Tauri; both apps are small enough that the update loop is ~200 lines each |
| minisign-signed artifacts, pubkey baked into app | Same (minisign, Ed25519) | Keep: this is the core security property |
| S3 + CloudFront hosting, `latest.json` manifest | GitHub Releases as both artifact host and feed | Public repo; free, CORS-enabled API, no infra to run |
| CI uploads, **maintainer promotes** via `promote_update.py` | CI builds a **draft** release; maintainer clicking **Publish** is the promotion moment | Same principle — publishing a release is atomic and flips the `releases/latest` API pointer |
| 6h quiet background poll; manual check shows a visible result | Same cadence and same manual/background split | Keep verbatim — it's good UX policy |
| Staged download → verify → ready → relaunch state machine | Same phases: `idle / available / downloading / ready / error` | Keep |

---

## 3. Release channels & promotion flow

Two channels, both already half-existing:

- **Dev channel** — the rolling `latest` prerelease that every push to `main`
  republishes today. Unchanged. The updater ignores prereleases; only people
  who manually download get these.
- **Stable channel** — new: versioned releases `vX.Y.Z`. This is what the
  auto-updater follows.

**Promotion flow** (the Sentinel-shaped part):

1. Maintainer decides current `main` is release-worthy (the rolling `latest`
   build doubles as the smoke-test candidate — same commit, same build steps).
2. `git tag v0.2.0 && git push origin v0.2.0`.
3. CI (`on: push: tags: v*`) builds both platforms exactly like the existing
   release-build workflow, **signs each zip with minisign**, stamps the version
   into `Info.plist` / the csproj from the tag, and creates a **draft** release
   with: `Mouseflare-macOS.zip`, `Mouseflare-macOS.zip.minisig`,
   `Mouseflare-Windows.zip`, `Mouseflare-Windows.zip.minisig`, `SHA256SUMS.txt`.
4. Maintainer smoke-tests the draft's artifacts, then clicks **Publish**.
   That is the single moment the update goes live: GitHub's
   `releases/latest` endpoint atomically starts returning the new version to
   every install.

**Rollback:** GitHub lets any published release be re-marked as "latest"
(`gh release edit vX.Y.Z --latest`). Clients compare versions with
"different-and-newer-feed-wins" semantics (see §6), so re-pointing latest at an
older release rolls the fleet back on their next check.

---

## 4. Artifact signing

- **Tooling:** [minisign](https://jedisct1.github.io/minisign/) (Ed25519),
  same as Sentinel. One keypair for the project.
- **Private key:** GitHub Actions secret (`MINISIGN_SECRET_KEY` +
  `MINISIGN_KEY_PASSWORD`), used only by the tag-triggered stable workflow.
  *Hardening option, deferred:* keep the key off CI entirely and have the
  maintainer sign locally during promotion, Sentinel-style. v1 accepts
  CI-held keys for a one-click flow; revisit if the threat model tightens.
- **Public key:** embedded as a string constant in both native apps (and
  committed to the repo as `minisign.pub` so third parties can verify
  downloads manually).
- **What's signed:** each platform zip. Clients verify the `.minisig` over the
  downloaded zip **before unpacking anything**. `SHA256SUMS.txt` remains for
  human verification; the updater relies on signatures, not checksums.
- **Trust rule:** a failed or missing signature is a hard stop and surfaces as
  the `error` phase with a non-scary message ("update could not be verified");
  the app never installs unverified bytes and never retries that same asset
  automatically.

---

## 5. Update feed

`GET https://api.github.com/repos/OffBy1-tech/Mouse-Flare/releases/latest`

- Returns only the newest **published, non-prerelease** release — draft and
  the rolling `latest` prerelease are invisible to it, which is exactly the
  promotion semantics we want.
- Unauthenticated rate limit is 60 req/hr/IP; at one check per 6 h per install
  this is a non-issue.
- Fields used: `tag_name` (version), `body` (release notes), `assets[]`
  (browser_download_url per platform zip + `.minisig`).
- Both native apps and the web simulator consume this same endpoint; no
  Mouseflare-owned server exists anywhere in the pipeline.

---

## 6. Client behavior (shared policy, both platforms)

State machine, borrowed intact from Sentinel's `useUpdater`:

```
idle ──check finds newer──▶ available ──user accepts──▶ downloading
                                                            │ verify ok
   ◀──────────── relaunch installs ─────────── ready ◀──────┘
                                                            │ verify fail / IO error
                                                          error
```

- **Background check:** every 6 h (respecting the existing
  `checkIntervalHours` setting; `0` = manual only) and once ~30 s after
  launch. Failures are **silent** — a broken network must never nag.
- **Manual check:** the existing "Check for Updates" UI. Always yields a
  visible result: "up to date", "vX.Y.Z available", or "check failed".
- **Version comparison:** semver parse of `tag_name` vs. the app's own
  compiled-in version. Install when feed ≠ current and feed is *the published
  latest* — this makes rollback work without special cases.
- **Re-check never downgrades state:** an in-flight download or a staged
  `ready` update is never reset by a subsequent poll (Sentinel's rule).
- **Download → verify → stage:** download zip + `.minisig` to a temp dir,
  minisign-verify, unpack, sanity-check the payload (expected executable
  exists), then hold in `ready` until the user opts to restart. No silent
  restarts — Mouseflare is a utility; killing it unprompted violates its own
  "never interfere" principle.
- **Consent model:** v1 downloads only after the user clicks "Update" on the
  available notification (tray/menu-bar item + Settings badge). A future
  "download automatically, install on quit" toggle can layer on top.

---

## 7. macOS implementation

New `Sources/Updater.swift` (~250 lines, no dependencies):

- **Check:** `URLSession` GET of the feed; decode with `Codable`.
- **Verify:** minisign signatures are Ed25519 — verify natively with
  `CryptoKit.Curve25519.Signing` by parsing the minisign sig format (~40
  lines), so no bundled binaries. The pubkey constant lives next to the code.
- **Install (the swap):**
  1. Unzip verified download to a temp dir (`Process` + `ditto -x -k`).
  2. Locate own bundle via `Bundle.main.bundleURL`. If the app is running
     from a read-only location or a translocated path, fall back to
     "Reveal download in Finder" instead of swapping (graceful degradation).
  3. Replace: move current `.app` to Trash-adjacent temp, move new `.app`
     into place (`FileManager.replaceItemAt` handles the atomic dance).
  4. Relaunch: `Process` launching `/usr/bin/open` on the new bundle path,
     then `NSApp.terminate`.
- **Quarantine note:** `URLSession` downloads from our own process don't get
  the quarantine xattr (no `LSFileQuarantineEnabled` in our Info.plist), so
  the relaunched app opens without Gatekeeper prompts. First-install UX is
  unchanged (documented right-click → Open until we notarize).
- **UI:** menu-bar item gains "Check for Updates…"; the Settings window's
  existing Check for Updates area shows real state (available version, notes,
  progress, Restart to Update button) instead of static text.
- **Version source:** `CFBundleShortVersionString` (CI stamps it from the
  tag); dev builds report `0.0.0-dev` and treat every check as "up to date"
  unless an env override (`MOUSEFLARE_UPDATE_FEED`) is set — this keeps local
  builds from self-replacing and gives us a test hook.

## 8. Windows implementation

New `Core/Updater.cs` (~250 lines):

- **Check:** `HttpClient` GET + `System.Text.Json`.
- **Verify:** Ed25519 is not in the .NET 8 BCL; verify minisign with a
  vendored single-file Ed25519 verifier (Chaos.NaCl is public-domain and
  ~1 file) rather than pulling a large crypto package.
- **Install (the swap):** Windows allows renaming a running exe:
  1. Unzip verified download to `update-staging/` beside the install.
  2. On "Restart to Update": rename running `Mouseflare.exe` →
     `Mouseflare.exe.old`, move staged files into place, relaunch the new
     exe (`Process.Start`), exit. New instance deletes `*.old` on startup.
  3. Any failure mid-swap: restore `.old` names, surface `error`.
- **UI:** tray menu gains "Check for Updates…"; the settings window reuses
  the same status-line + button pattern as the rest of the app.
- **Version source:** assembly version stamped by CI from the tag
  (`-p:Version=X.Y.Z`); same `0.0.0-dev` rule for local builds.

## 9. Web simulator

Replace the fabricated `updateChecker.ts` data (fake versions, fake SHA-256
"verification hashes", future dates) with the real feed:

- Fetch the same `releases/latest` endpoint client-side (api.github.com sends
  CORS headers).
- Show real version, release notes, published date, artifact sizes, and real
  download links; drop the fake checksum display in favor of a link to the
  release's `SHA256SUMS.txt`.
- The simulated in-app "Update Available" banner stays — driven by comparing
  the feed against the sim's pretend installed version, so the demo still
  demonstrates the flow even when the feed has no newer release.
- Keep a hardcoded snapshot as a fallback when the fetch fails (offline demo).

## 10. CI changes

Extend `.github/workflows/release-build.yml` (or a sibling `stable-release.yml`):

- **Trigger:** `push: tags: ['v*']` in addition to the existing main-push flow.
- **Version stamping:** derive `X.Y.Z` from the tag; `sed` into the generated
  `Info.plist` and pass `-p:Version=` to `dotnet publish`.
- **Signing step** (tag builds only): install minisign (brew / choco), sign
  both zips using the secret key, upload `.minisig` files alongside.
- **Release creation:** `gh release create vX.Y.Z --draft --title ... --notes-file ...`
  with all five assets. Never `--latest`, never auto-publish — publishing is
  the maintainer's promotion act.
- The rolling `latest` prerelease flow stays exactly as-is (dev channel).

## 11. Security considerations

- **Feed integrity:** HTTPS to api.github.com; the feed itself is not signed,
  but a tampered feed can only offer artifacts that still must pass minisign
  verification with our embedded pubkey. Worst case for a feed attacker is
  denial of update, not code execution.
- **Downgrade behavior:** deliberate — the client follows the published
  latest even if older (rollback support). An attacker able to re-point
  GitHub's latest already controls the repo; minisign still prevents them
  shipping *modified* artifacts unless they also hold the signing key.
- **Key compromise blast radius:** CI-held key means a compromised Actions
  environment could sign malicious bytes. Mitigations: the key is only
  exposed to tag-triggered workflows (no fork/PR path — tags require write
  access), and the maintainer smoke-tests drafts before publishing. The
  offline-signing upgrade path is documented in §4.
- **No new data collection:** the check is a single anonymous GET; no
  identifiers are sent. This must stay true to the PRD's privacy posture —
  note it in the README when the feature ships.

## 12. Milestones

1. **M1 — Stable release plumbing:** tag-triggered signed draft releases;
   minisign keypair generated; `minisign.pub` committed. No client changes
   yet. *Exit test: publish v0.1.0 by hand; verify assets + sigs.*
2. **M2 — Web simulator on real data:** replace `updateChecker.ts` internals.
   *Exit test: sim shows v0.1.0 from the live API.*
3. **M3 — macOS updater:** check + verify + swap + relaunch.
   *Exit test: install a deliberately-old build, watch it self-update to
   v0.1.x, verify the tampered-zip case hard-fails.*
4. **M4 — Windows updater:** same, with the rename-dance swap.
5. **M5 — Polish:** "install on quit" option, update-available tray badge,
   README/PRD updates describing the update path and its privacy properties.

## 13. Open questions

- **Beta channel semantics:** should the Settings "beta" channel follow the
  rolling `latest` prerelease (true nightlies) or tagged `-beta.N`
  prereleases? Leaning tagged prereleases — the rolling build has no
  stable version identity to compare against.
- **The `.old` cleanup on Windows** if the user's install dir is read-only
  (Program Files without elevation): v1 likely detects non-writable install
  dirs and degrades to "open download page", like the macOS translocation
  fallback.
- **When to notarize:** OS signing would let the macOS updater skip its own
  Gatekeeper caveats and unlock `SMAppService` start-at-login reliability.
  Cost is an Apple Developer account; decide before or after M3?
