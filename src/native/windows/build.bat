@echo off
setlocal
echo ========================================================
echo        Building Mouseflare for Windows (Native)
echo ========================================================
echo.

where dotnet >nul 2>nul
if %errorlevel% neq 0 (
    echo [.NET 8 SDK Missing]
    echo Please install the free .NET 8 SDK from: https://dotnet.microsoft.com/download
    echo After installing, run this build.bat file again.
    pause
    exit /b 1
)

echo Restoring and Compiling Standalone Single-File Windows Binary...
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o publish

if %errorlevel% neq 0 goto :BUILD_FAILED

echo.
echo ========================================================
echo  SUCCESS! Mouseflare.exe generated in:
echo  %~dp0publish\Mouseflare.exe
echo ========================================================
echo Launching Mouseflare System Tray Utility...
start "" "%~dp0publish\Mouseflare.exe"
goto :END

:BUILD_FAILED
echo.
echo Build failed. Check the error messages above.

:END
pause
