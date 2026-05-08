$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\LENS.lnk")
$Shortcut.TargetPath = "E:\claude test file\photography-tauri\src-tauri\target\release\photography-tauri.exe"
$Shortcut.WorkingDirectory = "E:\claude test file\photography-tauri\src-tauri\target\release"
$Shortcut.Save()
Write-Output "Shortcut updated to: E:\claude test file\photography-tauri\src-tauri\target\release\photography-tauri.exe"
