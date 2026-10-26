echo -n $LIBPATCH > $MODPATH/libpatch.txt

ui_print "    Copying lib files..."

cp_ch -n $MODPATH/common/files/libv4a_re_$ABI32.so $MODPATH$LIBDIR/lib/soundfx/libv4a_re_core.so
cp_ch -n $MODPATH/common/files/shim_$ABI32.so $MODPATH$LIBDIR/lib/soundfx/libv4a_re.so
if $IS64BIT; then
  cp_ch -n $MODPATH/common/files/libv4a_re_$ABI.so $MODPATH$LIBDIR/lib64/soundfx/libv4a_re_core.so
  cp_ch -n $MODPATH/common/files/shim_$ABI.so $MODPATH$LIBDIR/lib64/soundfx/libv4a_re.so
fi

ui_print "    Patching audio_effects config files"
. $MODPATH/common/patch_effects.sh
CFGS="$(find /odm /system /vendor -type f -name "*audio_effects*.conf" -o -name "*audio_effects*.xml")"
for OFILE in ${CFGS}; do
  FILE="$MODPATH$(echo $OFILE | sed "s|^/vendor|/system/vendor|g")"
  cp_ch -n $OFILE $FILE
  v4a_patch_file "$FILE" "$LIBPATCH"
done

ui_print "    Preparing WebUI settings"
CFGDIR=/data/adb/v4a_re
mkdir -p $CFGDIR $CFGDIR/kernels $CFGDIR/ddc
if [ ! -f $CFGDIR/viper.cmd ]; then
  printf 'format 1\nmaster 0\n' > $CFGDIR/viper.cmd
fi
chmod 755 $CFGDIR
chmod 644 $CFGDIR/* 2>/dev/null
chcon -R u:object_r:vendor_configs_file:s0 $CFGDIR 2>/dev/null
ui_print "    Open the module WebUI to configure effects"
