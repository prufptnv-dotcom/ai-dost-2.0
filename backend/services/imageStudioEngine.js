/**
 * imageStudioEngine.js
 * 2030 Ultra-HD Image Generation & Editing Engine for AI-Dost
 * Covers all 17 Capabilities of Category 3:
 * 1. Logo
 * 2. YouTube banner
 * 3. Poster
 * 4. Thumbnail
 * 5. Character design
 * 6. Anime-style artwork
 * 7. Realistic portrait
 * 8. Infographic
 * 9. Concept art
 * 10. Product mockup
 * 11. UI design concept
 * 12. Book cover
 * 13. Social media post
 * 14. Background removal/changes
 * 15. Object add/remove
 * 16. Style transformation
 * 17. Image enhancement
 */

const IMAGE_STUDIO_DIRECTIVE = `
### 8. IMAGE GENERATION & EDITING PROTOCOL (CATEGORY 3):
When the user asks to generate, design, or edit visual assets, graphics, or photographs:

1. LOGO DESIGN:
   - Minimalist vector, geometric emblem, modern flat design or 3D metallic badge.
   - Clean negative space, scalable icon mark, isolated on neutral dark or solid background.
   - Tag: [GENERATE_IMAGE: minimalist modern vector logo for <brand>, clean lines, flat geometry, professional branding mark, isolated on dark background, vector art, 8k]

2. YOUTUBE BANNER:
   - 16:9 panoramic ratio (2560x1440), focal action centered within the 1546x423 mobile-safe zone.
   - Epic channel branding, atmospheric lighting, high dynamic range.
   - Tag: [GENERATE_IMAGE: ultra-wide YouTube channel art banner, <topic>, centered composition, cinematic lighting, 4k resolution, panoramic 16:9, modern digital art]

3. POSTER DESIGN:
   - Vertical composition (2:3 or 3:4 ratio), dramatic key lighting, strong typographic headroom, theatrical atmosphere.
   - Tag: [GENERATE_IMAGE: vertical theatrical movie poster, <topic>, dramatic key lighting, intense cinematic atmosphere, room for typography, award-winning visual, 8k]

4. YOUTUBE THUMBNAIL:
   - High-CTR composition (16:9), bold expressive facial reaction or focal subject, high contrast saturation, rim lighting, vibrant depth.
   - Tag: [GENERATE_IMAGE: high-CTR YouTube video thumbnail, <topic>, expressive dynamic subject, vivid neon rim lighting, high contrast, clean separation from background, 8k]

5. CHARACTER DESIGN:
   - Character concept turnaround (front, 3/4 view), distinct costume details, expressive anatomy, model sheet silhouette.
   - Tag: [GENERATE_IMAGE: full-body character design concept art, <character description>, detailed outfit and accessories, dynamic pose, artstation trending, clean studio background]

6. ANIME-STYLE ARTWORK:
   - Makoto Shinkai / Ufotable / Studio Ghibli inspired cel-shading, vibrant volumetric skies, luminous eyes, dynamic light bloom.
   - Tag: [GENERATE_IMAGE: masterwork anime illustration, <subject>, Makoto Shinkai aesthetic, luminous clouds, vibrant color palette, octane render, beautiful detailed lighting]

7. REALISTIC PORTRAIT:
   - 8k photorealism, authentic skin pores, subsurface scattering, 85mm f/1.4 shallow depth of field, natural studio catchlights.
   - Tag: [GENERATE_IMAGE: ultra-photorealistic 8k studio portrait, <subject>, 85mm portrait lens, f/1.4 aperture, natural skin texture, soft rim lighting, award-winning photography]

8. INFOGRAPHIC & DATA VISUALS:
   - Clean isometric 3D illustrations, modular process steps, modern tech palette, organized visual hierarchy.
   - Tag: [GENERATE_IMAGE: modern isometric 3D infographic illustration, <topic>, clean data visual workflow, modern glassmorphic icons, tech corporate color scheme, crisp 8k render]

9. CONCEPT ART & WORLD-BUILDING:
   - Environmental matte painting, epic scale, atmospheric perspective, cinematic fog and volumetric god-rays.
   - Tag: [GENERATE_IMAGE: epic environmental concept art, <landscape/city>, vast scale, atmospheric perspective, cinematic lighting, matte painting, Unreal Engine 5 render]

10. PRODUCT MOCKUP:
    - Commercial studio photography, acrylic or matte pedestal, controlled specular highlights, soft ambient occlusion shadows.
    - Tag: [GENERATE_IMAGE: commercial product mockup photography, <product>, centered on modern minimalist pedestal, soft studio lightbox reflections, clean sharp focus, 8k commercial shot]

11. UI DESIGN CONCEPT:
    - Modern 2030 dashboard / mobile app interface, dark glassmorphism, sleek typography, vibrant gradient glow accents.
    - Tag: [GENERATE_IMAGE: 2030 futuristic UI/UX dashboard design concept, <app type>, sleek dark mode, glassmorphic cards, vibrant neon accents, Figma trending, crisp clean layout]

12. BOOK COVER:
    - Evocative focal subject, atmospheric depth, dedicated header and footer space for title and author name.
    - Tag: [GENERATE_IMAGE: bestselling book cover art, <genre/theme>, evocative central illustration, mysterious cinematic lighting, ample negative space for title, 8k resolution]

13. SOCIAL MEDIA POST:
    - 1:1 square or 9:16 vertical ratio, eye-catching color contrast, modern editorial layout, dynamic gradients.
    - Tag: [GENERATE_IMAGE: viral social media marketing post visual, <topic>, bold modern aesthetics, vibrant gradient background, clean visual punch, 4k digital design]

14. EDITING - BACKGROUND REMOVAL & REPLACEMENT:
    - Formulate prompt to extract subject and place into the specified studio, cyber, nature, or solid backdrop.
    - Tag: [GENERATE_IMAGE: <original subject> with background cleanly replaced by <new background>, seamless edge blending, realistic matching lighting, 8k]

15. EDITING - OBJECT ADDITION / REMOVAL:
    - Describe modified scene with the target object seamlessly integrated with accurate perspective and shadows.
    - Tag: [GENERATE_IMAGE: <base scene> with <object> seamlessly added, matching shadows, natural ambient occlusion, realistic blending, 8k]

16. STYLE TRANSFORMATION:
    - Re-render the existing concept in the new target medium (e.g. Photo to Cyberpunk, Sketch to 3D, Real to Anime).
    - Tag: [GENERATE_IMAGE: <subject> transformed into <target style>, retaining original composition and pose, authentic style textures, high quality]

17. IMAGE ENHANCEMENT:
    - Upscale, expand dynamic range, sharpen micro-textures, and enrich HDR color grading.
    - Tag: [GENERATE_IMAGE: remastered 8k ultra-sharp version of <subject>, high dynamic range, crisp micro-details, enhanced studio lighting, professional remaster]
`;

