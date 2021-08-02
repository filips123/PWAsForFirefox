$ErrorActionPreference = "Stop";

$toolsPath = Split-Path $MyInvocation.MyCommand.Definition
$filePath32 = "$toolsPath\firefoxpwa-$($env:ChocolateyPackageVersion)-x86.msi"
$filePath64 = "$toolsPath\firefoxpwa-$($env:ChocolateyPackageVersion)-x86_64.msi"

$packageArgs = @{
    PackageName = "$($env:ChocolateyPackageName)"
    SoftwareName = "$($env:ChocolateyPackageTitle)"
    FileType = "msi"
    SilentArgs = "/quiet"
    File = $filePath32
    File64 = $filePath64
}

Install-ChocolateyInstallPackage @packageArgs
Remove-Item -Force $filePath32, $filePath64 -ea 0
