import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';

export interface TranscribeAudioOptions {
  base64Audio: string;
  mimeType?: string;
  prompt?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export async function transcribeAudioService(options: TranscribeAudioOptions) {
  const {
    base64Audio,
    mimeType = 'audio/wav',
    prompt,
    customApiKey,
    clientAccessCode,
  } = options;

  if (!base64Audio) {
    throw new Error('Data audio base64 diperlukan.');
  }

  const audioPart = {
    inlineData: {
      mimeType: mimeType || 'audio/wav',
      data: base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, ''),
    },
  };

  const promptText =
    prompt ||
    'Transkripsikan rekaman suara audio ini secara akurat dan lengkap ke dalam teks Bahasa Indonesia.';

  const result = await callGeminiWithFallback(
    'gemini-3.5-transcribe',
    {
      contents: { parts: [audioPart, { text: promptText }] },
      config: { temperature: 0.2 },
    },
    customApiKey,
    clientAccessCode,
    'tier2',
    'Audio Transcribe'
  );

  return {
    transcript: result.text,
    modelUsed: result.modelUsed,
  };
}