const CATEGORY_PRESETS = {
  'logo': {
    name: 'Logo Design',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'minimalist vector logo, clean lines, flat geometry, modern emblem, vector art, svg aesthetic, isolated on dark background, 8k, professional branding',
    negative: 'photograph, complex realistic textures, messy gradient, watermark, text noise'
  },
  'youtube-banner': {
    name: 'YouTube Banner',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    enhancer: 'ultra-wide YouTube channel art banner, centered subject composition within safe area, 16:9 panoramic, cinematic lighting, 4k resolution, high dynamic range',
    negative: 'vertical crop, off-center focal blur, low resolution, clipped text'
  },
  'poster': {
    name: 'Poster Design',
    aspectRatio: '3:4',
    width: 768,
    height: 1024,
    enhancer: 'cinematic vertical theatrical poster, dramatic lighting, rich atmosphere, room for typography, award-winning visual composition, 8k artstation',
    negative: 'horizontal format, messy borders, low contrast'
  },
  'thumbnail': {
    name: 'YouTube Thumbnail',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    enhancer: 'high-CTR YouTube video thumbnail, vibrant colors, expressive subject with dynamic reaction, vivid neon rim lighting, high contrast, clean subject separation, 8k',
    negative: 'dull colors, low contrast, washed out, blurry facial features'
  },
  'character-design': {
    name: 'Character Design',
    aspectRatio: '3:4',
    width: 768,
    height: 1024,
    enhancer: 'full body character design, concept art turnaround, detailed outfit and armor, dynamic pose, artstation trending, clean studio backdrop, sharp lineart',
    negative: 'cropped body, missing limbs, distorted anatomy, blurry face'
  },
  'anime-artwork': {
    name: 'Anime-Style Artwork',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    enhancer: 'masterpiece anime illustration, Makoto Shinkai and Ufotable aesthetic, cel-shaded characters, luminous sky with clouds, vibrant lighting bloom, octane render',
    negative: 'photorealistic western, 3d clay, low quality drawing, bad lineart'
  },
  'realistic-portrait': {
    name: 'Realistic Portrait',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'ultra-photorealistic 8k studio portrait photography, natural skin pores, subsurface scattering, 85mm f/1.4 lens, cinematic soft rim lighting, award-winning shot',
    negative: 'airbrushed, plastic doll skin, cartoon, anime, illustration, oversaturated'
  },
  'infographic': {
    name: 'Infographic Design',
    aspectRatio: '3:4',
    width: 768,
    height: 1024,
    enhancer: 'modern isometric 3D infographic illustration, clean visual data flow, sleek glassmorphic icons, structured visual hierarchy, tech enterprise aesthetic',
    negative: 'messy sketch, hand-drawn, blurry icons, disorganized layout'
  },
  'concept-art': {
    name: 'Concept Art',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    enhancer: 'epic environmental concept art, vast scale, atmospheric perspective, matte painting, volumetric lighting and god-rays, Unreal Engine 5 render, artstation trending',
    negative: 'close-up portrait, flat 2d cartoon, simple geometry'
  },
  'product-mockup': {
    name: 'Product Mockup',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'commercial product mockup photography, centered on minimalist pedestal, soft studio lightbox reflections, sharp depth of field, premium material finish, 8k',
    negative: 'messy background, hand-held, blurry reflections, amateur snapshot'
  },
  'ui-design': {
    name: 'UI Design Concept',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    enhancer: 'futuristic 2030 dashboard UI design concept, dark mode, glassmorphic cards, vibrant neon accent lines, modern typography, Figma Dribbble trending interface',
    negative: 'ugly 1990s bevels, clip art, low resolution screenshot, bad alignment'
  },
  'book-cover': {
    name: 'Book Cover',
    aspectRatio: '3:4',
    width: 768,
    height: 1024,
    enhancer: 'bestselling novel book cover art, evocative central illustration, mysterious cinematic key lighting, ample negative space for title and author typography, 8k',
    negative: 'horizontal landscape, cluttered text areas, cheap template look'
  },
  'social-media-post': {
    name: 'Social Media Post',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'viral social media post visual, bold contemporary design, vibrant gradient background, clean visual punch, eye-catching color contrast, 4k digital design',
    negative: 'boring flat background, low contrast, washed out colors'
  },
  'background-change': {
    name: 'Background Removal / Change',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'subject with background cleanly isolated and replaced, seamless edge blending, matching environmental ambient lighting, professional studio composite',
    negative: 'jagged cutout edges, halo artifacts, mismatched lighting shadows'
  },
  'object-add-remove': {
    name: 'Object Add / Remove',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'photorealistic composition with targeted element seamlessly integrated, precise cast shadows, accurate perspective geometry, 8k clean composite',
    negative: 'floating objects, inconsistent perspective, bad shadows'
  },
  'style-transformation': {
    name: 'Style Transformation',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'transformed into distinct artistic style, rich authentic medium textures, retaining core subject silhouette and composition, masterpiece quality',
    negative: 'half-rendered, distorted faces, muddy texture blending'
  },
  'image-enhancement': {
    name: 'Image Enhancement',
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    enhancer: 'remastered 8k ultra-sharp photograph, enhanced micro-details, expanded high dynamic range, HDR color grading, crystal clear focus, studio polish',
    negative: 'digital noise, compression artifacts, pixelation, motion blur'
  }
};

