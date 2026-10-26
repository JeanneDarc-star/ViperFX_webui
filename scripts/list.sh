# list.sh <ir|ddc>  -> one file name per line
D=/data/adb/v4a_re
case "$1" in
  ir)  DIRS="$D/kernels /sdcard/ViPER4Android/Kernel /storage/emulated/0/ViPER4Android/Kernel"; PAT='\.(irs|wav)$' ;;
  ddc) DIRS="$D/ddc /sdcard/ViPER4Android/DDC /storage/emulated/0/ViPER4Android/DDC"; PAT='\.vdc$' ;;
  *) exit 1 ;;
esac
for d in $DIRS; do
  [ -d "$d" ] && ls -1 "$d" 2>/dev/null
done | grep -i -E "$PAT" | sort -u
exit 0
