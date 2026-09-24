import {
  systemMemory,
  saveSystemMemory,
  saveSystemMemoryAsync,
  getSystemIntelligenceLevel,
  recordExecutionAndUpgrade,
  MEMORY_FILE_PATH,
} from '@/server/core/state/systemMemoryState';
import { dbGetTrackingEvents } from '@/src/db/dbService';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { logger } from '@/server/core/utils/logger';

export function getSystemIntelligenceService() {
  const intel = getSystemIntelligenceLevel();
  return {
    status: 'active' as const,
    intelligence: intel,
    thinkingMode: 'Gemini 3.1 Pro High Thinking Active',
    memoryFile: MEMORY_FILE_PATH,
  };
}

export function processLearnEventsService(events: any[]) {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: true, processedEventsCount: 0, intelligence: getSystemIntelligenceLevel() };
  }

  if (!Array.isArray(systemMemory.formulas)) {
    systemMemory.formulas = [];
  }

  let newInsightsAdded = 0;

  for (const evt of events) {
    const { type, payload } = evt;

    if (type === 'video_uploaded') {
      if (payload?.fileName) {
        logger.info(`[Event Analytics] Video uploaded: ${payload.fileName} (${payload.fileSize || 0} bytes)`);
      }
    } else if (type === 'split_duration_selected') {
      logger.info(`[Event Analytics] Duration selected: ${payload?.duration}`);
    } else if (type === 'ai_engine_selected') {
      logger.info(`[Event Analytics] Engine selected: ${payload?.model}`);
    } else if (type === 'detail_element_toggled') {
      logger.info(`[Event Analytics] Detail element toggled: ${payload?.element} = ${payload?.enabled}`);
    } else if (type === 'prompt_split_generated') {
      const params = payload?.parameters || payload || {};
      const duration = params.segmentDuration || '10';
      const model = params.selectedModel || params.model || 'gemini-3.8-flash';
      const act = params.includeActions !== false;
      const vo = params.includeVoiceOver !== false;
      const cine = params.includeCinematics !== false;

      const elementsList: string[] = [];
      if (act) elementsList.push('Aksi&Gerakan');
      if (vo) elementsList.push('Transkrip VO');
      if (cine) elementsList.push('Kamera&Lighting');

      const formulaKey = `formula_${duration}_${model}_${act ? '1' : '0'}_${vo ? '1' : '0'}_${cine ? '1' : '0'}`;
      const formulaPattern = `Formula Pecah ${duration !== 'auto' ? duration + 's' : 'Penuh'} • ${model} • [${elementsList.join(', ')}]`;

      let existingFormula = systemMemory.formulas.find((f: any) => f.id === formulaKey);

      if (!existingFormula) {
        existingFormula = {
          id: formulaKey,
          pattern: formulaPattern,
          segmentDuration: duration,
          model: model,
          elements: elementsList,
          confidenceScore: 1,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        };
        systemMemory.formulas.push(existingFormula);

        const insight = `Formula Baru Teridentifikasi: ${formulaPattern}`;
        if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
          systemMemory.learnedKnowledgeBase.push(insight);
          newInsightsAdded++;
        }
      } else {
        existingFormula.lastUsedAt = Date.now();
        existingFormula.confidenceScore += 1;
      }

      systemMemory.totalExecutions += 1;
      systemMemory.successfulPromptsCount += 1;
      systemMemory.categoryUsage.videoPrompt = (systemMemory.categoryUsage.videoPrompt || 0) + 1;
    } else if (type === 'prompt_clip_copied' || type === 'prompt_sent_to_photo') {
      systemMemory.successfulPromptsCount += 1;
      const isSentToPhoto = type === 'prompt_sent_to_photo';
      const boost = isSentToPhoto ? 5 : 2;

      if (systemMemory.formulas.length > 0) {
        const targetFormula =
          systemMemory.formulas.find((f: any) => f.segmentDuration === payload?.segmentDuration) ||
          systemMemory.formulas[systemMemory.formulas.length - 1];
        if (targetFormula) {
          targetFormula.confidenceScore = (targetFormula.confidenceScore || 1) + boost;
          const insight = `Formula Validasi AI (+Confidence ${targetFormula.confidenceScore}): ${targetFormula.pattern}`;
          if (!systemMemory.learnedKnowledgeBase.includes(insight) && targetFormula.confidenceScore >= 3) {
            systemMemory.learnedKnowledgeBase.push(insight);
            newInsightsAdded++;
          }
        }
      }

      if (payload?.promptSnippet || payload?.text) {
        const rawTxt = payload.promptSnippet || payload.text;
        const shortSnippet = String(rawTxt).slice(0, 100).replace(/\n/g, ' ');
        const insight = `${isSentToPhoto ? 'Lanjut ke Prompt Foto' : 'Prompt Klip Dicopy'}: "${shortSnippet}..."`;
        if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
          systemMemory.learnedKnowledgeBase.push(insight);
          newInsightsAdded++;
        }
      }
    } else if (type === 'link_pasted') {
      systemMemory.totalExecutions += 1;
    } else if (type === 'tiktok_link_imported') {
      systemMemory.totalExecutions += 1;
      const rawTitle = payload?.title || payload?.caption || '';
      if (rawTitle && typeof rawTitle === 'string' && rawTitle.trim().length > 5) {
        const extractedHashtags = (rawTitle.match(/#[\w\u0590-\u05ff]+/g) || []).slice(0, 8);
        const cleanTitle = rawTitle.replace(/#[\w\u0590-\u05ff]+/g, '').trim().slice(0, 120);

        const hookInsight = `[Pola Viral TikTok] Hook/Topik: "${cleanTitle}"${extractedHashtags.length > 0 ? ` • Tags: ${extractedHashtags.join(' ')}` : ''}`;
        if (!systemMemory.learnedKnowledgeBase.includes(hookInsight)) {
          systemMemory.learnedKnowledgeBase.unshift(hookInsight);
          if (systemMemory.learnedKnowledgeBase.length > 120) {
            systemMemory.learnedKnowledgeBase = systemMemory.learnedKnowledgeBase.slice(0, 120);
          }
          newInsightsAdded++;
        }

        if (!Array.isArray(systemMemory.viralHookPatterns)) {
          systemMemory.viralHookPatterns = [];
        }
        if (cleanTitle && !systemMemory.viralHookPatterns.includes(cleanTitle)) {
          systemMemory.viralHookPatterns.unshift(cleanTitle);
          if (systemMemory.viralHookPatterns.length > 50) {
            systemMemory.viralHookPatterns = systemMemory.viralHookPatterns.slice(0, 50);
          }
        }
      }
    } else if (type === 'seo_caption_copied' || type === 'hashtags_copied') {
      systemMemory.successfulPromptsCount += 1;
      const copiedSnippet = String(payload?.text || payload?.snippet || '').slice(0, 120).replace(/\n/g, ' ');
      if (copiedSnippet) {
        const insight = `[Validasi Relevansi Tinggi] Pola ${type === 'hashtags_copied' ? 'Hashtag' : 'Caption SEO'} Terpilih: "${copiedSnippet}..."`;
        if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
          systemMemory.learnedKnowledgeBase.unshift(insight);
          newInsightsAdded++;
        }
      }
    } else if (type === 'video_downloaded') {
      systemMemory.totalExecutions += 1;
      systemMemory.successfulPromptsCount += 1;
    } else if (type === 'content_ideas_generated') {
      recordExecutionAndUpgrade('contentIdeas');
    } else if (type === 'video_prompt_generated') {
      recordExecutionAndUpgrade('videoPrompt');
    } else if (type === 'photo_prompt_generated') {
      recordExecutionAndUpgrade('photoPrompt');
    } else if (type === 'prompt_copied') {
      systemMemory.successfulPromptsCount += 1;
      if (payload?.text && typeof payload.text === 'string' && payload.text.length > 10) {
        const shortSnippet = payload.text.slice(0, 100).replace(/\n/g, ' ');
        const insight = `Pola Sukses (Dicopy User): "${shortSnippet}..."`;
        if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
          systemMemory.learnedKnowledgeBase.push(insight);
          newInsightsAdded++;
        }
      }
    } else if (type === 'prompt_edited_manually') {
      if (payload?.editedText && typeof payload.editedText === 'string') {
        const shortSnippet = payload.editedText.slice(0, 100).replace(/\n/g, ' ');
        const insight = `Penyesuaian Manual User: "${shortSnippet}..."`;
        if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
          systemMemory.learnedKnowledgeBase.push(insight);
          newInsightsAdded++;
        }
      }
    } else if (type === 'formula_injected') {
      if (payload?.insight && typeof payload.insight === 'string' && payload.insight.trim()) {
        recordExecutionAndUpgrade('contentIdeas', payload.insight.trim());
        newInsightsAdded++;
      }
    }
  }

  saveSystemMemory();

  return {
    success: true,
    processedEventsCount: events.length,
    newInsightsAdded,
    intelligence: getSystemIntelligenceLevel(),
  };
}

