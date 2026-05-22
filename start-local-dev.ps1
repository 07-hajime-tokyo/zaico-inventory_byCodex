$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot
$env:COREPACK_HOME = Join-Path $PSScriptRoot ".corepack"

& corepack pnpm run dev *> (Join-Path $PSScriptRoot "dev-server.current.log")
