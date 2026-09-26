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

Return ONLY valid JSON:
{
  "title": "SEO-friendly headline",
  "description": "150-160 character summary",
  "category": "AI | Cloud | Gadgets | Software | Startups | Technology",
  "labels": ["Technology", "AI"],
  "content": "<p>...</p><h2>...</h2>...",
  "source_urls": ["https://..."]
}

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
      max_completion_tokens: 6500,
      response_format: { type: "json_object" }
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

function githubHeaders(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is missing.");
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
  const allStories = await collectNews();
  const stories = allStories.slice(0, 40);
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

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "TechPulse News Engine" });
    }

    if (url.pathname === "/test-news") {
      const auth = request.headers.get("Authorization") || "";
      const expected = env.ADMIN_TOKEN ? "Bearer " + env.ADMIN_TOKEN : "";
      if (!env.ADMIN_TOKEN || auth !== expected) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const result = await runNewsJob(env);
        return Response.json({ ok: true, ...result });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
      service: "TechPulse News Engine",
      endpoints: ["/health", "/test-news"]
    });
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
