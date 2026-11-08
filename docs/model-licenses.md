# Models, libraries and licences

All sizes and checksums below were verified on 2026-11-07 by downloading the assets and comparing with GitHub's published digests. Both ASR models were decoded with sherpa-onnx using the exact recogniser configuration shipped in the app.

## Speech recognition models (downloaded in-app)

| ID | Archive | SHA-256 | Installed files | Licence | Notes |
| --- | --- | --- | --- | --- | --- |
| `kroko-en-2025-08-06` (default) | 57,267,600 B — `sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2` | `c8676e5ff9ac2a85296e53ee0fd4d5fb1db6770e7a7647166eeafe349ade6834` | encoder 70,092,599 · decoder 617,488 · joiner 336,817 · tokens 6,310 | **CC-BY-SA** (Banafo Kroko community model, https://huggingface.co/Banafo/Kroko-ASR). Review before commercial distribution; Banafo sells separately licensed commercial models. | Cased + punctuated output. Desktop RTF ≈ 0.05 (2 threads). |
| `nemo-fastconformer-en-80ms-int8` | 102,813,625 B — `sherpa-onnx-nemo-streaming-fast-conformer-transducer-en-80ms-int8.tar.bz2` | `7bd33a914e93370a1ba9c2066d9e841bdcad8613fa2a00537c1ae15d851a14d8` | encoder.int8 131,507,579 · decoder.int8 3,955,863 · joiner.int8 1,408,182 · tokens 11,896 | **CC-BY-4.0** (NVIDIA NeMo). Attribution required. | Lower-case, no punctuation. Desktop RTF ≈ 0.5 — benchmark on the target phone before relying on it. |

Source: https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models

> Licensing decision needed before a commercial release: if CC-BY-SA terms are not acceptable for your distribution, make the NeMo model the default (`recommended: true` in `src/features/models/manifest.ts`) or license a commercial model.

## Voice activity detection (bundled in the APK)

| File | Size | SHA-256 | Licence |
| --- | --- | --- | --- |
| `silero_vad.onnx` (module assets) | 643,854 B | `9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6` (matches the sherpa-onnx release digest) | MIT (Silero VAD, https://github.com/snakers4/silero-vad) |

## Translation

Google ML Kit Translation `com.google.mlkit:translate:17.0.3`, English→Hindi on-device model managed by Google Play services. Size is not exposed by the API (Google documents ~30 MB per language). Subject to the ML Kit Terms of Service (https://developers.google.com/ml-kit/terms); the app shows "Translations by Google" attribution in Settings → About and in exports.

## Native libraries

| Library | Version | Licence |
| --- | --- | --- |
| sherpa-onnx (AAR incl. onnxruntime) | 2.0.1, SHA-256 `a8d09d1d32f3eb8520482c6d3d43fae674681c5b050385967c70a3c2c9bf0ee7` | Apache-2.0 (onnxruntime: MIT) |
| Apache Commons Compress | 1.27.1 | Apache-2.0 |
| Kotlin coroutines, AndroidX Core | 1.9.0 / 1.13.1 | Apache-2.0 |

## JavaScript

Expo SDK 58 and expo-* modules (MIT), React Native 0.88 (MIT), Zustand (MIT), react-native-svg (MIT), @react-native-community/netinfo (MIT).
