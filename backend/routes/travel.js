const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const { TRAVEL_DOMAINS, LOCAL_BUSINESS_TRAVEL_DIRECTIVE } = require('../services/localBusinessTravelEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callTravelCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();

  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 30 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[TravelCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 30 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[TravelCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 30) {
      return res;
    }
  } catch (e) {
    logger.warn(`[TravelCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 30) {
      return res;
    }
  } catch (e) {
    logger.warn(`[TravelCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. List Travel Domains
router.get('/domains', (req, res) => {
  res.json({ success: true, domains: TRAVEL_DOMAINS });
});

// 2. Universal Travel & Local Business Generator
router.post('/generate', async (req, res) => {
  try {
    const {
      domain = 'travel-itinerary',
      destination = '',
      dates = '',
      budget = 'Mid-Range',
      travelers = 1,
      interests = '',
      constraints = '',
      language = 'en'
    } = req.body;

    if (!destination.trim()) {
      return res.status(400).json({ success: false, error: 'Destination is required' });
    }

    const domainDef = TRAVEL_DOMAINS[domain] || TRAVEL_DOMAINS['travel-itinerary'];

    const prompt = `You are AI-Dost's Principal Travel Intelligence & Local Business Discovery Director.
Task: Generate a world-class, comprehensive "${domainDef.name}" for the user.

Specifications:
- Domain: ${domainDef.name} (${domainDef.category})
- Destination / Location: ${destination}
${dates ? `- Travel Dates / Duration: ${dates}` : ''}
- Budget Tier: ${budget}
- Number of Travelers: ${travelers}
${interests ? `- Interests & Preferences: ${interests}` : ''}
${constraints ? `- Constraints / Dietary / Accessibility: ${constraints}` : ''}
- Preferred Language: ${language === 'hi' ? 'Hindi' : (language === 'hinglish' ? 'Hinglish' : 'English')}
- Required Output Sections: ${domainDef.outputSections.join(' → ')}

Guidelines: ${domainDef.guidelines}

Requirements:
1. Provide specific, actionable recommendations with names, addresses, approximate costs, and ratings.
2. Use formatted Markdown tables for comparisons and structured data.
3. Include local tips, best timing, and insider recommendations.
4. For Indian destinations, use ₹ prices and mention local transport options.
5. For travel itineraries, use specific time blocks (e.g. "9:00 AM - 11:30 AM").
6. Conclude with a "Pro Travel Tip" or "Money-Saving Hack" relevant to the query.`;

    const aiOutput = await callTravelCascade(prompt, LOCAL_BUSINESS_TRAVEL_DIRECTIVE);

    if (aiOutput) {
      return res.json({
        success: true,
        domain,
        destination,
        result: aiOutput
      });
    }

    // Deterministic fallback
    const fallbackResult = `## 🗺️ ${domainDef.name}: ${destination}

**Budget:** ${budget} | **Travelers:** ${travelers}

---

### 📍 Top Recommendations for ${destination}

| # | Recommendation | Type | Est. Cost | Rating |
|:--|:---|:---|:---|:---|
| 1 | Local Popular Spot | ${domainDef.category} | ₹₹ - ₹₹₹ | ⭐ 4.2+ |
| 2 | Tourist Favorite | ${domainDef.category} | ₹₹₹ | ⭐ 4.5+ |
| 3 | Hidden Gem | ${domainDef.category} | ₹ - ₹₹ | ⭐ 4.0+ |

### 💡 Key Sections
${domainDef.outputSections.map(s => `- [ ] ${s}`).join('\n')}

### 🎯 Pro Travel Tip
Research local festivals and events during your travel dates for an authentic cultural experience.

---
*Generated via AI-Dost Travel Intelligence & Local Business Discovery Suite.*
`;

    res.json({
      success: true,
      domain,
      destination,
      result: fallbackResult,
      fallback: true
    });
  } catch (err) {
    logger.error(`[TravelRoute] generate error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Quick Budget Calculator
router.post('/budget-calculator', async (req, res) => {
  try {
    const {
      destination = 'Goa',
      days = 3,
      travelers = 2,
      budget = 'Mid-Range'
    } = req.body;

    const prompt = `Calculate a detailed travel budget for ${travelers} traveler(s) visiting ${destination} for ${days} days at ${budget} tier.

Provide:
1. Accommodation cost (per night × ${days} nights)
2. Food budget (3 meals × ${days} days × ${travelers} people)
3. Local transport (auto/cab/metro per day × ${days})
4. Inter-city transport (to and from ${destination})
5. Activity & entry fees
6. Shopping & souvenirs buffer
7. Emergency contingency (10-15%)
8. GRAND TOTAL

Use ₹ for Indian destinations. Format as a clear Markdown table.`;

    const aiOutput = await callTravelCascade(prompt, LOCAL_BUSINESS_TRAVEL_DIRECTIVE);

    res.json({
      success: true,
      destination,
      days,
      travelers,
      budget: aiOutput || `Budget estimate for ${destination}: Approximately ₹${days * travelers * (budget === 'Budget' ? 1500 : budget === 'Premium' ? 8000 : 3500)}/- total`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Quick Packing Checklist
router.post('/packing-checklist', async (req, res) => {
  try {
    const {
      destination = 'Mountains',
      days = 5,
      season = 'Winter',
      activities = []
    } = req.body;

    const markdown = `## 🎒 Smart Packing Checklist

**Destination:** ${destination} | **Duration:** ${days} days | **Season:** ${season}

---

### 👕 Clothing (${season}-Adapted)
- [ ] ${season === 'Winter' ? 'Heavy jacket / windcheater' : 'Light cotton clothes'}
- [ ] ${season === 'Winter' ? 'Thermal innerwear (2 sets)' : 'Shorts / comfortable pants'}
- [ ] ${days > 3 ? `${Math.ceil(days * 0.7)} sets of clothes` : `${days} sets of clothes`}
- [ ] Comfortable walking shoes
- [ ] ${season === 'Monsoon' || season === 'Rainy' ? 'Waterproof shoes / sandals' : 'Flip flops / slippers'}
- [ ] Sleepwear

### 🧴 Toiletries & Hygiene
- [ ] Toothbrush & toothpaste
- [ ] Shampoo, soap, face wash (travel size)
- [ ] Sunscreen SPF 50+
- [ ] ${season === 'Winter' ? 'Moisturizer & lip balm' : 'Deodorant & talc'}
- [ ] Hand sanitizer & wet wipes

### 🔌 Electronics & Chargers
- [ ] Phone + charger + power bank (20000mAh)
- [ ] Earphones / headphones
- [ ] Camera (if needed)
- [ ] Universal adapter (international trips)

### 📄 Documents & ID
- [ ] Aadhar Card / Passport
- [ ] Booking confirmations (hotel, train, flight)
- [ ] Travel insurance documents
- [ ] Emergency contact list
- [ ] Cash + cards (notify bank for travel)

### 💊 Medicines & First Aid
- [ ] Personal medications
- [ ] Paracetamol, ORS, Band-aids
- [ ] Motion sickness tablets
- [ ] Mosquito repellent

${activities.length > 0 ? `### 🏔️ Activity-Specific\n${activities.map(a => `- [ ] Gear for: ${a}`).join('\n')}` : ''}

### ✅ Pre-Departure Checklist
- [ ] All doors & windows locked
- [ ] Electricity main switch off (if away 3+ days)
- [ ] Neighbors informed
- [ ] Auto-bill payments verified
- [ ] Location sharing enabled with family

---
*Generated via AI-Dost Travel Intelligence Suite.*
`;

    res.json({
      success: true,
      destination,
      checklist: markdown
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
