const DATAFORSEO_MAPS_ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/maps/live/advanced";

function setCors(req, res) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
    "https://rankpath.github.io,http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function normalizeName(value) {
  return cleanText(value, 200)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameScore(target, candidate) {
  const a = normalizeName(target);
  const b = normalizeName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return intersection / union;
}

function compactItem(item) {
  return {
    rank: Number(item.rank_group || item.rank_absolute || 0) || null,
    title: item.title || "",
    address: item.address || item.snippet || "",
    rating: item.rating?.value ?? null,
    reviews: item.rating?.votes_count ?? null,
    category: item.category || "",
    phone: item.phone || "",
    url: item.url || "",
    placeId: item.place_id || "",
    cid: item.cid || "",
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
  };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    businessName,
    keyword,
    location,
    languageCode = "th",
    device = "mobile",
    placeId = "",
  } = req.body || {};

  const business = cleanText(businessName, 160);
  const query = cleanText(keyword, 160);
  const locationName = cleanText(location, 180);
  const lang = cleanText(languageCode, 8).toLowerCase() || "th";
  const selectedDevice = device === "desktop" ? "desktop" : "mobile";
  const targetPlaceId = cleanText(placeId, 220);

  if (!business || !query || !locationName) {
    return res.status(400).json({
      error: "Business name, keyword and location are required.",
    });
  }

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return res.status(503).json({
      error: "Google Maps rank provider is not configured yet.",
      code: "PROVIDER_NOT_CONFIGURED",
    });
  }

  try {
    const response = await fetch(DATAFORSEO_MAPS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: query,
          location_name: locationName,
          language_code: lang,
          device: selectedDevice,
          depth: 20,
        },
      ]),
    });

    const payload = await response.json();
    const task = payload?.tasks?.[0];
    const result = task?.result?.[0];
    const rawItems = Array.isArray(result?.items) ? result.items : [];
    const mapItems = rawItems.filter((item) => item?.type === "maps_search");

    if (!response.ok || Number(task?.status_code || 0) >= 40000) {
      const message =
        task?.status_message ||
        payload?.status_message ||
        "Unable to retrieve Google Maps rankings.";
      return res.status(502).json({ error: message });
    }

    let matched = null;
    let confidence = 0;

    for (const item of mapItems) {
      if (targetPlaceId && item.place_id === targetPlaceId) {
        matched = item;
        confidence = 1;
        break;
      }

      const score = nameScore(business, item.title);
      if (score > confidence) {
        matched = item;
        confidence = score;
      }
    }

    if (confidence < 0.45) matched = null;

    const competitors = mapItems
      .filter((item) => !matched || item.place_id !== matched.place_id)
      .slice(0, 10)
      .map(compactItem);

    return res.status(200).json({
      businessName: business,
      keyword: query,
      location: locationName,
      languageCode: lang,
      device: selectedDevice,
      found: Boolean(matched),
      rank: matched ? Number(matched.rank_group || matched.rank_absolute || 0) || null : null,
      matchConfidence: matched ? Number(confidence.toFixed(2)) : 0,
      business: matched ? compactItem(matched) : null,
      competitors,
      checkedDepth: 20,
      provider: "DataForSEO Google Maps SERP",
      fetchedAt: new Date().toISOString(),
      note:
        "Google Maps rankings vary by exact search position, device, language and time. This scan checks one selected location context.",
    });
  } catch (error) {
    console.error("Google Maps rank check failed", error);
    return res.status(502).json({
      error: "Unable to reach the Google Maps rank provider. Please try again.",
    });
  }
}

export { normalizeName, nameScore, compactItem };
