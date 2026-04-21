param(
  [ValidateSet("Auto", "Edge", "Chrome")]
  [string]$Browser = "Auto"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$indexPath = (Resolve-Path (Join-Path $projectRoot "index.html")).Path
$fileUri = "file:///" + (($indexPath -replace "\\", "/") -replace "^([A-Za-z]):", '$1:')

$browserCandidates = @()
switch ($Browser) {
  "Edge" {
    $browserCandidates += @{
      Name = "Edge"
      Path = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    }
  }
  "Chrome" {
    $browserCandidates += @{
      Name = "Chrome"
      Path = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    }
  }
  default {
    $browserCandidates += @{
      Name = "Edge"
      Path = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    }
    $browserCandidates += @{
      Name = "Chrome"
      Path = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    }
  }
}

foreach ($candidate in $browserCandidates) {
  if (-not (Test-Path $candidate.Path)) {
    continue
  }
  $launchArgs = @(
    "--allow-file-access-from-files",
    "--disable-features=RendererCodeIntegrity",
    "--no-first-run",
    "--no-default-browser-check",
    $fileUri
  )
  try {
    $process = Start-Process -FilePath $candidate.Path -ArgumentList $launchArgs -PassThru
    Start-Sleep -Milliseconds 2500
    if (-not $process.HasExited) {
      Write-Output "Opened viewer in $($candidate.Name): $fileUri"
      exit 0
    }
    Write-Warning "$($candidate.Name) exited immediately. Trying next browser if available."
  } catch {
    Write-Warning "Failed to launch $($candidate.Name): $($_.Exception.Message)"
  }
}

throw "Failed to launch the viewer in any supported browser."
