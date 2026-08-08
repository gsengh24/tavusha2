$xlsxPath = "c:\Users\Gaganjot Singh\.gemini\antigravity-ide\scratch\tavusha2\website inventory.xlsx"
$tempDir = "c:\Users\Gaganjot Singh\.gemini\antigravity-ide\scratch\tavusha2\temp_xlsx"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $tempDir)
Get-ChildItem $tempDir -Recurse | Select-Object FullName
