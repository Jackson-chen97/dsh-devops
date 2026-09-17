$ErrorActionPreference = 'Stop'
# 1) extract signing secret from web profile credentials
$lines = Get-Content 'C:\Users\T6003362\.dsh-lesso-app\profiles\web\.credentials.yaml'
$inRec = $false; $secretB64 = $null
for ($i = 0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i]
  if ($l -match 'browser-session') { $inRec = $true; continue }
  if ($inRec -and $l -match '^\s+secret:\s*(\S+)') { $secretB64 = $Matches[1]; break }
  if ($inRec -and $l -match '^\s{2}\S') { break }
}
"secret found: $($null -ne $secretB64) (b64url len: $(if($secretB64){$secretB64.Length}else{0}))"
function b64url-decode([string]$s) { $s = $s.Replace('-','+').Replace('_','/'); while ($s.Length % 4) { $s += '=' }; [Convert]::FromBase64String($s) }
function b64url-encode([byte[]]$b) { [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_').TrimEnd('=') }
$secret = b64url-decode $secretB64
"secret bytes: $($secret.Length)"
# 2) forge cookie for authority 127.0.0.1:3080
$authority = '127.0.0.1:3080'
$sha = [System.Security.Cryptography.SHA256]::Create()
$cookieName = 'dsh-auth-' + (b64url-encode ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($authority))))
$now = [long][DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$payload = [ordered]@{ version = 1; authority = $authority; issuedAt = $now; expiresAt = $now + 3600000 } | ConvertTo-Json -Compress
$bodyB64 = b64url-encode ([System.Text.Encoding]::UTF8.GetBytes($payload))
$hmac = New-Object System.Security.Cryptography.HMACSHA256(, $secret)
$sig = b64url-encode ($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($bodyB64)))
"cookie name: $cookieName"
# 3) fetch boot HTML
$resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/' -Headers @{ Cookie = $cookieName + '=v1.' + $bodyB64 + '.' + $sig } -UseBasicParsing
"HTML status: $($resp.StatusCode), len: $($resp.Content.Length)"
$html = $resp.Content
$matches2 = [regex]::Matches($html, '/plugins/\?\?[^"'' ]+')
if ($matches2.Count -eq 0) {
  "NO combo URL in HTML. First 400 chars:"
  $html.Substring(0, [Math]::Min(400, $html.Length))
} else {
  "== combo URLs in boot HTML =="
  $matches2 | ForEach-Object { $_.Value } | Sort-Object -Unique
  $first = ($matches2 | ForEach-Object { $_.Value } | Sort-Object -Unique)[0]
  $bundleUrl = 'http://127.0.0.1:3080' + $first
  "fetching: $bundleUrl"
  $br = Invoke-WebRequest -Uri $bundleUrl -Headers @{ Cookie = $cookieName + '=v1.' + $bodyB64 + '.' + $sig } -UseBasicParsing
  $js = $br.Content
  "bundle status: $($br.StatusCode), chars: $($js.Length)"
  "contains DASHBOARD MOUNT: " + ($js.Contains('DASHBOARD MOUNT'))
  "contains devops-sel:      " + ($js.Contains('devops-sel'))
  "contains DEBUG PROBE:     " + ($js.Contains('DEBUG PROBE'))
}
