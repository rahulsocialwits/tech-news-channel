const FEEDS = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "WIRED", url: "https://www.wired.com/feed/rss" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
  { name: "Android Authority", url: "https://www.androidauthority.com/feed/" },
  { name: "9to5Google", url: "https://9to5google.com/feed/" },
  { name: "Google News", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en" }
];

const GITHUB_OWNER = "rahulsocialwits";
const GITHUB_REPO = "tech-news-channel";
const GITHUB_BRANCH = "main";
const SITE_URL = "https://rahulsocialwits.github.io/tech-news-channel";
const SITE_ORIGIN = "https://rahulsocialwits.github.io";

function clean(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i");
  const m = xml.match(re);
  return m ? clean(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
}

function itemsFromFeed(xml, source) {
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)]
    .slice(0, 5)
    .map(m => {
      const x = m[0];
      return {
        source,
        title: tag(x, "title"),
        url: tag(x, "link"),
        published: tag(x, "pubDate"),
        description: tag(x, "description")
      };
    })
    .filter(x => x.title && x.url);
}

async function collectNews() {
  const results = await Promise.allSettled(FEEDS.map(async feed => {
    const r = await fetch(feed.url, {
      headers: { "User-Agent": "TechPulseNewsEngine/1.0 (+https://rahulsocialwits.github.io/tech-news-channel/)" }
    });
    if (!r.ok) throw new Error(feed.name + " HTTP " + r.status);
    return itemsFromFeed(await r.text(), feed.name);
  }));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "techpulse-story";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function readTime(content = "") {
  const text = clean(content);
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(3, Math.ceil(words / 180)) + " min read";
}

async function generateArticle(env, stories) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY secret is missing.");

  const prompt = `You are the TechPulse technology newsroom.

Using ONLY the supplied source items, select ONE timely technology story worth publishing today.

Write an original 500-700 word technology news article. Do not copy source sentences. Do not invent facts, quotes, numbers, dates, product details or claims. Use only facts supported by the supplied sources. If something is uncertain or unsupported, omit it.

Return ONLY one valid JSON object with EXACTLY these keys:
{
  "title": "string",
  "description": "short factual SEO description",
  "category": "AI",
  "labels": ["AI", "Technology"],
  "content": "<p>...</p><h2>...</h2><p>...</p>",
  "source_urls": ["https://actual-source-url"]
}

Rules:
- category must be exactly one of: AI, Cloud, Gadgets, Software, Startups, Technology.
- labels must be an array of short strings.
- content must be HTML body fragments only using p, h2, h3, ul, ol, li, strong, em and a.
- Never include markdown fences, html, head, body, script, style or navigation.
- source_urls must contain only the original source URLs supplied below and must include the URLs actually used.
- The JSON must be syntactically valid. Escape quotation marks inside JSON strings.
- Do not add any other keys.

SOURCE ITEMS:
${JSON.stringify(stories)}`;

  let response;
  let lastBody = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 3200,
        reasoning_effort: "low",
        include_reasoning: false,
        response_format: { type: "json_object" }
      })
    });

    if (response.ok) break;

    lastBody = await response.text();

    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get("Retry-After") || 20);
      await new Promise(resolve =>
        setTimeout(resolve, Math.min(Math.max(retryAfter * 1000, 12000), 40000))
      );
      continue;
    }

    throw new Error("Groq HTTP " + response.status + ": " + lastBody.slice(0, 900));
  }

  if (!response?.ok) {
    throw new Error("Groq request failed: " + lastBody.slice(0, 900));
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  let article;
  try {
    article = JSON.parse(raw);
  } catch (error) {
    throw new Error("Groq returned invalid JSON. Please retry the news job.");
  }

  const allowedCategories = ["AI", "Cloud", "Gadgets", "Software", "Startups", "Technology"];
  const category = allowedCategories.includes(article.category) ? article.category : "Technology";
  const labels = Array.isArray(article.labels)
    ? article.labels.map(x => String(x).trim()).filter(Boolean).slice(0, 8)
    : [];
  const sourceUrls = Array.isArray(article.source_urls)
    ? article.source_urls.map(x => String(x).trim()).filter(Boolean)
    : [];
  const suppliedUrls = new Set(stories.map(x => x.url));
  const validSourceUrls = sourceUrls.filter(url => suppliedUrls.has(url));

  if (!article.title || !article.content || !validSourceUrls.length) {
    throw new Error("Groq returned an incomplete article. No unsupported source URL will be published.");
  }

  return {
    title: String(article.title).trim(),
    description: String(article.description || "").trim().slice(0, 320),
    category,
    labels,
    content: String(article.content).trim(),
    source_urls: validSourceUrls
  };
}

