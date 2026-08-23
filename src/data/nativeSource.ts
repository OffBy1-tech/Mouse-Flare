// The native desktop source bundled
// into the downloadable zips. Imported straight from src/native/** at build time
// via Vite glob imports, so the simulator can never drift from the real apps.

export interface CodeFile {
  name: string;
  language: string;
  platform: 'windows' | 'macos';
  path: string; // path relative to the platform folder, e.g. "UI/SettingsWindow.xaml"
  description: string;
  code: string;
}

export interface BinaryFile {
  platform: 'windows' | 'macos';
  path: string;
  url: string;
}

// Text sources (dot-directories like macos/.build are excluded by glob defaults)
const textModules = import.meta.glob(['../native/**', '!**/*.png', '!**/*.ico'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Binary assets (logo png/ico) — bundled as URLs, fetched at zip time
const binaryModules = import.meta.glob('../native/**/*.{png,ico}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const GLOB_PREFIX = '../native/';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  cs: 'csharp',
  xaml: 'xml',
  csproj: 'xml',
  swift: 'swift',
  sh: 'bash',
  bat: 'batch',
  ps1: 'powershell',
  md: 'markdown',
};

const DESCRIPTIONS: Record<string, string> = {
  'windows/App.xaml.cs': 'Application entry point wiring the overlay, settings window, mouse hook, and tray together.',
  'windows/App.xaml': 'WPF application definition and startup hook.',
  'windows/Mouseflare.csproj': '.NET 8 project file (WPF + WinForms tray, single-file publish, app icon).',
  'windows/build.bat': 'One-click build & launch script for Windows.',
  'windows/publish.ps1': 'PowerShell build script producing a standalone Mouseflare.exe.',
  'windows/README.md': 'Build and usage instructions for the native Windows app.',
  'windows/Core/MouseTracker.cs': 'Low-latency Win32 cursor tracking.',
  'windows/Core/HotkeyManager.cs': 'Global Find Mouse hotkey registration.',
  'windows/Tray/TrayIconManager.cs': 'System tray icon, context menu, and logo loading.',
  'windows/UI/TransparentOverlayWindow.cs': 'Click-through overlay rendering all passive FX presets and flare animations.',
  'windows/UI/SettingsWindow.xaml': 'Settings & FX Studio window layout (sidebar navigation, preset cards, sliders).',
  'windows/UI/SettingsWindow.xaml.cs': 'Settings window behavior: preset selection, colors, sliders, and live apply.',
  'macos/Package.swift': 'Swift Package Manager manifest (macOS 13+, bundled logo resource).',
  'macos/build.sh': 'One-step build & launch script for macOS.',
  'macos/README.md': 'Build and usage instructions for the native macOS app.',
  'macos/Sources/main.swift': 'Executable entry point.',
  'macos/Sources/AppDelegate.swift': 'Menu bar agent: overlays, hotkeys, shake-to-find, monitor-crossing pulse.',
  'macos/Sources/MouseTracker.swift': '120Hz cursor tracking via NSEvent monitors and polling.',
  'macos/Sources/OverlayView.swift': 'Click-through overlay rendering all passive FX presets and flare animations.',
  'macos/Sources/SettingsManager.swift': 'Persisted settings model shared with the Windows build.',
  'macos/Sources/SettingsWindowController.swift': 'Settings & FX Studio window (sidebar navigation, preset cards, sliders).',
};

function toCodeFile(globKey: string, code: string): CodeFile | null {
  const rel = globKey.slice(GLOB_PREFIX.length);
  const platform = rel.startsWith('windows/') ? 'windows' : rel.startsWith('macos/') ? 'macos' : null;
  if (!platform) return null;
  const path = rel.slice(platform.length + 1);
  const name = path.split('/').pop() ?? path;
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return {
    name,
    language: LANGUAGE_BY_EXTENSION[extension] ?? 'text',
    platform,
    path,
    description: DESCRIPTIONS[rel] ?? `Part of the native ${platform === 'windows' ? 'Windows' : 'macOS'} source.`,
    code,
  };
}

export const NATIVE_SOURCE_FILES: CodeFile[] = Object.entries(textModules)
  .map(([key, code]) => toCodeFile(key, code))
  .filter((f): f is CodeFile => f !== null)
  .sort((a, b) => (a.platform === b.platform ? a.path.localeCompare(b.path) : a.platform === 'windows' ? -1 : 1));

export const NATIVE_BINARY_FILES: BinaryFile[] = Object.entries(binaryModules).flatMap(([key, url]) => {
  const rel = key.slice(GLOB_PREFIX.length);
  const platform = rel.startsWith('windows/') ? 'windows' : rel.startsWith('macos/') ? 'macos' : null;
  if (!platform) return [];
  return [{ platform, path: rel.slice(platform.length + 1), url }] as BinaryFile[];
});
