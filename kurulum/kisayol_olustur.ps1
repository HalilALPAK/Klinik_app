# Alpotech Klinik masaüstü kısayolu
# Klinikteki her bilgisayarda bir kez çalıştırılır. Masaüstüne "Alpotech Klinik"
# simgesi koyar; tıklanınca panel adres çubuğu olmayan ayrı bir pencerede açılır.
# Sunucu adresi koda gömülmez, çalıştırırken sorulur (örnek: 192.168.1.10:8091).

param([string]$Adres)

$ErrorActionPreference = "Stop"

function Dur([string]$mesaj) {
    Write-Host ""
    Write-Host $mesaj -ForegroundColor Red
    Read-Host "Kapatmak için Enter'a basın" | Out-Null
    exit 1
}

if (-not $Adres) {
    Write-Host "Sunucunun adresini yazın (örnek: 192.168.1.10:8091)"
    $Adres = Read-Host "Adres"
}
$Adres = $Adres.Trim().TrimEnd("/")
if ($Adres -notmatch "^https?://") { $Adres = "http://$Adres" }
if ($Adres -notmatch "^https?://[^/\s]+$") { Dur "Adres anlaşılamadı: $Adres" }
$PanelAdresi = "$Adres/"

# Sunucu cevap veriyor mu? Logoyu da simge yapmak için buradan alıyoruz.
$klasor = Join-Path $env:LOCALAPPDATA "AlpotechKlinik"
New-Item -ItemType Directory -Force $klasor | Out-Null
$logo = Join-Path $klasor "logo.png"
try {
    Invoke-WebRequest -Uri "$Adres/logo.png" -OutFile $logo -UseBasicParsing -TimeoutSec 10
} catch {
    $yerelLogo = Join-Path $PSScriptRoot "..\logo.png"
    if (Test-Path $yerelLogo) {
        Write-Host "Uyarı: Sunucuya şu an ulaşılamadı ($Adres). Kısayol yine de oluşturuluyor." -ForegroundColor Yellow
        Copy-Item $yerelLogo $logo -Force
    } else {
        Dur "Sunucuya ulaşılamadı: $Adres`nSunucunun açık olduğunu ve adresin doğru olduğunu kontrol edin."
    }
}

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
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)      # başlık: ICO, 1 resim
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)  # 256x256, renk paleti yok
$bw.Write([UInt16]1); $bw.Write([UInt16]32)                           # düzlem, bit derinliği
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)                 # boyut, veri başlangıcı
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

$masaustu = [Environment]::GetFolderPath("Desktop")
$kisayol = Join-Path $masaustu "Alpotech Klinik.lnk"
$kabuk = New-Object -ComObject WScript.Shell
$lnk = $kabuk.CreateShortcut($kisayol)
$lnk.TargetPath = $tarayici
$lnk.Arguments = "--app=$PanelAdresi --start-maximized"
$lnk.IconLocation = "$ikon,0"
$lnk.Description = "Alpotech Klinik paneli ($PanelAdresi)"
$lnk.Save()

# Başlat menüsüne de koy (görev çubuğuna sabitlemek için)
$baslat = Join-Path ([Environment]::GetFolderPath("Programs")) "Alpotech Klinik.lnk"
Copy-Item $kisayol $baslat -Force

Write-Host ""
Write-Host "Tamam. Masaüstünde 'Alpotech Klinik' simgesi oluşturuldu." -ForegroundColor Green
Write-Host "Panel adresi: $PanelAdresi"
Write-Host "İsterseniz simgeye sağ tıklayıp 'Görev çubuğuna sabitle' diyebilirsiniz."
Read-Host "Kapatmak için Enter'a basın" | Out-Null
