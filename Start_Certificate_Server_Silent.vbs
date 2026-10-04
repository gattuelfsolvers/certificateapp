Set WshShell = CreateObject("WScript.Shell")

' 1. Start Backend in completely hidden background (0 = Hidden window)
WshShell.Run "cmd /c ""cd /d e:\SOFTWARE\Certificate Entry Management\backend && node src/server.js""", 0, False

' 2. Start Frontend in completely hidden background (0 = Hidden window)
WshShell.Run "cmd /c ""cd /d e:\SOFTWARE\Certificate Entry Management\frontend && npm run dev""", 0, False

' Wait 5 seconds for servers to initialize
WScript.Sleep 5000

' 3. Open Google Chrome with Software Page
WshShell.Run "chrome ""http://localhost:3001""", 1, False

' 4. Show Windows Welcome Popup Message
MsgBox "🎉 आपका Server सफलतापूर्वक चालू हो गया है!" & vbCrLf & vbCrLf & "SOFTWARE Web App Chrome में खुल चुका है।", 64 + 4096, "अपना डिजिटल हब - Server Ready"
