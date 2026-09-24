/**
 * Determinstic LLM Mock Fixtures for Offline Unit & Integration Testing
 */

export const MOCK_CONTENT_IDEAS_RESPONSE = {
  niche: 'kuliner pedas',
  audience: 'Gen-Z & Foodies',
  ideas: [
    {
      id: 'idea_01',
      title: 'Review Seblak Level 100 Super Pedas',
      hook: 'Berani makan seblak ini, siap-siap lidah kebakar!',
      concept: 'Food challenge mukbang seblak kuah merah merona dengan topping komplit.',
      estimatedDuration: '45-60 detik',
      viralityScore: 92,
      targetAudience: 'Pecinta kuliner pedas',
      callToAction: 'Tag temanmu yang berani coba level ini!'
    },
    {
      id: 'idea_02',
      title: 'Rahasia Sambal Bawang Awet 1 Bulan Tanpa Pengawet',
      hook: 'Jangan buang cabe layu! Bikin sambal ini tahan sebulan.',
      concept: 'Tutorial tips & trik dapur memasak sambal bawang gurih dengan minyak panas.',
      estimatedDuration: '30-45 detik',
      viralityScore: 88,
      targetAudience: 'Ibu rumah tangga & anak kos',
      callToAction: 'Simpan video ini biar nggak lupa resepnya!'
    }
  ]
};

export const MOCK_TIKTOK_SHOP_IDEAS_RESPONSE = {
  productCategory: 'Fashion Muslim / Hijab',
  productName: 'Pashmina Silk Premium Anti Kusut',
  contentAngles: [
    {
      angleType: 'Problem-Solution',
      hook: 'Capek hijab letoy dan kusut pas kondangan?',
      contentConcept: 'Demonstrasi pashmina anti kusut yang tetap tegak seharian tanpa disetrika berulang kali.',
      sellingPoints: ['Bahan adem', 'Tidak terawang', 'Tegak di dahi'],
      conversionTactic: 'Flash sale khusus live hari ini diskon 30%!'
    }
  ]
};

export const MOCK_PHOTO_PROMPTS_RESPONSE = {
  subject: 'Cyberpunk barista in neon futuristic coffee shop',
  aspectRatio: '16:9',
  prompts: [
    {
      style: 'Ultra-Realistic 8K',
      prompt: 'A cinematic hyperrealistic photo of a futuristic cyborg barista crafting latte art in a rain-soaked cyberpunk Tokyo coffee shop, neon glowing blues and purples, octane render 8k, photorealistic depth of field.',
      negativePrompt: 'blurry, low quality, distorted hands, out of focus',
      lighting: 'Atmospheric neon backlight',
      cameraSettings: '50mm f/1.2 lens, ISO 400'
    }
  ]
};

export const MOCK_MALFORMED_NON_JSON = `
Ini adalah output AI yang tidak mematuhi format JSON:
Halo! Berikut ide konten kamu:
1. Video mukbang
2. Video tutorial
Semoga bermanfaat!
`;

export const MOCK_TRUNCATED_JSON = `
{"niche": "fashion", "ideas": [{"id": "idea_1", "title": "Review OOTD"
`;
