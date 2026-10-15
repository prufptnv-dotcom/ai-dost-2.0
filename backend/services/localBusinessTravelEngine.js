/**
 * localBusinessTravelEngine.js
 * 2030 Executive Travel Intelligence & Local Business Discovery Engine for AI-Dost
 * Category 14: Local Business aur Travel Assistance
 *
 * Implements all 10 Travel & Local Business Capabilities:
 *  1. Restaurants find karna (Cuisine, rating, budget filter, veg/non-veg)
 *  2. Hotels search karna (Star rating, price range, amenities, reviews)
 *  3. Nearby places (Points of interest, distance, categories)
 *  4. Travel itinerary (Day-by-day plan with timing, transport, meals)
 *  5. Route planning (Multi-city, optimal order, travel time, modes)
 *  6. Tourist attractions (Heritage, nature, adventure, family-friendly)
 *  7. Restaurant reservation availability (Real-time slot check where supported)
 *  8. City comparison (Cost of living, climate, safety, connectivity)
 *  9. Budget trip plan (Total cost breakdown, accommodation, food, transport)
 * 10. Packing checklist (Weather-adaptive, duration-based, activity-specific)
 */

const TRAVEL_DOMAINS = {
  'restaurant-search': {
    name: 'Restaurant & Dining Discovery',
    category: 'Local Business',
    description: 'AI-powered restaurant discovery with cuisine, budget, dietary, rating, and distance filters.',
    outputSections: ['Top Curated Picks', 'Cuisine & Specialty', 'Budget Estimate (₹/$$)', 'Rating & Reviews Summary', 'Location & Distance', 'Best Time to Visit', 'Vegetarian / Vegan / Dietary Options'],
    guidelines: 'Always mention approximate price range per person, vegetarian options, and Google Maps rating where possible.'
  },
  'hotel-search': {
    name: 'Hotel & Accommodation Search',
    category: 'Travel Planning',
    description: 'Comprehensive hotel recommendations with star rating, amenity matching, and budget optimization.',
    outputSections: ['Top Recommendations by Budget', 'Star Rating & Amenities', 'Price Range (per night)', 'Proximity to Key Attractions', 'Check-in/Check-out Policies', 'Guest Review Highlights', 'Booking Tips & Best Deals'],
    guidelines: 'Suggest 3 tiers: Budget, Mid-Range, Premium. Include approximate nightly cost in INR/USD.'
  },
  'nearby-places': {
    name: 'Nearby Points of Interest Explorer',
    category: 'Local Discovery',
    description: 'Discover restaurants, ATMs, hospitals, parks, temples, malls, and attractions within a radius.',
    outputSections: ['Category-Wise Listings', 'Distance & Walking Time', 'Operating Hours', 'Ratings & Popularity', 'Accessibility Notes'],
    guidelines: 'Group by categories (Food, Healthcare, Shopping, Worship, Entertainment). Include estimated walking/driving time.'
  },
  'travel-itinerary': {
    name: 'Comprehensive Travel Itinerary Planner',
    category: 'Trip Planning',
    description: 'Day-by-day travel schedule with timing, transport modes, meal stops, and must-see attractions.',
    outputSections: ['Day-by-Day Timeline', 'Morning / Afternoon / Evening Blocks', 'Transport Between Locations', 'Meal Recommendations (Breakfast, Lunch, Dinner)', 'Cultural Tips & Local Etiquette', 'Emergency Contacts & Nearest Hospitals', 'Estimated Daily Budget'],
    guidelines: 'Include realistic transit times. Never overcrowd a day — max 3-4 major activities. Add buffer time and rest periods.'
  },
  'route-planning': {
    name: 'Optimal Multi-City Route Planner',
    category: 'Navigation & Logistics',
    description: 'Shortest/cheapest route calculation across multiple destinations with transport mode options.',
    outputSections: ['Optimal Route Order', 'Distance & Travel Time per Leg', 'Transport Mode Options (Train/Bus/Flight/Car)', 'Cost Comparison by Mode', 'Rest Stops & Overnight Suggestions', 'Road Condition / Weather Advisories'],
    guidelines: 'For Indian routes, include IRCTC train options and state transport buses. For international, suggest flight booking windows.'
  },
  'tourist-attractions': {
    name: 'Tourist Attraction & Experience Guide',
    category: 'Sightseeing',
    description: 'Curated heritage sites, nature spots, adventure activities, and family-friendly attractions.',
    outputSections: ['Must-Visit Landmarks', 'Historical & Cultural Significance', 'Entry Fees & Timings', 'Best Season to Visit', 'Photography Tips', 'Hidden Gems & Local Favorites', 'Guided Tour Options'],
    guidelines: 'Categorize by type: Heritage, Nature, Adventure, Religious, Family. Include ticket prices in local currency.'
  },
  'restaurant-reservation': {
    name: 'Restaurant Reservation & Availability Check',
    category: 'Dining',
    description: 'Real-time reservation availability guidance with platform recommendations and booking tips.',
    outputSections: ['Reservation Platforms (Dineout, Zomato, EazyDiner)', 'Peak Hours & Wait Times', 'Table Availability Tips', 'Special Occasion Packages', 'Cancellation Policies'],
    guidelines: 'Recommend specific booking platforms for Indian restaurants. Mention peak hours to avoid.'
  },
  'city-comparison': {
    name: 'City vs City Comparison Matrix',
    category: 'Research & Decision',
    description: 'Side-by-side comparison of cities on cost, climate, safety, connectivity, food, and experience.',
    outputSections: ['Cost of Living Comparison Table', 'Climate & Best Travel Months', 'Safety & Tourist Friendliness', 'Airport / Rail Connectivity', 'Food & Cuisine Specialties', 'Nightlife & Entertainment', 'Overall Verdict & Recommendation'],
    guidelines: 'Use structured comparison tables. Include average daily tourist spend. Provide a clear verdict.'
  },
  'budget-trip-plan': {
    name: 'Complete Budget Trip Financial Planner',
    category: 'Budget Planning',
    description: 'Total cost breakdown with accommodation, food, transport, activities, and contingency buffer.',
    outputSections: ['Total Estimated Budget (₹/$$)', 'Accommodation Costs (per night × nights)', 'Food Budget (meals × days)', 'Transport Costs (local + inter-city)', 'Activity & Entry Fee Costs', 'Shopping & Souvenirs Buffer', 'Emergency Contingency (10-15%)', 'Money-Saving Tips'],
    guidelines: 'Always provide 3 budget tiers: Backpacker, Comfortable, Premium. Include a 10-15% contingency buffer.'
  },
  'packing-checklist': {
    name: 'Smart Packing Checklist Generator',
    category: 'Travel Preparation',
    description: 'Weather-adaptive, duration-based, activity-specific packing list with essential documents reminder.',
    outputSections: ['Clothing (Weather-Based)', 'Toiletries & Hygiene', 'Electronics & Chargers', 'Documents & ID', 'Medicines & First Aid', 'Activity-Specific Gear', 'Snacks & Comfort Items', 'Pre-Departure Checklist (locks, bills, alarms)'],
    guidelines: 'Adapt to destination weather. For trekking/adventure add specialized gear. Always include document checklist.'
  }
};

