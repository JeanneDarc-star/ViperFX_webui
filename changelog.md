### 9.1-webui
- New EQ preset "KZ EDX Pro X → CVJ Kira": it nudges the EDX Pro X toward the Kira's tuning (a bit more warmth and body in the low mids, a calmer 8 kHz peak). It's built from both IEMs' measurements and fitted through the actual ViPER EQ, and it includes a small preamp cut so the boosts can't clip.

### 9.0-webui
- Headphone Surround, Convolver, ViPER-DDC, Compressor and Auto Gain finally work. The core only had empty stubs for them, so the shim now does the processing itself.
- File picker in the WebUI for Convolver (`.wav` / `.irs`) and DDC (`.vdc`) files.
- Readme and changelog are in English now.

### 8.2-webui
- Stronger starting values, so effects are actually noticeable when you switch them on (Bass +12 dB at 80 Hz, Clarity 8 dB, Dynamic System 50%, Field Surround level 3, Reverb wet 40%, Spectrum 60%). Values you never touched move to the new ones, the ones you changed stay put.
- Removed the toast messages.

### 8.1-webui
- WebUI redesigned with a simple Material 3 look (tonal colors, rounded components).
- English and Indonesian, switchable in Settings. The Indonesian text is more relaxed now.
- Diagnostics follows the language you picked.

### 8.0-webui.2
- Fixed the effect not attaching when the `<postprocess>` block in `audio_effects.xml` was commented out. Comments are ignored now.
- The effect now attaches to music, ring, alarm, notification, system, tts and accessibility streams, so it's global instead of music only.
- Diagnostics shows how many streams each file has.

### 8.0-webui
- Built-in WebUI, no companion app needed.
- The library is wrapped in a shim that reads `/data/adb/v4a_re/viper.cmd`.
- The effect attaches to the music stream automatically.
- Fixed the odm bind mount using the wrong module path.
