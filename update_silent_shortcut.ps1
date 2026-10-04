$vbsPath = "e:\SOFTWARE\Certificate Entry Management\Start_Certificate_Server_Silent.vbs"
$shortcutPath = "C:\Users\GATTU\Desktop\Certificate Entry Server.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$vbsPath`""
$Shortcut.WorkingDirectory = "e:\SOFTWARE\Certificate Entry Management"
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll, 13"
$Shortcut.Save()

Write-Host "✅ Silent Shortcut Updated Successfully!"