/**
 * Builds an enhanced prompt and dimensions based on Category 3 requirements
 */
function buildEnhancedImageRequest(prompt, category = 'default', customDimensions = null) {
  const cleanPrompt = String(prompt || '').trim();
  const preset = CATEGORY_PRESETS[category];

  if (!preset) {
    return {
      prompt: cleanPrompt,
      width: customDimensions?.width || 1024,
      height: customDimensions?.height || 1024,
      category: 'general',
      negative: ''
    };
  }

  const enhancedPrompt = `${cleanPrompt}, ${preset.enhancer}`;
  const width = customDimensions?.width || preset.width;
  const height = customDimensions?.height || preset.height;

  return {
    prompt: enhancedPrompt,
    width,
    height,
    category,
    aspectRatio: preset.aspectRatio,
    negative: preset.negative
  };
}

/**
 * Automatically classifies user request into one of the 17 Category 3 types
 */
function detectImageCategory(userText) {
  const text = String(userText || '').toLowerCase();

  if (/\b(?:logo|icon|brand mark|emblem|badge|company logo)\b/i.test(text)) return 'logo';
  if (/\b(?:youtube banner|channel banner|channel art|header banner)\b/i.test(text)) return 'youtube-banner';
  if (/\b(?:poster|movie poster|theatrical poster|event poster)\b/i.test(text)) return 'poster';
  if (/\b(?:thumbnail|yt thumbnail|video thumbnail|clickbait)\b/i.test(text)) return 'thumbnail';
  if (/\b(?:character design|character concept|turnaround|full body character|model sheet)\b/i.test(text)) return 'character-design';
  if (/\b(?:anime|manga|ghibli|shinkai|ufotable|cel-shaded)\b/i.test(text)) return 'anime-artwork';
  if (/\b(?:portrait|realistic portrait|headshot|face photo|human photo)\b/i.test(text)) return 'realistic-portrait';
  if (/\b(?:infographic|data visual|isometric diagram|flowchart visual|process chart)\b/i.test(text)) return 'infographic';
  if (/\b(?:concept art|matte painting|environment concept|sci-fi landscape|fantasy world)\b/i.test(text)) return 'concept-art';
  if (/\b(?:product mockup|mockup|packaging|commercial product|pedestal shot)\b/i.test(text)) return 'product-mockup';
  if (/\b(?:ui design|ui concept|ux mockup|dashboard ui|app interface|figma design)\b/i.test(text)) return 'ui-design';
  if (/\b(?:book cover|novel cover|cover art|front cover)\b/i.test(text)) return 'book-cover';
  if (/\b(?:social media post|instagram post|ig post|story visual|social post)\b/i.test(text)) return 'social-media-post';
  if (/\b(?:remove background|background change|replace background|cutout|transparent bg)\b/i.test(text)) return 'background-change';
  if (/\b(?:add object|remove object|inpaint|generative fill)\b/i.test(text)) return 'object-add-remove';
  if (/\b(?:style transform|transform style|convert to style|style transfer)\b/i.test(text)) return 'style-transformation';
  if (/\b(?:enhance image|upscale|sharpen|hdr enhance|remaster|enhance quality)\b/i.test(text)) return 'image-enhancement';

  return 'general';
}

module.exports = {
  IMAGE_STUDIO_DIRECTIVE,
  CATEGORY_PRESETS,
  buildEnhancedImageRequest,
  detectImageCategory,
};
