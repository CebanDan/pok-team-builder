$ErrorActionPreference = "Stop"

param(
  [string]$IpAddress = ""
)

function Get-PrimaryLanIp {
  try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Select-Object -ExpandProperty IPAddress

    if ($candidates -and $candidates.Count -gt 0) {
      return $candidates[0]
    }
  } catch {
    return ""
  }
  return ""
}

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  Write-Error "mkcert is required. Install from https://github.com/FiloSottile/mkcert and run again."
  exit 1
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$certDir = Join-Path $projectRoot ".cert"
New-Item -ItemType Directory -Path $certDir -Force | Out-Null

$lanIp = if ([string]::IsNullOrWhiteSpace($IpAddress)) { Get-PrimaryLanIp } else { $IpAddress.Trim() }
$subjects = @("localhost", "127.0.0.1", "::1")
if (-not [string]::IsNullOrWhiteSpace($lanIp)) {
  $subjects += $lanIp
}

$certPath = Join-Path $certDir "dev-cert.pem"
$keyPath = Join-Path $certDir "dev-key.pem"

Write-Host "Installing local CA (if needed)..."
mkcert -install | Out-Host

Write-Host "Generating certificate for: $($subjects -join ", ")"
mkcert -cert-file $certPath -key-file $keyPath @subjects | Out-Host

Write-Host ""
Write-Host "Created:"
Write-Host "  $certPath"
Write-Host "  $keyPath"
Write-Host ""
Write-Host "Run: npm run dev:secure"

