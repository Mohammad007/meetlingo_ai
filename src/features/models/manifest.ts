import type { NativeAsrModelSpec } from '@/../modules/meetlingo-native';

/**
 * Speech model catalogue. Every value here was verified against the published release asset:
 *  - archive size and SHA-256 match GitHub's asset digest (checked 2026-11-07),
 *  - file names and byte sizes were read from the archive listing,
 *  - both models were decoded with sherpa-onnx using the exact recogniser configuration used on Android
 *    (16 kHz, 80-dim fbank, greedy search, endpointing) on a desktop CPU.
 * On-device latency must still be benchmarked per phone (see Diagnostics). No sizes are estimated.
 */
export interface AsrModelEntry extends NativeAsrModelSpec {
  kind: 'asr';
  name: string;
  description: string;
  license: string;
  licenseUrl: string;
  source: string;
  recommended: boolean;
  /** Observed on a desktop CPU with 2 threads; phones are typically 3-10x slower. Indicative only. */
  desktopRealTimeFactor: number;
  features: string[];
}

const BASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models';

export const ASR_MODELS: AsrModelEntry[] = [
  {
    kind: 'asr',
    id: 'kroko-en-2025-08-06',
    name: 'English streaming (Standard)',
    description: 'Fast streaming Zipformer transducer with casing and punctuation. Recommended for most phones.',
    version: '2025-08-06',
    url: `${BASE}/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2`,
    archiveSha256: 'c8676e5ff9ac2a85296e53ee0fd4d5fb1db6770e7a7647166eeafe349ade6834',
    archiveBytes: 57_267_600,
    archiveRoot: 'sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06',
    files: [
      { name: 'encoder.onnx', sizeBytes: 70_092_599 },
      { name: 'decoder.onnx', sizeBytes: 617_488 },
      { name: 'joiner.onnx', sizeBytes: 336_817 },
      { name: 'tokens.txt', sizeBytes: 6_310 },
    ],
    roles: { encoder: 'encoder.onnx', decoder: 'decoder.onnx', joiner: 'joiner.onnx', tokens: 'tokens.txt' },
    license: 'CC-BY-SA (Banafo Kroko community model). Review the licence before commercial distribution.',
    licenseUrl: 'https://huggingface.co/Banafo/Kroko-ASR',
    source: 'k2-fsa/sherpa-onnx release "asr-models"',
    recommended: true,
    desktopRealTimeFactor: 0.05,
    features: ['Streaming', 'Punctuation', 'Casing', 'Endpoint detection'],
  },
  {
    kind: 'asr',
    id: 'nemo-fastconformer-en-80ms-int8',
    name: 'English streaming (NeMo, larger)',
    description: 'NVIDIA FastConformer transducer (int8). Lower-case output without punctuation; heavier on CPU.',
    version: '2025-07-08',
    url: `${BASE}/sherpa-onnx-nemo-streaming-fast-conformer-transducer-en-80ms-int8.tar.bz2`,
    archiveSha256: '7bd33a914e93370a1ba9c2066d9e841bdcad8613fa2a00537c1ae15d851a14d8',
    archiveBytes: 102_813_625,
    archiveRoot: 'sherpa-onnx-nemo-streaming-fast-conformer-transducer-en-80ms-int8',
    files: [
      { name: 'encoder.int8.onnx', sizeBytes: 131_507_579 },
      { name: 'decoder.int8.onnx', sizeBytes: 3_955_863 },
      { name: 'joiner.int8.onnx', sizeBytes: 1_408_182 },
      { name: 'tokens.txt', sizeBytes: 11_896 },
    ],
    roles: { encoder: 'encoder.int8.onnx', decoder: 'decoder.int8.onnx', joiner: 'joiner.int8.onnx', tokens: 'tokens.txt' },
    license: 'CC-BY-4.0 (NVIDIA NeMo FastConformer). Attribution required.',
    licenseUrl: 'https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/stt_en_fastconformer_hybrid_large_streaming_multi',
    source: 'k2-fsa/sherpa-onnx release "asr-models"',
    recommended: false,
    desktopRealTimeFactor: 0.5,
    features: ['Streaming', 'Endpoint detection', 'Lower-case output'],
  },
];

export const TRANSLATION_MODEL = {
  kind: 'translation' as const,
  id: 'mlkit-en-hi',
  name: 'Hindi translation (Google ML Kit)',
  description:
    'On-device English → Hindi translation. Downloaded and managed by Google Play services; the exact size is not reported by the API (Google documents roughly 30 MB per language).',
  version: 'ML Kit translate 17.0.3',
  license: 'Google ML Kit Terms of Service. Translations by Google.',
  licenseUrl: 'https://developers.google.com/ml-kit/terms',
};

export const getAsrModel = (id: string | null | undefined) => ASR_MODELS.find((m) => m.id === id) ?? null;
export const DEFAULT_ASR_MODEL_ID = ASR_MODELS.find((m) => m.recommended)!.id;

export function extractedBytes(m: NativeAsrModelSpec) {
  return m.files.reduce((a, f) => a + f.sizeBytes, 0);
}
