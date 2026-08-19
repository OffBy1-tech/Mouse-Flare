import JSZip from 'jszip';
import { NATIVE_SOURCE_FILES, NATIVE_BINARY_FILES } from '../data/nativeSource';

// Zips are assembled from the real src/native/** sources (see data/nativeSource.ts),
// so downloads always match the code in the repository.

async function addPlatformFiles(folder: JSZip, platform: 'windows' | 'macos'): Promise<void> {
  for (const file of NATIVE_SOURCE_FILES) {
    if (file.platform === platform) {
      folder.file(file.path, file.code);
    }
  }
  for (const binary of NATIVE_BINARY_FILES) {
    if (binary.platform === platform) {
      const blob = await (await fetch(binary.url)).blob();
      folder.file(binary.path, blob);
    }
  }
}

export async function downloadWindowsNativeZip(): Promise<void> {
  const zip = new JSZip();
  await addPlatformFiles(zip, 'windows');
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(blob, 'Mouseflare-Windows-Native.zip');
}

export async function downloadMacNativeZip(): Promise<void> {
  const zip = new JSZip();
  await addPlatformFiles(zip, 'macos');
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(blob, 'Mouseflare-macOS-Native.zip');
}

export async function downloadCrossPlatformZip(): Promise<void> {
  const zip = new JSZip();

  const winFolder = zip.folder('windows');
  if (winFolder) await addPlatformFiles(winFolder, 'windows');

  const macFolder = zip.folder('macos');
  if (macFolder) await addPlatformFiles(macFolder, 'macos');

  zip.file(
    'README.md',
    `# Mouseflare — Native Desktop Utilities (Windows & macOS)

This package contains the complete standalone native desktop source code for both Windows and macOS.

- **Windows**: Open the \`windows/\` folder and double-click \`build.bat\` (.NET 8 WPF).
- **macOS**: Open Terminal in \`macos/\` and run \`./build.sh\` (Swift / AppKit).
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(blob, 'Mouseflare-Desktop-CrossPlatform.zip');
}

export async function downloadNativeSourceZip(): Promise<void> {
  return downloadWindowsNativeZip();
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
