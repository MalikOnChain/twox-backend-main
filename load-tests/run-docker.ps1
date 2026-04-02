# Run k6 via Docker (no local k6 install). From backend-main/:
#   .\load-tests\run-docker.ps1 smoke
#   .\load-tests\run-docker.ps1 webhook
param(
  [Parameter(Position = 0)]
  [ValidateSet('smoke', 'webhook', 'mixed', 'crypto-read', 'auth-config')]
  [string] $Scenario = 'smoke',
  [string] $BaseUrl = 'http://host.docker.internal:5000'
)

$script = switch ($Scenario) {
  'smoke' { '/load-tests/k6/smoke.js' }
  'webhook' { '/load-tests/k6/fystack-webhook-pending.js' }
  'mixed' { '/load-tests/k6/fystack-webhook-mixed.js' }
  'crypto-read' { '/load-tests/k6/crypto-public-read.js' }
  'auth-config' { '/load-tests/k6/authenticated-withdraw-config.js' }
}

$here = $PSScriptRoot
$root = Split-Path -Parent $here

if ($Scenario -eq 'auth-config' -and -not $env:JWT_TOKEN) {
  Write-Error 'Set JWT_TOKEN environment variable for auth-config scenario.'
  exit 1
}

docker run --rm -i `
  -e BASE_URL=$BaseUrl `
  -e JWT_TOKEN=$env:JWT_TOKEN `
  -v "${root}/load-tests:/load-tests" `
  grafana/k6:latest run $script
