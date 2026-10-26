# import.sh <ir|ddc> <base64 file name>
# Copies the chosen file to where the audio process can read it (SELinux label set).
D=/data/adb/v4a_re
B64=""
if command -v base64 >/dev/null 2>&1; then B64="base64"; else
  for b in /data/adb/ksu/bin/busybox /data/adb/magisk/busybox /data/adb/ap/bin/busybox /system/bin/busybox; do
    [ -x "$b" ] && "$b" base64 --help >/dev/null 2>&1 && { B64="$b base64"; break; }
  done
fi
[ -n "$B64" ] || { echo "base64 not found" >&2; exit 2; }
case "$1" in
  ir)  DIRS="$D/kernels /sdcard/ViPER4Android/Kernel /storage/emulated/0/ViPER4Android/Kernel"; DEST=$D/conv.ir ;;
  ddc) DIRS="$D/ddc /sdcard/ViPER4Android/DDC /storage/emulated/0/ViPER4Android/DDC"; DEST=$D/ddc.vdc ;;
  *) echo "bad kind" >&2; exit 2 ;;
esac
NAME=$(printf '%s' "$2" | $B64 -d 2>/dev/null)
[ -n "$NAME" ] || { echo "empty name" >&2; exit 2; }
case "$NAME" in */*|*..*) echo "bad name" >&2; exit 2 ;; esac
SRC=""
for d in $DIRS; do [ -f "$d/$NAME" ] && { SRC="$d/$NAME"; break; }; done
[ -n "$SRC" ] || { echo "file not found" >&2; exit 3; }
SIZE=$(wc -c < "$SRC")
[ "$SIZE" -gt 0 ] && [ "$SIZE" -le 41943040 ] || { echo "bad size" >&2; exit 4; }
mkdir -p $D
cp "$SRC" "$DEST.tmp" || exit 5
chmod 644 "$DEST.tmp"
chcon u:object_r:vendor_configs_file:s0 "$DEST.tmp" 2>/dev/null
mv -f "$DEST.tmp" "$DEST" || exit 6
echo ok
exit 0