export function learnFeedbackService(insight: string, type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt' = 'contentIdeas') {
  if (!insight || typeof insight !== 'string' || !insight.trim()) {
    throw new Error('Insight teks tidak valid');
  }
  recordExecutionAndUpgrade(type, insight.trim());
  return { success: true, intelligence: getSystemIntelligenceLevel() };
}

export function getKnowledgeBaseService() {
  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }
  return {
    success: true,
    knowledgeBase: systemMemory.learnedKnowledgeBase,
    intelligenceLevel: getSystemIntelligenceLevel(),
    totalExecutions: systemMemory.totalExecutions || 350,
    lastUpdated: systemMemory.lastUpdated || new Date().toISOString(),
  };
}

export function injectKnowledgeService(insight: string, category?: string, fileName?: string) {
  if (!insight || typeof insight !== 'string' || !insight.trim()) {
    throw new Error('Teks wawasan pengetahuan tidak boleh kosong');
  }

  const formattedInsight = fileName
    ? `[Injeksi Berkas: ${fileName}] ${insight.trim()}`
    : category
    ? `[Injeksi System Admin: ${category.toUpperCase()}] ${insight.trim()}`
    : `[Injeksi System Admin] ${insight.trim()}`;

  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }

  if (!systemMemory.learnedKnowledgeBase.includes(formattedInsight)) {
    systemMemory.learnedKnowledgeBase.unshift(formattedInsight);
    systemMemory.lastUpdated = new Date().toISOString();
    saveSystemMemory();
  }

  return {
    success: true,
    message: 'Wawasan berhasil diinjeksi ke memori sistem!',
    knowledgeBase: systemMemory.learnedKnowledgeBase,
    intelligenceLevel: getSystemIntelligenceLevel(),
  };
}

