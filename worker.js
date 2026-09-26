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

function clean(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function tag(xml, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i");
  const m = xml.match(re);
  return m ? clean(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
}

function itemsFromFeed(xml, source) {
  return [...xml.matchAll(/<item[\\s\\S]*?<\/item>/gi)].slice(0, 5).map(m => {
    const x = m[0];
    return {
      source,
      title: tag(x, "title"),
      url: tag(x, "link"),
      published: tag(x, "pubDate"),
      description: tag(x, "description")
    };
  }).filter(x => x.title && x.url);
}

async function collectNews() {
  const results = await Promise.allSettled(FEEDS.map(async feed => {
    const r = await fetch(feed.url, { headers: { "User-Agent": "TechPulseNewsEngine/1.0" } });
    if (!r.ok) throw new Error(feed.name + " HTTP " + r.status);
    return itemsFromFeed(await r.text(), feed.name);
  }));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

async function generateArticle(env, stories) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY secret is missing.");
  const prompt = `You are the TechPulse technology newsroom.

Using ONLY the supplied source items, identify one timely technology story and write an original article. Do not copy sentences from the sources. Do not invent facts. If a detail is not supported by the supplied sources, omit it.

Return ONLY valid JSON with:
{
  "title": "SEO-friendly headline",
  "description": "150-160 character summary",
  "category": "AI | Cloud | Gadgets | Software | Startups | Technology",
  "labels": ["Technology"],
  "content": "<p>...</p><h2>...</h2>...",
  "source_urls": ["https://..."]
}

Include a concise introduction, what happened, important details, context, impact, availability/next steps when supported, and a conclusion. Keep the article readable and factual.

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
      max_completion_tokens: 5000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) throw new Error("Groq HTTP " + response.status + ": " + (await response.text()).slice(0, 500));
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "TechPulse News Engine" });
    }

    if (url.pathname === "/test-news") {
      try {
        const stories = (await collectNews()).slice(0, 20);
        const article = await generateArticle(env, stories);
        return Response.json({ ok: true, sources_checked: FEEDS.length, stories_found: stories.length, article });
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
      const stories = (await collectNews()).slice(0, 20);
      if (!stories.length) return;
      await generateArticle(env, stories);
      console.log("TechPulse scheduled news generation completed.", new Date().toISOString());
    })());
  }
};
