# Mouseflare — Native macOS Menu Bar Application

Mouseflare for macOS is a lightweight status bar utility built in pure Swift and AppKit. It creates a transparent click-through floating overlay across all connected Mac displays and tracks your cursor in real time.

## 🚀 How to Run Natively on macOS

### 1. Requirements
- macOS 13.0 (Ventura) or later (Apple Silicon or Intel)
- Xcode Command Line Tools (`xcode-select --install` in Terminal)

### 2. Build & Launch in 1 Step
1. Open Terminal in the extracted folder.
2. Run:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```
3. Mouseflare compiles with Swift Package Manager, applies local code signature, and starts the Menu Bar agent with live terminal logs.

### 3. Usage & Features
- **Menu Bar**: Look for the **✨** icon in the top right menu bar. Click it to trigger Find Mouse, open **Settings & FX Studio**, or toggle effects.
- **Settings & FX Studio**: A full dark-themed settings window (matching the Windows build) with sidebar navigation — General, FX Studio, Behavior & Monitors, and Diagnostics. Pick from 20 passive trail presets, 6 Find Mouse flare animations, 7 color palettes (plus custom hex), and tune physics sliders live. Launch with `Mouseflare --settings` to open it directly.
- **Global Hotkey**: Press **`⌘ + Shift + F`** (configurable: `⌃ + Space`, `⌥ + M`, or `F1`) from any application to blast a beacon shockwave directly at your cursor.
- **Auto-Update**: Versioned builds quietly check GitHub Releases every 6 hours (toggle in Settings → General) and offer one-click, minisign-verified updates from the menu bar ("Check for Updates…"). Dev builds built from source never self-update. `Mouseflare --verify <file> <file.minisig>` checks any download against the release key.
- **Immediate Tracking**: The engine tracks your cursor via ultra-low-latency 120Hz polling alongside native AppKit event monitors without needing complex terminal permissions.

---

## 🔏 Release Signing & Notarization

`build.sh` ad-hoc signs for local runs — that never leaves your machine and
needs no Apple account. Release builds (`.github/workflows/release-build.yml`)
sign with a **Developer ID Application** certificate and notarize with Apple,
which is what lets a downloaded Mouseflare.app open without the quarantine
dance.

Signing degrades gracefully: with none of the secrets below configured, the
workflow ad-hoc signs exactly as before and the release notes keep the
`xattr -dr com.apple.quarantine` instructions. Nothing breaks on forks.

### Required repository secrets

| Secret | What it is |
| :--- | :--- |
| `MACOS_CERT_P12` | Developer ID Application identity (cert + private key) exported from Keychain Access as `.p12`, then base64-encoded: `base64 -i cert.p12 \| pbcopy` |
| `MACOS_CERT_PASSWORD` | The password set when exporting that `.p12` |
| `MACOS_NOTARY_KEY_P8` | App Store Connect API key (`.p8`), base64-encoded. App Store Connect → Users and Access → Integrations → App Store Connect API, **Developer** role. Downloadable exactly once |
| `MACOS_NOTARY_KEY_ID` | That key's Key ID |
| `MACOS_NOTARY_ISSUER_ID` | The team's Issuer ID, shown above the key list |

With only the first two set, the app is Developer ID signed but not notarized
(still quarantined) — the release notes say so. All five gets full
notarization plus a stapled ticket.

### Notes for whoever holds the certificate

- Developer ID certificates are valid 5 years, and a team is allowed only a
  **limited number of them, ever**. Back up the `.p12` and its password
  somewhere durable — losing the private key burns one of the slots.
- Only the Account Holder can create Developer ID certificates and App Store
  Connect API keys.
- The certificate's common name is what users see in the Gatekeeper dialog
  (`Developer ID Application: <name> (<TEAMID>)`).
- Hardened runtime is on (`--options runtime`) with **no entitlements file**:
  the app is unsandboxed, and Accessibility (`AXIsProcessTrustedWithOptions`)
  is a TCC grant rather than an entitlement. Adding a sandbox or a nested
  helper binary would change that.
- The first Developer ID build changes the app's code identity, so existing
  users re-grant Accessibility once. After that the identity is stable across
  updates, which also makes `SMAppService` start-at-login reliable.
