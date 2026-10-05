// Trascrizione in un worker (l'interfaccia non si blocca): Whisper large-v3-turbo con i tempi delle parole, sulla scheda video (WebGPU).
// Il modello (~560 MB) si scarica la prima volta e resta nella cache del browser.
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'onnx-community/whisper-large-v3-turbo_timestamped';
let asr: any = null;

async function load() {
  if (asr) return asr;
  const T: any = await import(/* @vite-ignore */ TJS);
  T.env.allowLocalModels = false;
  const files = new Map<string, [number, number]>();
  let last = 0;
  asr = await T.pipeline('automatic-speech-recognition', MODEL, {
    device: 'webgpu', dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' },
    progress_callback: (p: any) => {
      if (p.status !== 'progress' || !p.total) return;
      files.set(p.file, [p.loaded, p.total]);
      const now = performance.now(); if (now - last < 200) return; last = now;
      let l = 0, t = 0; for (const [a, b] of files.values()) { l += a; t += b; }
      postMessage({ type: 'load', loaded: l, total: t });
    },
  });
  return asr;
}

onmessage = async (e: MessageEvent) => {
  const { id, audio, lang } = e.data;
  try {
    if (!(navigator as any).gpu) throw new Error('nogpu');
    const a = await load();
    postMessage({ type: 'run', id });
    const r = await a(audio, { language: lang || null, task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
    const words = (r.chunks || []).map((c: any) => ({ t: String(c.text).trim(), s: c.timestamp[0], e: c.timestamp[1] ?? c.timestamp[0] + .3 })).filter((w: any) => w.t);
    postMessage({ type: 'done', id, words, text: r.text });
  } catch (err: any) {
    postMessage({ type: 'error', id, msg: String(err && err.message || err) });
  }
};
