@echo off
rem Alpotech Klinik kurulumu: cift tiklayin. Masaustune simge koyar ve paneli acar.
rem Bu dosyanin alt kismi PowerShell kodudur; tek dosya olarak kopyalanabilir.
set "KURULUM_DOSYASI=%~f0"
set "KURULUM_ADRES=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$k = [IO.File]::ReadAllText($env:KURULUM_DOSYASI, [Text.Encoding]::UTF8); iex (($k -split '\r?\n:POWERSHELL\r?\n', 2)[1])"
exit /b
:POWERSHELL
$ErrorActionPreference = "Stop"
$VarsayilanAdres = "192.168.1.41:8091"   # sunucunun şimdiki adresi; klinikte sabit IP verilince değişecek

function Dur([string]$mesaj) {
    Write-Host ""
    Write-Host $mesaj -ForegroundColor Red
    Read-Host "Kapatmak için Enter'a basın" | Out-Null
    exit 1
}

$klasor = Join-Path $env:LOCALAPPDATA "AlpotechKlinik"
New-Item -ItemType Directory -Force $klasor | Out-Null
$kayitliAdres = Join-Path $klasor "adres.txt"
if (Test-Path $kayitliAdres) { $VarsayilanAdres = (Get-Content $kayitliAdres -Raw).Trim() }

Write-Host "=== Alpotech Klinik kurulumu ===" -ForegroundColor Cyan
$Adres = $env:KURULUM_ADRES
if (-not $Adres) {
    Write-Host "Sunucu adresi: $VarsayilanAdres"
    $Adres = Read-Host "Doğruysa Enter'a basın, değiştiyse yeni adresi yazın"
    if (-not $Adres) { $Adres = $VarsayilanAdres }
}
$Adres = $Adres.Trim().TrimEnd("/")
if ($Adres -notmatch "^https?://") { $Adres = "http://$Adres" }
if ($Adres -notmatch "^https?://[^/\s]+$") { Dur "Adres anlaşılamadı: $Adres" }
$PanelAdresi = "$Adres/"

# Sunucu cevap veriyor mu? Logoyu da simge yapmak için buradan alıyoruz.
Write-Host "Sunucuya bağlanılıyor: $PanelAdresi"
$logo = Join-Path $klasor "logo.png"
try {
    Invoke-WebRequest -Uri "$Adres/logo.png" -OutFile $logo -UseBasicParsing -TimeoutSec 10
} catch {
    Dur ("Sunucuya ulaşılamadı: $PanelAdresi`n" +
         "- Bilgisayar kliniğin modemine (Wi-Fi ya da kablo) bağlı mı?`n" +
         "- Sunucu açık mı?`n" +
         "- Adres değiştiyse bu dosyayı yeniden çalıştırıp yeni adresi yazın.")
}
Set-Content -Path $kayitliAdres -Value ($Adres -replace "^https?://", "") -Encoding ASCII

# logo.png -> klinik.ico (256x256, PNG içeren ICO; Windows Vista ve sonrası destekler)
Add-Type -AssemblyName System.Drawing
$ikon = Join-Path $klasor "klinik.ico"
$kaynak = [System.Drawing.Image]::FromFile($logo)
$kare = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($kare)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$oran = [Math]::Min(256 / $kaynak.Width, 256 / $kaynak.Height)
$w = [int]($kaynak.Width * $oran); $h = [int]($kaynak.Height * $oran)
$g.DrawImage($kaynak, [int]((256 - $w) / 2), [int]((256 - $h) / 2), $w, $h)
$g.Dispose(); $kaynak.Dispose()
$ms = New-Object System.IO.MemoryStream
$kare.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$kare.Dispose()
$png = $ms.ToArray()
$fs = [System.IO.File]::Create($ikon)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
$bw.Write($png)
$bw.Close()

# Tarayıcı: Edge (Windows 10/11'de hazır gelir), yoksa Chrome
$tarayici = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $tarayici) { Dur "Edge ya da Chrome bulunamadı." }
$argumanlar = "--app=$PanelAdresi --start-maximized"

$kisayol = Join-Path ([Environment]::GetFolderPath("Desktop")) "Alpotech Klinik.lnk"
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($kisayol)
$lnk.TargetPath = $tarayici
$lnk.Arguments = $argumanlar
$lnk.IconLocation = "$ikon,0"
$lnk.Description = "Alpotech Klinik paneli ($PanelAdresi)"
$lnk.Save()
Copy-Item $kisayol (Join-Path ([Environment]::GetFolderPath("Programs")) "Alpotech Klinik.lnk") -Force

Write-Host ""
Write-Host "Tamam. Masaüstüne 'Alpotech Klinik' simgesi kondu; panel şimdi açılıyor." -ForegroundColor Green
Write-Host "Bundan sonra masaüstündeki simgeye tıklamanız yeterli."
if (-not $env:KURULUM_PANELI_ACMA) { Start-Process -FilePath $tarayici -ArgumentList $argumanlar }
Start-Sleep -Seconds 4
