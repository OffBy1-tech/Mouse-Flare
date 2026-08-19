# Mouseflare Automated Windows 11 Build Script
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Building Mouseflare Native Windows App          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: .NET 8 SDK not found." -ForegroundColor Red
    Write-Host "Please install .NET 8 from https://dotnet.microsoft.com/download"
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "Compiling Windows Tray & Direct2D Overlay Utility..." -ForegroundColor Green
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o ./publish

if ($LASTEXITCODE -eq 0) {
    Write-Host "BUILD SUCCESSFUL! Mouseflare.exe ready in ./publish/Mouseflare.exe" -ForegroundColor Green
    Start-Process "./publish/Mouseflare.exe"
} else {
    Write-Host "Build failed. Please verify .NET 8 SDK installation." -ForegroundColor Red
}
