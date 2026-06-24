$ErrorActionPreference = "Stop"

$Repo = "shuijiao1/Kulin-Agent"
$Version = if ($env:KULIN_AGENT_VERSION) { $env:KULIN_AGENT_VERSION } else { "v0.1.1" }
$InstallDir = if ($env:KULIN_AGENT_INSTALL_DIR) { $env:KULIN_AGENT_INSTALL_DIR } else { "C:\Program Files\Kulin Agent" }
$ConfigFile = if ($env:KULIN_AGENT_CONFIG) { $env:KULIN_AGENT_CONFIG } else { Join-Path $InstallDir "config.yaml" }
$Bin = Join-Path $InstallDir "kulin-agent.exe"

$KulinServer = $env:KULIN_SERVER
$KulinClientSecret = $env:KULIN_CLIENT_SECRET
$KulinTls = if ($env:KULIN_TLS) { $env:KULIN_TLS } else { "true" }
$KulinUuid = if ($env:KULIN_UUID) { $env:KULIN_UUID } else { "" }

if (-not $KulinServer) { throw "必须设置 KULIN_SERVER" }
if (-not $KulinClientSecret) { throw "必须设置 KULIN_CLIENT_SECRET" }

$Arch = $env:PROCESSOR_ARCHITECTURE
switch -Regex ($Arch) {
    "AMD64" { $GoArch = "amd64"; break }
    "ARM64" { $GoArch = "arm64"; break }
    "86" { $GoArch = "386"; break }
    default { throw "暂不支持架构: $Arch" }
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ($Version -eq "latest") {
    $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $Release.tag_name
    if (-not $Version) { throw "无法获取最新版本" }
}

$Asset = "kulin-agent_windows_$GoArch.zip"
$Url = "https://github.com/$Repo/releases/download/$Version/$Asset"
$Tmp = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
try {
    $Zip = Join-Path $Tmp $Asset
    Write-Host "下载 Kulin Agent $Version (windows/$GoArch)..."
    Invoke-WebRequest $Url -OutFile $Zip
    Expand-Archive $Zip -DestinationPath $Tmp -Force
    $Found = Get-ChildItem $Tmp -Recurse -Filter "kulin-agent.exe" | Select-Object -First 1
    if (-not $Found) { throw "压缩包内未找到 kulin-agent.exe" }

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item $Found.FullName $Bin -Force

    @"
server: "$KulinServer"
client_secret: "$KulinClientSecret"
tls: $KulinTls
uuid: "$KulinUuid"
disable_auto_update: true
disable_force_update: true
disable_nat: true
disable_command_execute: true
report_delay: 2
ip_report_period: 1800
"@ | Set-Content -Path $ConfigFile -Encoding UTF8

    & $Bin service install -c $ConfigFile
    try {
        & $Bin service restart -c $ConfigFile
    } catch {
        & $Bin service start -c $ConfigFile
    }

    Write-Host "Kulin Agent 已安装并启动"
} finally {
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}