const WORKER_VERSION = "2026-09-27-v4";
const ADMIN_EMAIL = "rahulsocialwits@gmail.com";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

function corsHeaders() {
  return { "Access-Control-Allow-Origin": SITE_ORIGIN, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}

function json(data, init = {}) {
  return Response.json(data, { ...init, headers: { ...corsHeaders(), ...(init.headers || {}) } });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function createAdminSession(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing.");
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)").bind(tokenHash, expiresAt).run();
  return { token, expiresAt };
}

async function requireAdmin(request, env) {
  if (!env.DB) return { ok: false, error: "D1 binding DB is missing." };
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return { ok: false, error: "Unauthorized" };
  const token = header.slice(7).trim();
  if (!token) return { ok: false, error: "Unauthorized" };
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare("SELECT id, expires_at FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).first();
  if (!row) return { ok: false, error: "Unauthorized" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(row.id).run();
    return { ok: false, error: "Session expired" };
  }
  return { ok: true, sessionId: row.id };
}
function githubHeaders(env) {
  if (!env || !env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is missing or Worker environment is unavailable.");
  return {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TechPulse-News-Engine"
  };
}

async function githubGet(env, path) {
  const response = await fetch(
    "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path + "?ref=" + GITHUB_BRANCH,
    { headers: githubHeaders(env) }
  );
  if (!response.ok) {
    throw new Error("GitHub GET " + path + " HTTP " + response.status + ": " + (await response.text()).slice(0, 500));
  }
  return response.json();
}

async function githubPut(env, path, content, message, sha = null) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const response = await fetch(
    "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path,
    {
      method: "PUT",
      headers: { ...githubHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error("GitHub PUT " + path + " HTTP " + response.status + ": " + (await response.text()).slice(0, 700));
  }

  return response.json();
}

async function getArticlesIndex(env) {
  const file = await githubGet(env, "data/articles.json");
  const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ""))));
  const articles = JSON.parse(decoded);
  return { file, articles: Array.isArray(articles) ? articles : [] };
}

function buildArticleHtml(article, date, pagePath) {
  const title = escapeHtml(article.title);
  const description = escapeHtml(article.description || "");
  const category = escapeHtml(article.category || "Technology");
  const image = escapeHtml(article.feature_image || "");
  const body = article.content || "";
  const sources = Array.isArray(article.source_urls) ? article.source_urls : [];

  const sourceLinks = sources.length
    ? `<section class="article-sources"><h2>Sources</h2><ul>${sources.map(url => {
        const safe = escapeHtml(url);
        return `<li><a href="${safe}" rel="nofollow noopener" target="_blank">${safe}</a></li>`;
      }).join("")}</ul></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | TechPulse</title>
<meta name="description" content="${description}">
${image ? '<meta property="og:image" content="' + image + '">': ""}
<link rel="canonical" href="${SITE_URL}/${pagePath}">
<link rel="stylesheet" href="../assets/css/style.css?v=20260927-5">
</head>
<body>
<header class="site-header">
<div class="wrap nav">
<a class="brand" href="../index.html"><span class="brand-mark">T</span><span>Tech<span>Pulse</span></span></a>
<nav id="mainNav"><a href="../index.html">Home</a><a href="../index.html#latest">Latest</a><a href="../index.html#ai">AI</a><a href="../index.html#gadgets">Gadgets</a><a href="../index.html#software">Software</a><a href="../index.html#startups">Startups</a><a href="../about.html">About</a><a href="../contact.html">Contact</a></nav>
<div class="header-tools"><button class="search-btn" id="searchToggle" aria-label="Search TechPulse">⌕</button><button class="menu-btn" id="menuToggle" aria-label="Open menu">☰</button></div>
</div>
</header>
<main>
<article class="article-page wrap">
<div class="eyebrow">${category} • NEWS</div>
<h1>${title}</h1>
<div class="meta">${escapeHtml(date)} · ${escapeHtml(readTime(body))}</div>
${image ? '<img class="article-feature-image" src="' + image + '" alt="' + title + '" width="1000" height="600" loading="eager">': ""}
<div class="article-lead">${description}</div>
<div class="article-content">${body}</div>
${sourceLinks}
<section class="article-newsletter"><div class="eyebrow">THE TECHPULSE BRIEFING</div><h2>Get important tech news without the noise.</h2><p>Enter your name and email to receive the TechPulse briefing.</p><form id="subscribeForm"><input id="subscriberName" type="text" placeholder="Your name" aria-label="Name"><input id="subscriberEmail" type="email" placeholder="Your email address" aria-label="Email" required><button class="btn" id="subscribeButton" type="submit">Subscribe</button><small id="subscribeStatus" class="subscribe-status"></small></form></section>
<div class="article-footer-links"><a href="../index.html#latest">← Back to latest news</a><a href="../contact.html">Contact TechPulse →</a></div>
</article>
</main>
<footer><div class="footer-top wrap"><div><div class="eyebrow">TECHPULSE</div><h3>Technology, clearly explained.</h3><p>Original coverage of AI, software, gadgets, cloud and startups.</p></div><div class="footer-social"><a href="../index.html#newsletter">Newsletter</a><a href="../index.html#latest">Latest News</a><a href="../about.html">About Us</a><a href="../contact.html">Contact Us</a></div></div><div class="wrap footer-grid"><div><a class="brand" href="../index.html"><span class="brand-mark">T</span><span>Tech<span>Pulse</span></span></a><p>Independent technology news, explained clearly.</p></div><div><b>Sections</b><a href="../index.html#ai">AI</a><a href="../index.html#gadgets">Gadgets</a><a href="../index.html#software">Software</a><a href="../index.html#startups">Startups</a></div><div><b>Company</b><a href="../about.html">About Us</a><a href="../contact.html">Contact Us</a><a href="../contact.html#editorial">Editorial Policy</a></div></div><div class="wrap copyright">© 2026 TechPulse. Built for the open web.</div></footer>
<script src="../assets/js/app.js?v=20260927-5"></script>
</body>
</html>`;
}

