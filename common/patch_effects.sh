V4A_UUID="90380da3-8536-4744-a6a3-5731970e640f"
V4A_STREAMS="music ring alarm notification system tts accessibility"

v4a_strip_xml() {
  sed -e 's/<!--[^>]*-->//g' -e '/<!--/,/-->/s/.*//' "$1"
}

v4a_xml_attach() {
  F="$1"; S="$2"
  T="$F.v4a_tmp"
  v4a_strip_xml "$F" > "$T"
  PP=$(grep -n '<postprocess' "$T" | head -n 1 | cut -d: -f1)
  if [ -z "$PP" ]; then rm -f "$T"; return 1; fi
  L=$(grep -n "<stream[^>]*type=\"$S\"" "$T" | head -n 1 | cut -d: -f1)
  if [ -n "$L" ]; then
    if sed -n "${L}p" "$T" | grep -q '/>'; then
      sed -i "${L}s|<stream\([^>]*\)type=\"$S\"\([^>]*\)/>|<stream\1type=\"$S\"\2>\n            <apply effect=\"v4a_standard_re\"/>\n        </stream>|" "$F"
    else
      sed -i "${L}a\\            <apply effect=\"v4a_standard_re\"/>" "$F"
    fi
  else
    sed -i "${PP}a\\        <stream type=\"$S\">\n            <apply effect=\"v4a_standard_re\"/>\n        </stream>" "$F"
  fi
  rm -f "$T"
  return 0
}

v4a_patch_file() {
  F="$1"; LP="$2"
  case "$F" in
    *.conf)
      sed -i "/v4a_standard_re {/,/}/d" "$F"
      sed -i "/v4a_re {/,/}/d" "$F"
      sed -i "s/^effects {/effects {\n  v4a_standard_re {\n    library v4a_re\n    uuid $V4A_UUID\n  }/g" "$F"
      sed -i "s/^libraries {/libraries {\n  v4a_re {\n    path $LP\/lib\/soundfx\/libv4a_re.so\n  }/g" "$F"
      if ! grep -q "^[[:space:]]*output_session_processing" "$F"; then
        printf '\noutput_session_processing {\n}\n' >> "$F"
      fi
      for S in $V4A_STREAMS; do
        if grep -q "^[[:space:]]*$S[[:space:]]*{" "$F"; then
          sed -i "s/^\([[:space:]]*\)$S[[:space:]]*{/&\n\1  v4a_standard_re {\n\1  }/" "$F"
        else
          sed -i "s/^\([[:space:]]*\)output_session_processing[[:space:]]*{/&\n\1  $S {\n\1    v4a_standard_re {\n\1    }\n\1  }/" "$F"
        fi
      done
      ;;
    *.xml)
      sed -i "/v4a_standard_re/d" "$F"
      sed -i "/v4a_re/d" "$F"
      sed -i "/<libraries>/ a\        <library name=\"v4a_re\" path=\"libv4a_re.so\"\/>" "$F"
      sed -i "/<effects>/ a\        <effect name=\"v4a_standard_re\" library=\"v4a_re\" uuid=\"$V4A_UUID\"\/>" "$F"
      if ! v4a_strip_xml "$F" | grep -q '<postprocess'; then
        sed -i "s|</audio_effects_conf>|    <postprocess>\n    </postprocess>\n</audio_effects_conf>|" "$F"
      fi
      for S in $V4A_STREAMS; do v4a_xml_attach "$F" "$S"; done
      ;;
  esac
}
