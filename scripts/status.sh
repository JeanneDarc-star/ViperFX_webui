MODDIR=/data/adb/modules/ViPER4Android-RE-Fork
D=/data/adb/v4a_re
LANGC=${1:-en}
# L key -> text in the chosen language
L() {
  if [ "$LANGC" = "id" ]; then
    case "$1" in
      files) echo "== Berkas";; cmd) echo "viper.cmd ada      ";; master) echo "master             ";;
      count) echo "jumlah perintah    ";; selinux) echo "label SELinux      ";;
      lib) echo "== Library";; inst) echo "terpasang          ";; nolib) echo "tidak ditemukan (sudah reboot setelah flash?)";;
      ae) echo "== audio_effects";; reg) echo "file terdaftar     ";; wst) echo "file dgn stream    ";; st) echo "stream";; total) echo "total";;
      sys) echo "== Sistem audio";; ref) echo "referensi efek     ";; app) echo "aplikasi V4A (hapus biar nggak dobel)";;
      log) echo "== Log (V4A_WEBUI)";; yes) echo "ya";; no) echo "tidak";;
    esac
  else
    case "$1" in
      files) echo "== Files";; cmd) echo "viper.cmd present  ";; master) echo "master             ";;
      count) echo "command count      ";; selinux) echo "SELinux label      ";;
      lib) echo "== Library";; inst) echo "installed          ";; nolib) echo "not found (rebooted after flashing?)";;
      ae) echo "== audio_effects";; reg) echo "registered files   ";; wst) echo "files with streams ";; st) echo "streams";; total) echo "total";;
      sys) echo "== Audio system";; ref) echo "effect references  ";; app) echo "V4A app (remove it to avoid doubling)";;
      log) echo "== Log (V4A_WEBUI)";; yes) echo "yes";; no) echo "no";;
    esac
  fi
}
yn() { [ "$1" = "1" ] && L yes || L no; }
L files
[ -f $D/viper.cmd ] && f=1 || f=0
echo "$(L cmd): $(yn $f)"
if [ $f = 1 ]; then
  echo "$(L master): $(grep '^master' $D/viper.cmd | head -n1)"
  echo "$(L count): $(grep -c '^s ' $D/viper.cmd)"
  echo "$(L selinux): $(ls -Z $D/viper.cmd 2>/dev/null | cut -d' ' -f1)"
fi
L lib
n=0; for l in /vendor/lib64/soundfx/libv4a_re.so /vendor/lib/soundfx/libv4a_re.so /system/lib64/soundfx/libv4a_re.so /system/lib/soundfx/libv4a_re.so; do
  [ -f $l ] && { echo "$(L inst): $l"; n=1; }
done
[ $n = 0 ] && echo "$(L inst): $(L nolib)"
L ae
c=0; a=0; ns=0
for f in $(find /vendor/etc /odm/etc /system/etc -type f \( -name 'audio_effects*.xml' -o -name 'audio_effects*.conf' \) 2>/dev/null); do
  grep -q v4a_standard_re "$f" || continue
  c=$((c+1))
  case "$f" in
    *.xml) n=$(sed -e 's/<!--[^>]*-->//g' -e '/<!--/,/-->/s/.*//' "$f" | grep -c 'apply effect="v4a_standard_re"') ;;
    *) n=$(grep -c '^[[:space:]]*v4a_standard_re[[:space:]]*{' "$f"); n=$((n>0 ? n-1 : 0)) ;;
  esac
  echo "  $f -> $n $(L st)"
  [ "$n" -gt 0 ] && { a=$((a+1)); ns=$((ns+n)); }
done
echo "$(L reg): $c"
echo "$(L wst): $a ($(L total) $ns $(L st))"
L sys
inst=$(dumpsys media.audio_flinger 2>/dev/null | grep -c -i "90380da3")
echo "$(L ref): $inst"
pm list packages 2>/dev/null | grep -i -E "viper4android|wstxda.viper" | sed "s/^/$(L app): /"
L log
logcat -d -s V4A_WEBUI:I V4A_WEBUI:W V4A_WEBUI:E 2>/dev/null | tail -n 8
