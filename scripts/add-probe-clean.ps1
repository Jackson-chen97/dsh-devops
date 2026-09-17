$ErrorActionPreference = 'Stop'
$f = 'D:\Develop\Project\dsh-devops\src\client.js'
$t = [System.IO.File]::ReadAllText($f)
# remember BOM state
$b = [System.IO.File]::ReadAllBytes($f)
$hasBom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
$t = $t.Replace("`r`n", "`n")

function ReplaceOnce([string]$t, [string]$old, [string]$new, [string]$label) {
  $count = 0
  $idx = 0
  while (($idx = $t.IndexOf($old, $idx, [System.StringComparison]::Ordinal)) -ge 0) { $count++; $idx += $old.Length }
  if ($count -ne 1) { Write-Host "DIAG label=[$label] count=$count oldlen=$($old.Length) oldhead=[$($old.Substring(0,[Math]::Min(50,$old.Length)))]"; throw "ReplaceOnce '$label': $count occurrences (want 1)" }
  return $t.Replace($old, $new)
}

# --- 1) Select component: name prop + mousedown/mount/unmount logs ---
$old1 = @'
    function Select({ options, value, onChange, disabled, placeholder, style }) {
      const validOpts = (options || []).filter((opt) => opt != null);
      return h("select", {
        style: { ...S.select, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style },
        value: value || "",
        onChange: (e) => onChange(e.target.value),
        disabled,
      }, [
'@
$new1 = @'
    function Select({ options, value, onChange, disabled, placeholder, style, name }) {
      if (name) useEffect(() => {
        console.log("[devops-sel:" + name + "] MOUNT");
        return () => console.log("[devops-sel:" + name + "] UNMOUNT");
      }, [name]);
      const validOpts = (options || []).filter((opt) => opt != null);
      return h("select", {
        style: { ...S.select, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style },
        value: value || "",
        onChange: (e) => onChange(e.target.value),
        disabled,
        onMouseDown: name ? () => console.log("[devops-sel:" + name + "] mousedown disabled=" + !!disabled) : undefined,
      }, [
'@
$t = ReplaceOnce $t $old1 $new1 'Select'

# --- 2) DevopsDashboard: mount/unmount/render/scroll probes ---
$old2 = @'
      const tagMsgRef = useRef(null);

      // Load saved config
'@
$new2 = @'
      const tagMsgRef = useRef(null);

      // ===== DEBUG PROBE (remove after diagnosis) =====
      window.__devopsRc = (window.__devopsRc || 0) + 1;
      if (window.__devopsRc % 20 === 1) console.log("[devops] RENDER #" + window.__devopsRc);
      useEffect(() => {
        console.log("[devops] DASHBOARD MOUNT");
        const scroller = document.querySelector("[data-conversation-scroll]");
        let last = 0;
        const onScroll = () => {
          const now = Date.now();
          if (!scroller || now - last < 300) return;
          last = now;
          console.log("[devops] SCROLL top=" + Math.round(scroller.scrollTop) + " clientH=" + scroller.clientHeight + " scrollH=" + scroller.scrollHeight);
        };
        if (scroller) scroller.addEventListener("scroll", onScroll, true);
        return () => {
          console.log("[devops] DASHBOARD UNMOUNT");
          if (scroller) scroller.removeEventListener("scroll", onScroll, true);
        };
      }, []);
      // ===== END DEBUG PROBE =====

      // Load saved config
'@
$t = ReplaceOnce $t $old2 $new2 'DashboardProbe'

# --- 3) names on the 5 bar selects (explicit vars, separate calls) ---
$NL = "`n"
$o1 = 'h(Select, {' + $NL + '                value: config.gitlab.activeServerId || "",'
$n1 = 'h(Select, {' + $NL + '                name: "server",' + $NL + '                value: config.gitlab.activeServerId || "",'
$o2 = 'h(Select, {' + $NL + '                value: glServer?.projectPath || "",'
$n2 = 'h(Select, {' + $NL + '                name: "project",' + $NL + '                value: glServer?.projectPath || "",'
$o3 = 'h(Select, {' + $NL + '                value: config.k8s.activeKubeconfigId || "",'
$n3 = 'h(Select, {' + $NL + '                name: "kubeconfig",' + $NL + '                value: config.k8s.activeKubeconfigId || "",'
$o4 = 'h(Select, {' + $NL + '                value: k8sKc?.context || "",'
$n4 = 'h(Select, {' + $NL + '                name: "context",' + $NL + '                value: k8sKc?.context || "",'
$o5 = 'h(Select, {' + $NL + '                value: k8sKc?.namespace || "",'
$n5 = 'h(Select, {' + $NL + '                name: "namespace",' + $NL + '                value: k8sKc?.namespace || "",'
$t = ReplaceOnce $t $o1 $n1 'server'
$t = ReplaceOnce $t $o2 $n2 'project'
$t = ReplaceOnce $t $o3 $n3 'kubeconfig'
$t = ReplaceOnce $t $o4 $n4 'context'
$t = ReplaceOnce $t $o5 $n5 'namespace'

# --- restore CRLF and write back ---
$t = $t.Replace("`n", "`r`n")
$enc = New-Object System.Text.UTF8Encoding($hasBom)
[System.IO.File]::WriteAllText($f, $t, $enc)
Write-Output "probe insertion: OK"
