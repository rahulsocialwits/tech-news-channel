const FEEDS = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "WIRED", url: "https://www.wired.com/feed/rss" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
  { name: "Android Authority", url: "https://www.androidauthority.com/feed/" },
  { name: "9to5Google", url: "https://9to5google.com/feed/" }
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

Using ONLY the supplied source items, identify ONE timely technology story worth publishing today. Prefer a story with clear, recent, concrete information. Cross-check details across supplied sources when possible.

Write a completely original article. Do not copy sentences from the sources. Do not invent facts, quotes, numbers, product details, dates, or claims. If a detail is not supported by the supplied sources, omit it.

Return the article fields required by the response schema. Do not add extra fields.

Article requirements:
- 700-1100 words where the source material supports it.
- Start with a strong factual introduction.
- Include sections for what happened, important details, context, impact, and availability/next steps when supported.
- Use useful H2 headings and paragraphs; lists are allowed when helpful.
- End with a concise factual takeaway.
- HTML content must contain only article-body tags such as p, h2, h3, ul, ol, li, strong, em, a.
- Do not include html, head, body, script, style, markdown fences, or navigation.
- source_urls must contain the original source URLs actually used.
- Do not make claims beyond the supplied source items.

SOURCE ITEMS:
${JSON.stringify(stories)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.GROQ_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: "You are a factual technology news editor. Output JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 3800,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "techpulse_article",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              category: {
                type: "string",
                enum: ["AI", "Cloud", "Gadgets", "Software", "Startups", "Technology"]
              },
              labels: {
                type: "array",
                items: { type: "string" }
              },
              content: { type: "string" },
              source_urls: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["title", "description", "category", "labels", "content", "source_urls"],
            additionalProperties: false
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error("Groq HTTP " + response.status + ": " + (await response.text()).slice(0, 500));
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  const article = JSON.parse(raw);

  if (!article.title || !article.content || !Array.isArray(article.source_urls)) {
    throw new Error("Groq returned an incomplete article.");
  }

  return article;
}

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
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
<header class="site-header">
<div class="wrap nav">
<a class="brand" href="../index.html"><span class="brand-mark">T</span><span>Tech<span>Pulse</span></span></a>
<nav><a href="../index.html">Home</a><a href="../index.html#latest">Latest</a><a href="../index.html#ai">AI</a><a href="../index.html#software">Software</a></nav>
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
</article>
</main>
<footer><div class="wrap copyright">© 2026 TechPulse. <a href="../index.html">Back to homepage</a></div></footer>
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
  await githubPut(env, next.page, html, "Edit TechPulse article: " + next.title);
  articles[index] = next;
  await githubPut(env, "data/articles.json", JSON.stringify(articles, null, 2) + "\n", "Update edited TechPulse article", file.sha);
  return next;
}
async function publishArticle(env, article) {
  const { file, articles } = await getArticlesIndex();
  const sourceUrls = Array.isArray(article.source_urls) ? article.source_urls.filter(Boolean) : [];

  const duplicate = articles.find(existing =>
    Array.isArray(existing.source_urls) &&
    existing.source_urls.some(url => sourceUrls.includes(url))
  );

  if (duplicate) {
    return { published: false, duplicate: true, existing_id: duplicate.id };
  }

  const date = isoDate();
  const id = slugify(article.title) + "-" + date;
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
  const stories = allStories.slice(0, 12);
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
    if (url.pathname === "/health") return json({ ok: true, service: "TechPulse News Engine" });

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

    if (url.pathname === "/admin/stats" && request.method === "GET") {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, { status: 401 });
      const subscriberCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM subscribers").first();
      const logs = await env.DB.prepare("SELECT run_type, status, article_id, message, created_at FROM automation_logs ORDER BY id DESC LIMIT 10").all();
      return json({ ok: true, subscribers: Number(subscriberCount?.count || 0), automation_logs: logs.results || [] });
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

    return json({ ok: true, service: "TechPulse News Engine", endpoints: ["/health", "/admin/login", "/admin/me", "/admin/logout", "/admin/stats", "/test-news"] });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await runNewsJob(env);
      } catch (error) {
        console.error("TechPulse scheduled job failed:", error.message);
      }
    })());
  }
};
