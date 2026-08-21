// Live update feed for the simulator, backed by the real GitHub Releases API
// (the same endpoint the native auto-updaters follow — docs/auto-update-spec.md §5).
// The simulator pretends to be a 0.0.0 dev build so any published stable
// release demonstrates the update-available flow.

const REPO_API = 'https://api.github.com/repos/OffBy1-tech/Mouse-Flare/releases';
const RELEASES_PAGE = 'https://github.com/OffBy1-tech/Mouse-Flare/releases';

export interface ReleaseMetadata {
  version: string;
  releaseDate: string;
  channel: 'stable' | 'beta';
  title: string;
  changelog: string[];
  fileSizes: {
    windowsZip: string;
    macOSZip: string;
  };
  downloadUrls: {
    windows: string;
    macOS: string;
    checksums: string;
    releasePage: string;
  };
  minRequirements: {
    windows: string;
    macOS: string;
  };
}

export const CURRENT_BUILD_INFO = {
  version: '0.0.0',
  buildTag: 'web-simulator',
};

// Factual, release-independent requirements (mirrors the native READMEs)
const MIN_REQUIREMENTS = {
  windows: 'Windows 10 (Build 19041+) or Windows 11 with the .NET 8 Desktop Runtime',
  macOS: 'macOS 13.0 (Ventura) or later on Apple Silicon or Intel',
};

// Offline/demo fallback: a snapshot of the real v0.1.0 release
export const FALLBACK_RELEASE: ReleaseMetadata = {
  version: '0.1.0',
  releaseDate: 'August 19, 2026',
  channel: 'stable',
  title: 'Mouseflare v0.1.0',
  changelog: [
    'First stable release: 20 passive FX presets, 6 Find Mouse flares, 7 color palettes.',
    'Universal macOS app (Apple Silicon + Intel) and single-file Windows x64 build.',
    'Artifacts are minisign-signed and shipped with SHA-256 checksums.',
  ],
  fileSizes: { windowsZip: '0.7 MB', macOSZip: '0.7 MB' },
  downloadUrls: {
    windows: `${RELEASES_PAGE}/download/v0.1.0/Mouseflare-Windows.zip`,
    macOS: `${RELEASES_PAGE}/download/v0.1.0/Mouseflare-macOS.zip`,
    checksums: `${RELEASES_PAGE}/download/v0.1.0/SHA256SUMS.txt`,
    releasePage: `${RELEASES_PAGE}/tag/v0.1.0`,
  },
  minRequirements: MIN_REQUIREMENTS,
};

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  release: ReleaseMetadata;
  checkedAt: number;
  status: 'up-to-date' | 'update-available' | 'error';
  message: string;
}

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function findAsset(release: GitHubRelease, suffix: string): GitHubAsset | undefined {
  return release.assets.find((a) => a.name.endsWith(suffix) && !a.name.endsWith('.minisig'));
}

function extractBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // markdown links -> plain text
        .replace(/\*\*/g, '')
    );
}

function parseChangelog(body: string | null): string[] {
  if (!body) return [];
  // Prefer the "What's new" bullets (everything before the verification
  // boilerplate); fall back to any bullets in the whole body.
  const beforeVerify = body.split(/^## Verify your download$/m)[0];
  const preferred = extractBullets(beforeVerify);
  const bullets = preferred.length > 0 ? preferred : extractBullets(body);
  return bullets.slice(0, 8);
}

function toMetadata(release: GitHubRelease, channel: 'stable' | 'beta'): ReleaseMetadata {
  const windowsAsset = findAsset(release, 'Mouseflare-Windows.zip');
  const macAsset = findAsset(release, 'Mouseflare-macOS.zip');
  const checksums = release.assets.find((a) => a.name === 'SHA256SUMS.txt');
  const changelog = parseChangelog(release.body);
  return {
    version: release.tag_name.replace(/^v/, ''),
    releaseDate: release.published_at
      ? new Date(release.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'unpublished',
    channel,
    title: release.name || `Mouseflare ${release.tag_name}`,
    changelog: changelog.length > 0 ? changelog : ['See the release page for full notes.'],
    fileSizes: {
      windowsZip: windowsAsset ? formatSize(windowsAsset.size) : '—',
      macOSZip: macAsset ? formatSize(macAsset.size) : '—',
    },
    downloadUrls: {
      windows: windowsAsset?.browser_download_url ?? release.html_url,
      macOS: macAsset?.browser_download_url ?? release.html_url,
      checksums: checksums?.browser_download_url ?? release.html_url,
      releasePage: release.html_url,
    },
    minRequirements: MIN_REQUIREMENTS,
  };
}

/**
 * Compare two semver-ish strings like "0.1.0" vs "0.2.1".
 * Non-numeric versions (e.g. the rolling `latest` dev tag) compare as newer —
 * the dev channel always offers its build.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  if (!/^\d/.test(latest.replace(/^v/, ''))) return true;
  const parse = (v: string) => {
    const clean = v.replace(/^v/, '').split('-')[0];
    return clean.split('.').map((n) => parseInt(n, 10) || 0);
  };
  const [cMaj, cMin, cPatch] = parse(current);
  const [lMaj, lMin, lPatch] = parse(latest);

  if (lMaj > cMaj) return true;
  if (lMaj < cMaj) return false;
  if (lMin > cMin) return true;
  if (lMin < cMin) return false;
  return lPatch > cPatch;
}

// One in-flight/completed fetch per page load; the feed changes rarely and
// api.github.com allows 60 unauthenticated requests/hour.
let releaseCache: Promise<ReleaseMetadata> | null = null;

async function fetchRelease(): Promise<ReleaseMetadata> {
  if (releaseCache) return releaseCache;

  const promise = (async () => {
    const res = await fetch(`${REPO_API}/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return toMetadata((await res.json()) as GitHubRelease, 'stable');
  })().catch((err) => {
    releaseCache = null; // allow retry on the next manual check
    throw err;
  });

  releaseCache = promise;
  return promise;
}

/**
 * Checks the live GitHub Releases feed. Falls back to a static snapshot of
 * v0.1.0 when the network or API is unavailable, so the demo stays functional
 * offline.
 */
export async function checkNativeBuildUpdates(
  currentVersion: string = CURRENT_BUILD_INFO.version
): Promise<UpdateCheckResult> {
  let release: ReleaseMetadata;
  let errored = false;
  try {
    release = await fetchRelease();
  } catch {
    release = FALLBACK_RELEASE;
    errored = true;
  }

  const updateAvailable = isNewerVersion(currentVersion, release.version);
  return {
    hasUpdate: updateAvailable,
    currentVersion,
    latestVersion: release.version,
    release,
    checkedAt: Date.now(),
    status: errored ? 'error' : updateAvailable ? 'update-available' : 'up-to-date',
    message: errored
      ? `Could not reach the release feed — showing cached v${release.version} info.`
      : updateAvailable
        ? `A new version (v${release.version}) is available!`
        : `You are on the latest stable build (v${currentVersion}).`,
  };
}

export function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Never';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