function buildSitemap(existingXml, pagePath) {
  const loc = SITE_URL + "/" + pagePath;
  if (existingXml.includes("<loc>" + loc + "</loc>")) return existingXml;
  return existingXml.replace("</urlset>", `<url><loc>${loc}</loc></url></urlset>`);
}

async function updateArticle(env, articleId, updates) {
  const { file, articles } = await getArticlesIndex(env);
  const index = articles.findIndex(x => x.id === articleId);
  if (index < 0) throw new Error("Article not found.");
  const current = articles[index];
  const next = { ...current, title: String(updates.title || current.title).trim(), description: String(updates.description ?? current.description ?? "").trim(), excerpt: String(updates.description ?? current.excerpt ?? current.description ?? "").trim(), category: String(updates.category || current.category || "Technology").trim(), labels: Array.isArray(updates.labels) ? updates.labels : (current.labels || []), feature_image: String(updates.feature_image ?? current.feature_image ?? "").trim() };
  if (!next.title) throw new Error("Title is required.");
  if (!next.page) throw new Error("Article page is missing.");
  const html = buildArticleHtml({ ...next, content: String(updates.content ?? "") }, next.date || isoDate(), next.page);
  // The article page already exists when editing. GitHub requires its current blob SHA.
  const existingArticleFile = await githubGet(env, next.page);
  await githubPut(env, next.page, html, "Edit TechPulse article: " + next.title, existingArticleFile.sha);
  articles[index] = next;
  await githubPut(env, "data/articles.json", JSON.stringify(articles, null, 2) + "\n", "Update edited TechPulse article", file.sha);
  return next;
}
async function createManualArticle(env, input) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const content = String(input.content || "").trim();
  const category = String(input.category || "Technology").trim();
  const feature_image = String(input.feature_image || "").trim();
  if (!title) throw new Error("Title is required.");
  if (!content) throw new Error("Article content is required.");
  const article = {
    title, description, content, category,
    labels: Array.isArray(input.labels) ? input.labels : [],
    source_urls: Array.isArray(input.source_urls) ? input.source_urls : [],
    feature_image
  };
  return publishArticle(env, article);
}

async function createDemoArticle(env) {
  const article = {
    title: "TechPulse Test Article: How AI Assistants Are Changing Everyday Work",
    description: "A TechPulse demo article used to test publishing, homepage cards, article pages, feature images and editing without using Groq.",
    category: "AI",
    labels: ["AI", "Technology", "Demo"],
    source_urls: [],
    feature_image: ""
  };
  article.content = "<p>This is a TechPulse demonstration article. It is intentionally created without Groq so the complete publishing pipeline can be tested safely.</p><h2>Why this test exists</h2><p>The demo checks the article index, GitHub publishing, homepage rendering, responsive article layout, editing and sitemap updates.</p><h2>What you can test</h2><ul><li>Open the article from the homepage.</li><li>Check the responsive header and footer.</li><li>Edit the title, description or content from the admin panel.</li><li>Set a 1000 × 600 feature image.</li><li>Refresh the Published section and confirm the updated article.</li></ul><h2>Test status</h2><p>If you can complete these steps, the core TechPulse publishing pipeline is working independently of AI generation.</p>";
  return publishArticle(env, article);
}

