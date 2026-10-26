D=/data/adb/v4a_re
B64=""
if command -v base64 >/dev/null 2>&1; then B64="base64"; else
  for b in /data/adb/ksu/bin/busybox /data/adb/magisk/busybox /data/adb/ap/bin/busybox /system/bin/busybox; do
    [ -x "$b" ] && "$b" base64 --help >/dev/null 2>&1 && { B64="$b base64"; break; }
  done
fi
[ -n "$B64" ] || { echo "base64 not found" >&2; exit 2; }
[ -n "$1" ] && [ -n "$2" ] || { echo "usage: apply.sh <b64 state> <b64 cmd>" >&2; exit 2; }
mkdir -p $D || exit 1
printf '%s' "$1" | $B64 -d > $D/state.json.tmp || exit 1
printf '%s' "$2" | $B64 -d > $D/viper.cmd.tmp || exit 1
grep -q '^format 1' $D/viper.cmd.tmp || { echo "invalid command file" >&2; rm -f $D/*.tmp; exit 3; }
chmod 644 $D/state.json.tmp $D/viper.cmd.tmp
chcon u:object_r:vendor_configs_file:s0 $D/state.json.tmp $D/viper.cmd.tmp 2>/dev/null
mv -f $D/state.json.tmp $D/state.json
mv -f $D/viper.cmd.tmp $D/viper.cmd
exit 0
