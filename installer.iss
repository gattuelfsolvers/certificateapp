; -------------------------------------------------------------
; INNO SETUP SCRIPT FOR CERTIFICATE ENTRY MANAGEMENT
; Complete One-Click Windows Application Installer (.exe)
; Developed and Managed by : Gattu Computer Works
; -------------------------------------------------------------

#define MyAppName "CMS"
#define MyAppFullName "Certificate Management Software"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Gattu Computer Works"
#define MyAppURL "https://certificateapp.onrender.com"
#define MyAppExeName "Start_App.bat"

[Setup]
AppId={{5F792A61-4B96-41B0-9A74-CC291C7924F0}
AppName={#MyAppFullName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\Certificate-Local-Engine
DisableDirPage=yes
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=E:\SOFTWARE\Certificate Entry Management_NEW\installer_output
OutputBaseFilename=Certificate-Management-Setup-v2.0
SetupIconFile=E:\SOFTWARE\Certificate Entry Management_NEW\app_icon.ico
UninstallDisplayIcon={app}\app_icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=no

; Custom Branding Images
WizardImageFile=E:\SOFTWARE\Certificate Entry Management_NEW\wizard_sidebar.bmp
WizardSmallImageFile=E:\SOFTWARE\Certificate Entry Management_NEW\wizard_small.bmp

; Mandatory License / Terms & Conditions Page
LicenseFile=E:\SOFTWARE\Certificate Entry Management_NEW\terms_and_conditions.txt

[Messages]
WelcomeLabel1=Certificate Management Software
WelcomeLabel2=Developed and Managed by : Gattu Computer Works%n%nThis will install Certificate Management Software on your computer.%n%nIt is recommended that you close all other applications before continuing.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Copy all pre-packaged clean files and dependencies into target installation directory
Source: "C:\Certificate-Local-Engine-Standard\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "E:\SOFTWARE\Certificate Entry Management_NEW\app_icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\app_icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\app_icon.ico"; Tasks: desktopicon

[Run]
; Auto-launch software at the end of installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