async function publishArticle(env, article) {
  const { file, articles } = await getArticlesIndex(env);
  const sourceUrls = Array.isArray(article.source_urls) ? article.source_urls.filter(Boolean) : [];

  const duplicate = articles.find(existing =>
    Array.isArray(existing.source_urls) &&
    existing.source_urls.some(url => sourceUrls.includes(url))
  );

  if (duplicate) {
    return { published: false, duplicate: true, existing_id: duplicate.id };
  }

  const date = isoDate();
  const id = slugify(article.title) + "-" + date + (sourceUrls.length ? "" : "-" + Date.now().toString(36));
  const pagePath = "articles/" + id + ".html";

  const record = {
    id,
    title: article.title,
    description: article.description || "",
    category: article.category || "Technology",
    labels: Array.isArray(article.labels) ? article.labels : [],
    feature_image: article.feature_image || "",
    date,
    readTime: readTime(article.content || ""),
    excerpt: article.description || "",
    page: pagePath,
    source_urls: sourceUrls
  };

  const nextArticles = [record, ...articles].slice(0, 100);
  const articleHtml = buildArticleHtml(article, date, pagePath);

  await githubPut(
    env,
    pagePath,
    articleHtml,
    "Publish TechPulse article: " + article.title
  );

  await githubPut(
    env,
    "data/articles.json",
    JSON.stringify(nextArticles, null, 2) + "\n",
    "Update TechPulse article index",
    file.sha
  );

  try {
    const sitemapFile = await githubGet(env, "sitemap.xml");
    const sitemapXml = decodeURIComponent(escape(atob(sitemapFile.content.replace(/\n/g, ""))));
    const nextSitemap = buildSitemap(sitemapXml, pagePath);
    if (nextSitemap !== sitemapXml) {
      await githubPut(env, "sitemap.xml", nextSitemap, "Update TechPulse sitemap", sitemapFile.sha);
    }
  } catch (error) {
    console.log("Sitemap update skipped:", error.message);
  }

  return {
    published: true,
    id,
    page: SITE_URL + "/" + pagePath,
    title: article.title
  };
}