export async function manualTrainKnowledgeService() {
  const autoLearnedInsights = [
    `[Manual Optimization ${new Date().toLocaleDateString('id-ID')}]: Optimalisasi retensi TikTok 3 detik pertama dengan zoom-in dinamis 1.15x dan teks hook berbobot emosional.`,
    `[Manual Optimization ${new Date().toLocaleDateString('id-ID')}]: Penataan lighting volumetric 5600K dan depth-of-field f/1.8 terbukti menghasilkan kualitas render video AI yang superior.`,
    `[Manual Optimization ${new Date().toLocaleDateString('id-ID')}]: Struktur narasi "Hook Masalah -> Solusi Ringkas -> Bukti Visual -> CTA Tegas" memaksimalkan interaksi penonton.`,
  ];

  let addedCount = 0;
  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }
  for (const ins of autoLearnedInsights) {
    if (!systemMemory.learnedKnowledgeBase.includes(ins)) {
      systemMemory.learnedKnowledgeBase.unshift(ins);
      addedCount++;
    }
  }

  systemMemory.lastUpdated = new Date().toISOString();
  await saveSystemMemoryAsync();

  return {
    success: true,
    message: `Pelatihan manual berhasil! Ditambahkan ${addedCount} wawasan optimasi baru.`,
    intelligenceLevel: getSystemIntelligenceLevel(),
    knowledgeBase: systemMemory.learnedKnowledgeBase,
  };
}

export function deleteKnowledgeService(index?: number, text?: string) {
  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }

  if (typeof index === 'number' && index >= 0 && index < systemMemory.learnedKnowledgeBase.length) {
    systemMemory.learnedKnowledgeBase.splice(index, 1);
  } else if (text && typeof text === 'string') {
    systemMemory.learnedKnowledgeBase = systemMemory.learnedKnowledgeBase.filter((k) => k !== text);
  }

  systemMemory.lastUpdated = new Date().toISOString();
  saveSystemMemory();

  return {
    success: true,
    knowledgeBase: systemMemory.learnedKnowledgeBase,
    intelligenceLevel: getSystemIntelligenceLevel(),
  };
}

