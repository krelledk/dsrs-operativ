param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\dist')
)

Add-Type -AssemblyName System.Drawing

function New-DsrsIcon {
  param(
    [int]$Size,
    [string]$FileName,
    [switch]$Maskable
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(7, 18, 31))

  $scale = $Size / 512.0
  $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 242, 235))
  $red = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(216, 32, 47))

  if ($Maskable) {
    $graphics.FillRectangle($background, 0, 0, $Size, $Size)
  } else {
    $radius = [single](116 * $scale)
    $diameter = [single](2 * $radius)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath($background, $path)
    $path.Dispose()
  }

  $points = @(
    [System.Drawing.PointF]::new([single](208*$scale),[single](82*$scale)),
    [System.Drawing.PointF]::new([single](304*$scale),[single](82*$scale)),
    [System.Drawing.PointF]::new([single](323*$scale),[single](208*$scale)),
    [System.Drawing.PointF]::new([single](430*$scale),[single](256*$scale)),
    [System.Drawing.PointF]::new([single](323*$scale),[single](304*$scale)),
    [System.Drawing.PointF]::new([single](304*$scale),[single](430*$scale)),
    [System.Drawing.PointF]::new([single](208*$scale),[single](430*$scale)),
    [System.Drawing.PointF]::new([single](189*$scale),[single](304*$scale)),
    [System.Drawing.PointF]::new([single](82*$scale),[single](256*$scale)),
    [System.Drawing.PointF]::new([single](189*$scale),[single](208*$scale))
  )
  $graphics.FillPolygon($red, $points)
  $graphics.FillEllipse($background, [single](214*$scale), [single](214*$scale), [single](84*$scale), [single](84*$scale))

  $target = Join-Path $OutputDirectory $FileName
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $red.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
New-DsrsIcon -Size 192 -FileName 'icon-192.png'
New-DsrsIcon -Size 512 -FileName 'icon-512.png'
New-DsrsIcon -Size 512 -FileName 'icon-maskable-512.png' -Maskable
New-DsrsIcon -Size 180 -FileName 'apple-touch-icon.png'