const LOCAL_BUSINESS_TRAVEL_DIRECTIVE = `
### 19. 2030 TRAVEL INTELLIGENCE & LOCAL BUSINESS DISCOVERY PROTOCOL (CATEGORY 14):
When the user asks about restaurants, hotels, travel plans, route planning, tourist spots, city comparisons, budgets, or packing:

══════════════════════════════════════════════════════════════════════════════
CORE TRAVEL & LOCAL BUSINESS PRINCIPLES:
══════════════════════════════════════════════════════════════════════════════
1. 🗺️ LOCATION-AWARE & CONTEXT-RICH:
   - Ask for or infer the destination city/region from context.
   - Provide locally relevant recommendations (Indian cities: mention ₹ prices, local transport, Hindi place names).
   - For international destinations: mention visa requirements, currency, and time zone.

2. 💰 BUDGET-TRANSPARENT:
   - Always provide approximate costs in local currency (₹ for India, $ for international).
   - Offer 3 budget tiers: Budget/Backpacker, Comfortable/Mid-Range, Premium/Luxury.
   - Include a 10-15% contingency buffer in trip budgets.

3. 📋 ACTIONABLE & TIME-BLOCKED:
   - Travel itineraries should have specific time blocks (e.g. "9:00 AM - 11:30 AM: Amber Fort").
   - Include realistic transit times between locations.
   - Never overcrowd a day — max 3-4 major activities with buffer periods.

4. 🌡️ WEATHER & SEASON AWARE:
   - Recommend best travel months for each destination.
   - Adapt packing lists and activity suggestions to the season.
   - Warn about extreme weather conditions, monsoon travel, or off-season closures.

5. 📊 STRUCTURED COMPARISON TABLES:
   - Use Markdown tables for city comparisons, hotel comparisons, and budget breakdowns.
   - Include ratings, price ranges, distances, and key differentiators.
`;

