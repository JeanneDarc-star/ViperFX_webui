MODDIR=${0%/*}
if [ -d "$MODDIR/odm" ]; then
  for f in $(find "$MODDIR/odm" -type f 2>/dev/null); do
    t=${f#$MODDIR}
    [ -f "$t" ] && mount -o bind "$f" "$t"
  done
fi
