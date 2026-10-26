# ViPER4Android RE Fork (WebUI)

ViPERFX_RE with a built-in WebUI. No companion app needed, just open the module's WebUI and tweak away.

## Getting started
1. Flash the zip in Magisk, KernelSU or APatch, then reboot.
2. Open the WebUI from the module's card (KernelSU / APatch have it built in, on Magisk use WebUI X or MMRL).
3. Flip the main switch at the top, then set up your effects. Changes save and apply on their own, usually within half a second.

Uninstall the old ViPER4Android app, otherwise the audio gets processed twice.

## How it works
- `libv4a_re.so` is now a small shim. It loads the original library (`libv4a_re_core.so`) and passes everything through to it.
- The effect is attached to the music, ring, alarm, notification, system, tts and accessibility streams through `audio_effects`, so it works across the whole device and the framework creates it by itself.
- The shim watches `/data/adb/v4a_re/viper.cmd` (written by the WebUI) and sends the settings to the core.
- Main switch off means audio passes through untouched.

## Effects
Output (volume, balance, limiter), Equalizer (10 bands), Bass, Clarity, Dynamic System, Headphone Surround, Field Surround, Differential Surround, Crossfeed, Reverb, Convolver, ViPER-DDC, Compressor, Auto Gain, Spectrum Extension, Tube Simulator, AnalogX, Speaker Optimization.

- **Headphone Surround**: the five original ViPER kernels (Level 1 to 5), run through FFT convolution.
- **Convolver**: FFT convolution with an impulse response file (`.wav` or `.irs`; mono, stereo or 4-channel; up to 2 seconds are used).
- **ViPER-DDC**: biquad filters from a `.vdc` file (the 44100 and 48000 Hz sets).
- **Compressor**: a feed-forward compressor with threshold, ratio, knee, attack, release and makeup gain.
- **Auto Gain**: a slow, smooth leveler that nudges the loudness toward a target.

### Convolver and DDC files
Drop your files in `/sdcard/ViPER4Android/Kernel` (`.wav`, `.irs`) or `/sdcard/ViPER4Android/DDC` (`.vdc`). `/data/adb/v4a_re/kernels` and `/data/adb/v4a_re/ddc` work too. Then pick one in the WebUI (tap Refresh if it isn't listed yet). The file you pick gets copied to `/data/adb/v4a_re/` so the audio process is allowed to read it.

### Good to know
- Headphone Surround and Convolver add about 12 ms of latency, which you won't notice with music.
- The extra effects only process stereo float or 16-bit audio. Anything else passes through as is.
- A soft clipper at 0.95 keeps hot impulse responses from blowing up the output.

## Diagnostics
The Diagnostics button in the WebUI (or the module's Action button) shows the state of the config file, the libraries, the `audio_effects` patch and the log. To watch the shim's log yourself, run `logcat -s V4A_WEBUI`.