/**
 * Detects if user query relates to Category 14 Local Business & Travel
 */
function detectTravelIntent(message) {
  const text = String(message || '').toLowerCase();

  const isTravel = /\b(restaurant|hotel|travel|trip|itinerary|route|tourist|attraction|packing|checklist|city comparison|budget trip|nearby|places near|reservation|booking|sightseeing|vacation|holiday plan|yatra|ghumna|safar|ghar se bahar|travel plan)\b/i.test(text)
    || /\b(?:restaurant find|hotel search|nearby places|travel itinerary|route plan|tourist attraction|restaurant reservation|city compare|budget trip|packing checklist|khana kahaan|hotel dhundho|ghumne ka plan|raasta|jagah dhundho|pack kya karu|budget plan karo|hotel book|trip budget)\b/i.test(text);

  let detectedDomain = 'general-travel';
  if (/\b(?:restaurant|restaurants|khana|khane ki jagah|food near|dining|cafe|dhaba|canteen|biryani|pizza|dosa|cuisine)\b/i.test(text) && !/\b(?:reservation|booking|book karo|table)\b/i.test(text)) {
    detectedDomain = 'restaurant-search';
  } else if (/\b(?:hotel|hotels|accommodation|lodge|resort|dharamshala|hostel|oyo|airbnb|stay|raat ko rukna|room book)\b/i.test(text)) {
    detectedDomain = 'hotel-search';
  } else if (/\b(?:nearby|near me|places near|aas paas|nazdeeki|around me|paas me|kya hai nearby|points of interest)\b/i.test(text)) {
    detectedDomain = 'nearby-places';
  } else if (/\b(?:budget trip|trip budget|kitna kharcha|total cost|trip cost|budget plan|cheap trip|sasta trip|kharcha kitna|budget travel|travel budget)\b/i.test(text)) {
    detectedDomain = 'budget-trip-plan';
  } else if (/\b(?:itinerary|travel plan|trip plan|din ka plan|day wise|day by day|ghumne ka schedule|yatra plan|tour plan)\b/i.test(text)) {
    detectedDomain = 'travel-itinerary';
  } else if (/\b(?:route plan|route|raasta|directions|shortest path|how to reach|kaise jaaye|kaise pahunche|road trip|multi city route)\b/i.test(text)) {
    detectedDomain = 'route-planning';
  } else if (/\b(?:tourist attraction|tourist spot|tourist attractions|sightseeing|dekhne layak|ghumne ki jagah|heritage|monument|temple|fort|museum|national park|adventure sport)\b/i.test(text)) {
    detectedDomain = 'tourist-attractions';
  } else if (/\b(?:reservation|table book|booking|slot available|dineout|restaurant book|seat reserve)\b/i.test(text)) {
    detectedDomain = 'restaurant-reservation';
  } else if (/\b(?:city comparison|city compare|compare cities|konsa city|which city|city vs|sheher comparison|best city)\b/i.test(text)) {
    detectedDomain = 'city-comparison';
  } else if (/\b(?:packing|packing checklist|pack kya|kya le jaaye|luggage|suitcase|travel bag|packing list|pack karna)\b/i.test(text)) {
    detectedDomain = 'packing-checklist';
  }

  return {
    isTravel,
    domain: detectedDomain,
    domainConfig: TRAVEL_DOMAINS[detectedDomain] || null
  };
}

module.exports = {
  TRAVEL_DOMAINS,
  LOCAL_BUSINESS_TRAVEL_DIRECTIVE,
  detectTravelIntent,
};