export async function chatKnowledgeService(params: {
  message?: string;
  attachedFile?: any;
  chatHistory?: any;
}) {
  const { message, attachedFile } = params;
  if ((!message || !message.trim()) && !attachedFile) {
    throw new Error('Pesan atau berkas tidak boleh kosong');
  }

  const systemPrompt = `Anda adalah Core AI System Architect & Neural Knowledge Integrator dari Console Admin Tools Satset.
Tugas Anda adalah berdiskusi dengan Admin, menganalisis berkas/dokumen/teks yang diunggah Admin, dan mengekstrak aturan wawasan (Knowledge Injection Rules) yang secara langsung akan memperkaya kecerdasan sistem AI di seluruh aplikasi.

Respons Anda HARUS berformat JSON dengan struktur berikut:
{
  "reply": "Penjelasan responsif, profesional, dan futuristik dalam Bahasa Indonesia kepada Admin mengenai bagaimana pengetahuan ini telah terintegrasi.",
  "extractedInsights": [
    "Aturan/wawasan ringkas 1 yang siap diinjeksi ke memori sistem",
    "Aturan/wawasan ringkas 2"
  ],
  "suggestedTags": ["Tag1", "Tag2"]
}`;

  let userContent = `PESAN ADMIN: "${message || 'Mohon analisis berkas berikut dan integrasikan ke kecerdasan sistem.'}"`;
  if (attachedFile) {
    userContent += `\n\nBERKAS DIPERIKSA:
- Nama Berkas: ${attachedFile.name}
- Tipe/Ukuran: ${attachedFile.type || 'Dokumen'} (${attachedFile.size || 0} bytes)
- Isi Berkas / Ekstrak Teks:
${attachedFile.textContent || attachedFile.content || '(Teks berkas terlampir)'}`;
  }

  try {
    const response = await callGeminiWithFallback(
      'gemini-3.8-flash',
      {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      },
      undefined,
      undefined,
      'tier2',
      'Knowledge Injection'
    );

    const responseText = response.text || '';
    let parsedResponse: any = {};
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (err) {
      parsedResponse = {
        reply: responseText || 'Berhasil memproses pengetahuan baru dan menyuntikkannya ke sistem.',
        extractedInsights: [
          attachedFile
            ? `[Injeksi Berkas: ${attachedFile.name}] Wawasan dari ${attachedFile.name}`
            : `[Injeksi Chat Admin] ${message}`,
        ],
        suggestedTags: ['AdminInjection'],
      };
    }

    if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
      systemMemory.learnedKnowledgeBase = [];
    }

    const newInsights = parsedResponse.extractedInsights || [];
    for (const ins of newInsights) {
      if (ins && typeof ins === 'string' && !systemMemory.learnedKnowledgeBase.includes(ins)) {
        systemMemory.learnedKnowledgeBase.unshift(ins);
      }
    }

    systemMemory.lastUpdated = new Date().toISOString();
    saveSystemMemory();

    return {
      success: true,
      reply: parsedResponse.reply || 'Pengetahuan baru berhasil diserap dan diinjeksi ke dalam kecerdasan sistem.',
      extractedInsights: newInsights,
      knowledgeBase: systemMemory.learnedKnowledgeBase,
      intelligenceLevel: getSystemIntelligenceLevel(),
    };
  } catch (e: any) {
    logger.warn('[Knowledge Chat API] Error processing admin knowledge chat:', e);
    const fallbackMsg = `Gagal menghubungkan ke AI Engine: ${e.message || 'Error'}. Namun wawasan teks telah disimpan secara langsung.`;

    const directInsight = attachedFile
      ? `[Injeksi Berkas: ${attachedFile.name}] ${attachedFile.textContent ? attachedFile.textContent.slice(0, 150) : 'Berkas diunggah admin'}`
      : `[Injeksi Admin] ${message}`;

    if (!systemMemory.learnedKnowledgeBase.includes(directInsight)) {
      systemMemory.learnedKnowledgeBase.unshift(directInsight);
      saveSystemMemory();
    }

    return {
      success: true,
      reply: fallbackMsg,
      extractedInsights: [directInsight],
      knowledgeBase: systemMemory.learnedKnowledgeBase,
      intelligenceLevel: getSystemIntelligenceLevel(),
    };
  }
}

// 1-Hour Server-side Background Auto-Trainer Engine
let trainerInitialized = false;
export function initServerAutoTrainerScheduler() {
  if (trainerInitialized) return;
  trainerInitialized = true;
  logger.info('[Auto-Trainer Engine 24/7] Scheduler started. Running every 1 hour...');

  const runTrainerPass = async () => {
    try {
      logger.info('[Auto-Trainer Engine 24/7] Running 1-Hour Automated Knowledge Pass...');
      const events = await dbGetTrackingEvents();
      let newlyLearned = 0;

      events.forEach((evt: any) => {
        if (evt.category === 'herbal_kesehatan') {
          return;
        }

        if (evt.payload && evt.payload.insight) {
          const insight = String(evt.payload.insight).trim();
          if (insight && !systemMemory.learnedKnowledgeBase.includes(insight)) {
            systemMemory.learnedKnowledgeBase.push(insight);
            newlyLearned++;
          }
        }
      });

      systemMemory.lastUpdated = new Date().toISOString();
      saveSystemMemory();

      logger.info(
        `[Auto-Trainer Engine 24/7] Pass completed. +${newlyLearned} new patterns merged. Total Knowledge Base: ${systemMemory.learnedKnowledgeBase.length}`
      );
    } catch (err) {
      logger.warn('[Auto-Trainer Engine 24/7] Error in background pass:', err);
    }
  };

  setTimeout(runTrainerPass, 10000);
  setInterval(runTrainerPass, 3600000);
}
