export interface ReleaseMetadata {
  version: string;
  releaseDate: string;
  channel: 'stable' | 'beta';
  title: string;
  summary: string;
  changelog: string[];
  highlights: {
    icon: string;
    title: string;
    desc: string;
  }[];
  fileSizes: {
    windowsZip: string;
    macOSZip: string;
    universalZip: string;
  };
  minRequirements: {
    windows: string;
    macOS: string;
  };
  downloadUrls: {
    windows: string;
    macOS: string;
    universal: string;
  };
  sha256Checksums: {
    windows: string;
    macOS: string;
    universal: string;
  };
}

export const CURRENT_BUILD_INFO = {
  version: '2.4.0',
  buildTag: '2026.08-r1',
  releaseDate: 'August 18, 2026',
  architecture: 'Universal (ARM64 Apple Silicon + Intel x86_64 / Windows x64)',
  engine: 'Mouseflare Fluid Physics Core v2.4',
  frameworks: '.NET 8 / WPF (Win32) & AppKit (macOS 13+)',
};

export const LATEST_RELEASE_STABLE: ReleaseMetadata = {
  version: '2.5.2',
  releaseDate: 'August 18, 2026',
  channel: 'stable',
  title: 'Fluid Dynamics Simulation & Rock-Solid AppKit Memory Architecture',
  summary: 'Major release introducing GPU-grade velocity dissipation fluid simulation, AppKit non-destructive window lifecycle (eliminating SIGSEGV on macOS 14+), and ultra-smooth 120Hz adaptive hardware cursor tracking.',
  changelog: [
    '🌊 Fluid Particle Simulation: Integrated real-time vorticity curl, dissipation physics, and luminescent dye blending.',
    '🍏 macOS AppKit Stability: Fixed transform animation dealloc crash by establishing permanent floating window lifecycles.',
    '⚡ 120Hz Micro-Polling: Sub-millisecond cursor trajectory smoothing to eliminate jagged trails during rapid flicks.',
    '🖥️ Multi-Display Auto-Healing: Dynamic screen geometry listener rebuilds transparent viewports instantly when monitors are plugged in.',
    '🎯 Idle Sleep Re-anchoring: Zero-delta baseline clamp prevents erratic particle explosions when waking displays from sleep.',
    '⚙️ Preferences & FX Studio: Real-time slider sync for vorticity, trail duration, particle scale, and density.'
  ],
  highlights: [
    {
      icon: '🌊',
      title: 'Fluid Physics Parity',
      desc: 'Mimics Pavel DoGreat fluid dynamics with velocity-based dissipation on both Windows & macOS.'
    },
    {
      icon: '🛡️',
      title: 'Crash-Safe macOS Build',
      desc: 'Pure ARC memory retention preventing transform animation double-free errors.'
    },
    {
      icon: '⚡',
      title: '120Hz Hardware Polling',
      desc: 'Seamless dual-channel NSEvent/Win32 GetCursorPos polling for high-refresh gaming displays.'
    }
  ],
  fileSizes: {
    windowsZip: '1.4 MB',
    macOSZip: '1.2 MB',
    universalZip: '2.5 MB'
  },
  minRequirements: {
    windows: 'Windows 10 (Build 19041+) or Windows 11 with .NET 8.0 SDK / Runtime',
    macOS: 'macOS 13.0 (Ventura), macOS 14 (Sonoma), macOS 15+ (Sequoia) on Apple Silicon or Intel'
  },
  downloadUrls: {
    windows: 'mouseflare-windows-v2.5.2.zip',
    macOS: 'mouseflare-macos-v2.5.2.zip',
    universal: 'mouseflare-universal-v2.5.2.zip'
  },
  sha256Checksums: {
    windows: 'e7b9c14a2f88301d09e53ca8379201947bca82104938a1928374619283746123',
    macOS: 'a910bf837c019284719283746192837492837461928374619283746192837461',
    universal: 'c381928374619283746192837461928374619283746192837461928374619283'
  }
};

export const LATEST_RELEASE_BETA: ReleaseMetadata = {
  version: '2.6.0-beta.1',
  releaseDate: 'August 19, 2026',
  channel: 'beta',
  title: 'Vulkan / Metal Compute Shader Acceleration (Preview)',
  summary: 'Experimental preview featuring GPU compute shader particle dispatch and live audio-reactive reactive frequency pulse detection.',
  changelog: [
    '🧪 GPU Compute Pipelines: Experimental Metal Compute / DirectCompute particle buffers for up to 10,000 active flares.',
    '🎵 Audio Reactive Flares: Microphone peak and frequency analysis modulating flare radius during meetings or gaming.',
    '🎨 Custom GLSL / Metal Shader Preset Loader for user-authored visual scripts.'
  ],
  highlights: [
    {
      icon: '🧪',
      title: 'Compute Shaders',
      desc: '10x particle density with zero CPU overhead.'
    },
    {
      icon: '🎵',
      title: 'Audio Pulse',
      desc: 'Real-time reactive visual pulses synced to system audio.'
    }
  ],
  fileSizes: {
    windowsZip: '1.8 MB',
    macOSZip: '1.5 MB',
    universalZip: '3.1 MB'
  },
  minRequirements: {
    windows: 'Windows 11 with DirectX 12 / DirectCompute support',
    macOS: 'macOS 14+ with Apple Silicon (M1/M2/M3/M4)'
  },
  downloadUrls: {
    windows: 'mouseflare-windows-v2.6.0-beta.zip',
    macOS: 'mouseflare-macos-v2.6.0-beta.zip',
    universal: 'mouseflare-universal-v2.6.0-beta.zip'
  },
  sha256Checksums: {
    windows: 'b182736451928374619283746192837461928374619283746192837461928374',
    macOS: 'f928374619283746192837461928374619283746192837461928374619283746',
    universal: '8374619283746192837461928374619283746192837461928374619283746192'
  }
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

/**
 * Compare two semver strings like "2.4.0" vs "2.5.2"
 */
export function isNewerVersion(current: string, latest: string): boolean {
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

/**
 * Checks for updates against release metadata
 */
export async function checkNativeBuildUpdates(
  currentVersion: string = CURRENT_BUILD_INFO.version,
  channel: 'stable' | 'beta' = 'stable'
): Promise<UpdateCheckResult> {
  // Simulate network metadata check with realistic delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  const targetRelease = channel === 'beta' ? LATEST_RELEASE_BETA : LATEST_RELEASE_STABLE;
  const updateAvailable = isNewerVersion(currentVersion, targetRelease.version);

  return {
    hasUpdate: updateAvailable,
    currentVersion,
    latestVersion: targetRelease.version,
    release: targetRelease,
    checkedAt: Date.now(),
    status: updateAvailable ? 'update-available' : 'up-to-date',
    message: updateAvailable
      ? `A new version (v${targetRelease.version}) is available!`
      : `You are on the latest ${channel} build (v${currentVersion}).`
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
