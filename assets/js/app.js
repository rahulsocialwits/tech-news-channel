const FALLBACK_ARTICLES = [
  {
    id:"chatgpt",
    title:"What Is ChatGPT? How OpenAI's AI Assistant Works",
    category:"AI",
    date:"2026-09-26",
    readTime:"6 min read",
    excerpt:"A practical introduction to ChatGPT, what it can do, how conversational AI works at a high level, and where users should be careful.",
    page:"articles/chatgpt.html"
  },
  {
    id:"cloud-computing",
    title:"What Is Cloud Computing? A Simple Guide to the Cloud",
    category:"Cloud",
    date:"2026-09-26",
    readTime:"5 min read",
    excerpt:"Cloud computing lets people and businesses use computing resources over the internet instead of relying only on local hardware.",
    page:"articles/cloud-computing.html"
  },
  {
    id:"deepseek",
    title:"What Is DeepSeek? Understanding the AI Model and Company",
    category:"AI",
    date:"2026-09-26",
    readTime:"6 min read",
    excerpt:"DeepSeek is an AI company and model family that has drawn attention for its research, language models and approach to efficient AI development.",
    page:"articles/deepseek.html"
  }
];

let articles = [];

async function loadArticles(){
  try{
    const response = await fetch("data/articles.json",{cache:"no-store"});
    if(!response.ok) throw new Error("feed unavailable");
    articles = await response.json();
  }catch(e){
    articles = FALLBACK_ARTICLES;
  }
  renderHome(articles);
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function renderHome(items){
  const grid=document.getElementById("newsGrid");
  if(!grid) return;
  document.getElementById("storyCount").textContent = items.length + " stories";
  document.getElementById("tickerText").textContent = items.map(x=>x.title).join("  •  ");

  const hero=items[0];
  const heroCard=document.getElementById("heroCard");
  if(heroCard && hero){
    heroCard.innerHTML = '<span class="pill">Featured</span><div><small>'+escapeHtml(hero.category)+' • '+escapeHtml(hero.readTime)+'</small><h2>'+escapeHtml(hero.title)+'</h2><p>'+escapeHtml(hero.excerpt)+'</p><a class="btn" href="'+escapeHtml(hero.page)+'">Read story →</a></div>';
  }

  grid.innerHTML = items.map((item,index)=>{
    const artClass = item.category==="AI" ? "ai-art" : item.category==="Cloud" ? "blue-art" : "orange-art"; const image = item.feature_image ? '<img src="'+escapeHtml(item.feature_image)+'" alt="" loading="lazy">':"";
    return '<article class="story '+(index===0?'featured':'')+'">'+
      '<a href="'+escapeHtml(item.page)+'"><div class="story-art '+artClass+(item.feature_image?" has-image":"")+'">'+image+'<span>'+escapeHtml(item.category)+'</span></div></a>'+
      '<div class="story-body"><span class="tag">'+escapeHtml(item.category)+'</span>'+
      '<h3><a href="'+escapeHtml(item.page)+'">'+escapeHtml(item.title)+'</a></h3>'+
      '<p>'+escapeHtml(item.excerpt)+'</p><div class="meta">'+escapeHtml(item.date)+' · '+escapeHtml(item.readTime)+'</div></div></article>';
  }).join("");
}

function searchArticles(query){
  const q=query.trim().toLowerCase();
  if(!q){ renderHome(articles); return; }
  const filtered=articles.filter(x => (x.title+" "+x.category+" "+x.excerpt).toLowerCase().includes(q));
  renderHome(filtered);
  document.getElementById("latest")?.scrollIntoView({behavior:"smooth"});
}

document.addEventListener("DOMContentLoaded",()=>{
  loadArticles();
  const b=document.getElementById("searchToggle");
  if(b)b.addEventListener("click",()=>{
    const q=prompt("Search TechPulse");
    if(q) searchArticles(q);
  });
});