async function runNewsJob(env) {
  if (!env) throw new Error("Worker environment is unavailable.");
  const allStories = await collectNews();
  const stories = allStories.slice(0, 5).map(x => ({source:x.source,title:x.title,url:x.url,description:String(x.description||"").slice(0,500)}));
  if (!stories.length) throw new Error("No RSS stories were found.");

  const article = await generateArticle(env, stories);
  const result = await publishArticle(env, article);

  console.log("TechPulse news job:", JSON.stringify({
    sources_checked: FEEDS.length,
    stories_found: stories.length,
    ...result
  }));

  return { sources_checked: FEEDS.length, stories_found: stories.length, ...result };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (url.pathname === "/health") return json({ ok: true, service: "TechPulse News Engine", version: WORKER_VERSION, bindings: { DB: !!env?.DB, GITHUB_TOKEN: !!env?.GITHUB_TOKEN, GROQ_API_KEY: !!env?.GROQ_API_KEY, ADMIN_TOKEN: !!env?.ADMIN_TOKEN } });

    if (url.pathname === "/admin/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!env.ADMIN_TOKEN) return json({ ok: false, error: "Admin secret is not configured." }, { status: 500 });
        if (email !== ADMIN_EMAIL.toLowerCase() || password !== env.ADMIN_TOKEN) return json({ ok: false, error: "Invalid email or password." }, { status: 401 });
        const session = await createAdminSession(env);
        return json({ ok: true, token: session.token, expires_at: session.expiresAt, email: ADMIN_EMAIL });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (url.pathname === "/admin/me" && request.method === "GET") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      return json({ ok: true, email: ADMIN_EMAIL });
    }

    if (url.pathname === "/admin/logout" && request.method === "POST") {
      const auth = await requireAdmin(request, env);
      if (auth.ok) await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(auth.sessionId).run();
      return json({ ok: true });
    }

    if (url.pathname === "/admin/diagnostics" && request.method === "GET") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      return json({ ok: true, version: WORKER_VERSION, github_token: !!env?.GITHUB_TOKEN, groq_api_key: !!env?.GROQ_API_KEY, admin_token: !!env?.ADMIN_TOKEN, d1: !!env?.DB, time: new Date().toISOString() });
    }

    if (url.pathname === "/admin/stats" && request.method === "GET") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      const subscriberCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM subscribers").first();
      const logs = await env.DB.prepare("SELECT run_type, status, article_id, message, created_at FROM automation_logs ORDER BY id DESC LIMIT 10").all();
      return json({ ok: true, subscribers: Number(subscriberCount?.count || 0), automation_logs: logs.results || [] });
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        const name = String(body.name || "Subscriber").trim().slice(0, 120);
        const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
        if (!env.DB) return json({ ok: false, error: "Subscriber database is unavailable." }, { status: 500 });
        await env.DB.prepare("INSERT INTO subscribers (name, email, status) VALUES (?, ?, 'active') ON CONFLICT(email) DO UPDATE SET name = excluded.name, status = 'active'").bind(name || "Subscriber", email).run();
        return json({ ok: true, message: "You're subscribed to TechPulse." });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (url.pathname === "/admin/subscribers" && request.method === "GET") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      const rows = await env.DB.prepare("SELECT id, name, email, status, created_at FROM subscribers ORDER BY id DESC LIMIT 500").all();
      return json({ ok: true, subscribers: rows.results || [] });
    }

    if (url.pathname === "/admin/demo-article" && request.method === "POST") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      try {
        const result = await createDemoArticle(env);
        if (env.DB) await env.DB.prepare("INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)").bind("demo_test", result.published ? "published" : "duplicate", result.id || null, result.title || "").run();
        return json({ ok: true, ...result });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    if (url.pathname === "/admin/subscriber" && request.method === "DELETE") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      try {
        const body = await request.json();
        const id = Number(body.id);
        if (!Number.isInteger(id)) return json({ ok: false, error: "Subscriber ID is required." }, { status: 400 });
        await env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(id).run();
        return json({ ok: true });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    if (url.pathname === "/admin/create-article" && request.method === "POST") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      try {
        const body = await request.json();
        const result = await createManualArticle(env, body);
        if (env.DB) await env.DB.prepare("INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)").bind("manual_create", result.published ? "published" : "failed", result.id || null, result.title || "").run();
        return json({ ok: true, ...result });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    if (url.pathname === "/admin/article" && request.method === "POST") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      try {
        const body = await request.json();
        const articleId = String(body.id || "").trim();
        if (!articleId) return json({ ok: false, error: "Article ID is required." }, { status: 400 });
        const result = await updateArticle(env, articleId, body);
        return json({ ok: true, article: result });
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 500 });
      }
    }
    if (url.pathname === "/test-news" && request.method === "POST") {
      let auth = await requireAdmin(request, env);

      // Backward compatibility for direct testing with the raw ADMIN_TOKEN.
      if (!auth.ok) {
        const header = request.headers.get("Authorization") || "";
        const expected = env.ADMIN_TOKEN ? "Bearer " + env.ADMIN_TOKEN : "";
        if (expected && header === expected) auth = { ok: true, sessionId: null };
      }

      if (!auth.ok) return json({ ok: false, error: auth.error || "Unauthorized" }, { status: 401 });

      try {
        const result = await runNewsJob(env);
        if (env.DB) {
          await env.DB.prepare(
            "INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)"
          ).bind(
            "manual_test",
            result.published ? "published" : (result.duplicate ? "duplicate" : "completed"),
            result.id || result.existing_id || null,
            result.published ? result.title : (result.duplicate ? "Duplicate article skipped" : "Test completed")
          ).run();
        }
        return json({ ok: true, ...result });
      } catch (error) {
        if (env.DB) {
          try {
            await env.DB.prepare(
              "INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)"
            ).bind("manual_test", "failed", null, error.message.slice(0, 500)).run();
          } catch (logError) {}
        }
        return json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return json({ ok: true, service: "TechPulse News Engine", version: WORKER_VERSION, endpoints: ["/health", "/admin/login", "/admin/me", "/admin/logout", "/admin/stats", "/admin/diagnostics", "/test-news"] });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const result = await runNewsJob(env);
        if (env.DB) {
          await env.DB.prepare("INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)")
            .bind("scheduled", result.published ? "published" : (result.duplicate ? "duplicate" : "completed"), result.id || result.existing_id || null, result.title || "Scheduled run completed")
            .run();
        }
      } catch (error) {
        console.error("TechPulse scheduled job failed:", error.message);
        if (env.DB) {
          try {
            await env.DB.prepare("INSERT INTO automation_logs (run_type, status, article_id, message) VALUES (?, ?, ?, ?)")
              .bind("scheduled", "failed", null, String(error.message || error).slice(0,500))
              .run();
          } catch (_) {}
        }
      }
    })());
  }
};
