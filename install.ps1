# ==============================================================================
# CodeNav 1-Liner Installer for Windows (PowerShell)
# Repository: https://github.com/djoo-lgcns/code-nav
# Usage:
#   irm https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.ps1 | iex
# ==============================================================================

$ErrorActionPreference = "Stop"

$Repo = "djoo-lgcns/code-nav"
$InstallDir = "$env:USERPROFILE\.local\bin"
$BinaryName = "code-nav.exe"
$TargetPath = Join-Path $InstallDir $BinaryName

Write-Host "🚀 Installing CodeNav for Windows..." -ForegroundColor Cyan

# 1. Create directory if not exists
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Download code-nav.exe from GitHub Releases
$ReleaseUrl = "https://github.com/$Repo/releases/latest/download/code-nav-windows-x64.exe"

Write-Host "📥 Downloading code-nav.exe from $ReleaseUrl..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $TargetPath -UseBasicParsing
} catch {
    Write-Warning "Could not download remote release. If you are developing locally, please ensure dist/code-nav.exe exists."
}

# 3. Check and install ast-grep for Windows if missing
if (-not (Get-Command "ast-grep" -ErrorAction SilentlyContinue)) {
    Write-Host "📦 ast-grep not found. Installing standalone ast-grep for Windows..." -ForegroundColor Yellow
    $SgZipUrl = "https://github.com/ast-grep/ast-grep/releases/latest/download/ast-grep-x86_64-pc-windows-msvc.zip"
    $ZipPath = Join-Path $InstallDir "ast-grep.zip"
    try {
        Invoke-WebRequest -Uri $SgZipUrl -OutFile $ZipPath -UseBasicParsing
        Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
        Remove-Item $ZipPath -Force
        Write-Host "✅ ast-grep installed to $InstallDir\ast-grep.exe" -ForegroundColor Green
    } catch {
        Write-Warning "Could not auto-download ast-grep. You can install it manually via: npm install -g @ast-grep/cli or cargo install ast-grep"
    }
}

# 4. Add to User PATH if not present
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -split ';' -notcontains $InstallDir) {
    Write-Host "⚙️ Adding $InstallDir to User PATH..." -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$InstallDir", "User")
    $env:Path += ";$InstallDir"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🎉 CodeNav installed successfully!" -ForegroundColor Green
Write-Host "   Binary location: $TargetPath" -ForegroundColor Gray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "👉 Quick Start (CLI):" -ForegroundColor White
Write-Host "   code-nav def <Symbol> [path]" -ForegroundColor Gray
Write-Host "   code-nav outline <filePath>" -ForegroundColor Gray
Write-Host ""
Write-Host "👉 Quick Start (MCP in AI Agents):" -ForegroundColor White
Write-Host "   Claude Code:   claude mcp add code-nav -- $TargetPath --mcp" -ForegroundColor Gray
Write-Host "   Kiro CLI:      kiro-cli mcp add code-nav -- $TargetPath --mcp" -ForegroundColor Gray
Write-Host "   Antigravity:   Add code-nav with command '$TargetPath' and args ['--mcp']" -ForegroundColor Gray
Write-Host ""
