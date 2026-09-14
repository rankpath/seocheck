const DATAFORSEO_ENDPOINT =
  "https://api.dataforseo.com/v3/on_page/instant_pages";

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

function validPublicUrl(value) {
  try {
    const url = new URL(value);
    const blocked = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !blocked.test(url.hostname);
  } catch {
    return false;
  }
}

function textLength(value) {
  return typeof value === "string" ? value.trim().length : 0;
}

function wordCount(item) {
  return Number(item?.meta?.content?.plain_text_word_count || item?.content?.plain_text_word_count || 0);
}

function add(list, title, detail, priority) {
  list.push({ title, detail, priority });
}

function buildReport(item, keyword) {
  const checks = item.checks || {};
  const meta = item.meta || {};
  const content = meta.content || item.content || {};
  const title = meta.title || item.title || "";
  const description = meta.description || item.description || "";
  const h1 = Array.isArray(meta.htags?.h1) ? meta.htags.h1 : [];
  const canonical = meta.canonical || item.canonical || "";
  const words = wordCount(item);
  const critical = [];
  const warning = [];
  const passed = [];
  const target = String(keyword || "").trim().toLowerCase();

  if (!item.is_resource && item.status_code >= 400) {
    add(critical, `Page returned HTTP ${item.status_code}`, "Search engines and visitors may not be able to access this page.", "High");
  } else {
    add(passed, "Page is accessible", `The page returned HTTP ${item.status_code || 200}.`, "Low");
  }

  if (!h1.length || checks.no_h1_tag) {
    add(critical, "Missing H1 tag", "Add one clear H1 that describes the page's main topic.", "High");
  } else if (h1.length > 1 || checks.has_multiple_h1_tags) {
    add(warning, "Multiple H1 headings found", "Use one primary H1 and organise supporting sections with H2/H3 headings.", "Medium");
  } else {
    add(passed, "H1 heading found", "The page has one primary H1 heading.", "Low");
  }

  if (!title || checks.no_title) {
    add(critical, "Missing title tag", "Add a unique title that matches the page intent.", "High");
  } else if (textLength(title) < 30 || textLength(title) > 65) {
    add(warning, "Title length could be improved", `The title is ${textLength(title)} characters; aim for roughly 30–65.`, "Medium");
  } else {
    add(passed, "Title tag length is healthy", `The title is ${textLength(title)} characters.`, "Low");
  }

  if (!description || checks.no_description) {
    add(critical, "Missing meta description", "Add a persuasive description aligned with the search intent.", "High");
  } else if (textLength(description) < 70 || textLength(description) > 170) {
    add(warning, "Meta description length could be improved", `The description is ${textLength(description)} characters; aim for roughly 70–170.`, "Medium");
  } else {
    add(passed, "Meta description found", "The page has a useful meta description.", "Low");
  }

  if (item.is_https) add(passed, "HTTPS is enabled", "The page uses a secure HTTPS connection.", "Low");
  else add(critical, "HTTPS is not enabled", "Serve the page securely over HTTPS.", "High");

  if (item.is_broken || checks.is_broken) {
    add(critical, "Page is marked as broken", "Resolve the response, redirect or rendering problem before further optimisation.", "High");
  }
  if (item.is_redirect || checks.is_redirect) {
    add(warning, "URL redirects", "Audit the final destination and use the final URL in internal links.", "Medium");
  }
  if (!canonical || checks.no_canonical) {
    add(warning, "Canonical URL not found", "Add a self-referencing canonical unless another canonical is intentional.", "Medium");
  } else {
    add(passed, "Canonical URL found", "A canonical URL is declared.", "Low");
  }
  if (checks.no_favicon) add(warning, "Favicon not found", "Add a favicon to strengthen brand recognition in browser and search surfaces.", "Low");
  if (checks.no_image_alt) add(warning, "Some images are missing alt text", "Add descriptive alt text to meaningful images.", "Medium");
  if (checks.has_render_blocking_resources) add(warning, "Render-blocking resources detected", "Defer or optimise non-critical CSS and JavaScript.", "Medium");
  if (checks.high_loading_time || Number(item.time_to_interactive) > 3) add(warning, "Page speed needs attention", "Reduce loading and interaction time, especially on mobile.", "High");

  if (words && words < 250) {
    add(warning, "Content depth may be limited", `The page contains approximately ${words} words. Add useful content where the search intent requires it.`, "Medium");
  } else if (words) {
    add(passed, "Content depth checked", `The page contains approximately ${words} words.`, "Low");
  }

  if (target) {
    const inTitle = title.toLowerCase().includes(target);
    const inH1 = h1.some((heading) => String(heading).toLowerCase().includes(target));
    if (!inTitle) add(warning, "Target keyword is not in the title", "Use the target topic naturally in the title when it matches the page intent.", "Medium");
    else add(passed, "Target keyword appears in the title", "The title aligns with the submitted keyword.", "Low");
    if (!inH1) add(warning, "Target keyword is not prominent in the H1", "Align the main heading with the target topic without keyword stuffing.", "Medium");
    else add(passed, "Target keyword appears in the H1", "The main heading aligns with the submitted keyword.", "Low");
  }

  const schemaCount = Number(content.schema_types?.length || meta.schema_types?.length || 0);
  if (schemaCount) add(passed, "Structured data detected", `${schemaCount} schema type${schemaCount === 1 ? "" : "s"} detected for search and AI systems.`, "Low");
  else add(warning, "Structured data not detected", "Add relevant schema to clarify the business, service and page entities.", "Medium");

  const total = critical.length + warning.length + passed.length;
  const rawScore = total ? Math.round(((passed.length + warning.length * 0.35) / total) * 100) : 0;
  const providerScore = Number(item.onpage_score || item.page_score || 0);

  return {
    score: providerScore ? Math.round(providerScore) : rawScore,
    critical,
    warning,
    passed,
    meta: {
      provider: "DataForSEO",
      fetchedAt: new Date().toISOString(),
      statusCode: item.status_code || null,
      wordCount: words || null,
    },
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url, keyword = "" } = req.body || {};
  if (!validPublicUrl(url)) return res.status(400).json({ error: "Please enter a valid public http(s) URL." });

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return res.status(503).json({ error: "SEO provider credentials are not configured." });

  try {
    const response = await fetch(DATAFORSEO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url, enable_javascript: true, load_resources: true }]),
    });
    const payload = await response.json();
    const task = payload?.tasks?.[0];
    const item = task?.result?.[0]?.items?.[0];

    if (!response.ok || Number(task?.status_code || 0) >= 40000 || !item) {
      const message = task?.status_message || payload?.status_message || "The SEO provider could not analyse this page.";
      return res.status(502).json({ error: message });
    }

    return res.status(200).json(buildReport(item, keyword));
  } catch (error) {
    console.error("DataForSEO analysis failed", error);
    return res.status(502).json({ error: "Unable to reach the SEO analysis provider. Please try again." });
  }
}

export { buildReport, validPublicUrl };
