$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\LENS.lnk")
Write-Output "Target: $($Shortcut.TargetPath)"
