D=/data/adb/v4a_re
[ -d $D ] || exit 0
chmod 755 $D
chmod 644 $D/* 2>/dev/null
chcon -R u:object_r:vendor_configs_file:s0 $D 2>/dev/null
