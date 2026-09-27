const WORKER_URL="https://tech-news-channel.rahulsocialwits.workers.dev";
const FALLBACK_ARTICLES=[
  {id:"chatgpt",title:"What Is ChatGPT? How OpenAI's AI Assistant Works",category:"AI",date:"2026-09-26",readTime:"6 min read",excerpt:"A practical introduction to ChatGPT, what it can do, how conversational AI works at a high level, and where users should be careful.",page:"articles/chatgpt.html"},
  {id:"cloud-computing",title:"What Is Cloud Computing? A Simple Guide to the Cloud",category:"Cloud",date:"2026-09-26",readTime:"5 min read",excerpt:"Cloud computing lets people and businesses use computing resources over the internet instead of relying only on local hardware.",page:"articles/cloud-computing.html"},
  {id:"deepseek",title:"What Is DeepSeek? Understanding the AI Model and Company",category:"AI",date:"2026-09-26",readTime:"6 min read",excerpt:"DeepSeek is an AI company and model family that has drawn attention for its research, language models and approach to efficient AI development.",page:"articles/deepseek.html"}
];
let articles=[];

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function pagePrefix(){return location.pathname.includes("/articles/")?"../":"";}

async function loadArticles(){
  // Render immediately from the tiny local fallback, then refresh with the full feed.
  articles=FALLBACK_ARTICLES.slice();
  renderHome(articles);
  try{
    const response=await fetch(pagePrefix()+"data/articles.json",{cache:"default"});
    if(!response.ok)throw new Error("feed unavailable");
    const data=await response.json();
    if(Array.isArray(data)&&data.length){articles=data;renderHome(articles);}
  }catch(e){}
}

function renderTopNews(items){const box=document.getElementById("topNewsGrid");if(!box)return;const top=(items||[]).slice(0,6);if(!top.length){box.innerHTML="<div class=\"loading-card\">No top stories available right now.</div>";return;}box.innerHTML=top.map((item,index)=>{const image=item.feature_image?'<img src="'+escapeHtml(item.feature_image)+'" alt="" loading="lazy" decoding="async">':"";return '<a class="top-news-card" href="'+escapeHtml(item.page)+'"><span class="top-news-number">'+String(index+1).padStart(2,"0")+"</span><div class=\"top-news-art \"+(image?"has-image":"")+"\">"+image+"</div><div class=\"top-news-copy\"><span class=\"tag\">"+escapeHtml(item.category||"Technology")+"</span><h3>"+escapeHtml(item.title)+"</h3><p>"+escapeHtml(item.excerpt||item.description||"")+"</p><div class=\"meta\">"+escapeHtml(item.date||"")+" · "+escapeHtml(item.readTime||"")+"</div></div></a>';}).join("");}

function renderHome(items){
  const topNews=document.getElementById("topNewsGrid");
  if(topNews)renderTopNews(items);
  const grid=document.getElementById("newsGrid");
  if(!grid)return;
  const count=document.getElementById("storyCount");
  const ticker=document.getElementById("tickerText");
  if(count)count.textContent=items.length+" stories";
  if(ticker)ticker.textContent=items.length?items.slice(0,4).map(x=>x.title).join("  •  "):"No stories found.";
  const hero=items[0],heroCard=document.getElementById("heroCard");
  if(heroCard){
    heroCard.innerHTML=hero?
      '<span class="pill">Featured</span><div><small>'+escapeHtml(hero.category)+' • '+escapeHtml(hero.readTime||"")+'</small><h2>'+escapeHtml(hero.title)+'</h2><p>'+escapeHtml(hero.excerpt||hero.description||"")+'</p><a class="btn" href="'+escapeHtml(hero.page)+'">Read story →</a></div>':
      '<span class="pill">TechPulse</span><div><h2>No matching stories</h2><p>Try another search.</p></div>';
  }
  if(!items.length){grid.innerHTML='<div class="loading-card">No stories match your search.</div>';return;}
  const homeItems = items.slice(0,4);
  grid.innerHTML=homeItems.map((item,index)=>{
    const artClass=item.category==="AI"?"ai-art":item.category==="Cloud"?"blue-art":"orange-art";
    const image=item.feature_image?'<img src="'+escapeHtml(item.feature_image)+'" alt="" loading="lazy">':"";
    return '<article class="story '+(index===0?'featured':'')+'"><a href="'+escapeHtml(item.page)+'"><div class="story-art '+artClass+(item.feature_image?" has-image":"")+'">'+image+'<span>'+escapeHtml(item.category||"Technology")+'</span></div></a><div class="story-body"><span class="tag">'+escapeHtml(item.category||"Technology")+'</span><h3><a href="'+escapeHtml(item.page)+'">'+escapeHtml(item.title)+'</a></h3><p>'+escapeHtml(item.excerpt||item.description||"")+'</p><div class="meta">'+escapeHtml(item.date||"")+" · "+escapeHtml(item.readTime||"")+'</div></div></article>';
  }).join("");
}

async function fetchArticleFeed(){
  const candidates=[pagePrefix()+"data/articles.json","/tech-news-channel/data/articles.json","data/articles.json"];
  for(const path of candidates){
    try{
      const r=await fetch(path,{cache:"default"});
      if(!r.ok) continue;
      const data=await r.json();
      if(Array.isArray(data)) return data;
    }catch(_){}
  }
  return FALLBACK_ARTICLES;
}

async function renderLatestPage(){
  const grid=document.getElementById("allNewsGrid");
  if(!grid)return;
  grid.innerHTML='';
  const items=await fetchArticleFeed();
  const params=new URLSearchParams(location.search);
  const cat=(params.get("cat")||"").trim().toLowerCase();
  const q=(params.get("q")||"").trim().toLowerCase();
  let filtered=items;
  if(cat)filtered=filtered.filter(x=>String(x.category||"").toLowerCase()===cat);
  if(q)filtered=filtered.filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(q));
  const title=document.getElementById("latestTitle");
  if(title)title.textContent=cat?(cat.charAt(0).toUpperCase()+cat.slice(1)+" Technology News"):(q?("Search results for “"+q+"”"):"Latest Technology News");
  if(!filtered.length){grid.innerHTML='<div class="empty-state"><h2>No stories in this section yet</h2><p>Try another category or return to the latest newsroom.</p><a class="btn" href="latest.html">View all latest news</a></div>';return;}
  grid.innerHTML=filtered.map(x=>{
    const image=x.feature_image?'<img src="'+escapeHtml(x.feature_image)+'" alt="" loading="lazy" decoding="async">':"";
    const cls=x.feature_image?"has-image":"ai-art";
    return '<article class="story"><a href="'+escapeHtml(x.page)+'"><div class="story-art '+cls+'">'+image+'<span>'+escapeHtml(x.category||"Technology")+'</span></div></a><div class="story-body"><span class="tag">'+escapeHtml(x.category||"Technology")+'</span><h3><a href="'+escapeHtml(x.page)+'">'+escapeHtml(x.title)+'</a></h3><p>'+escapeHtml(x.excerpt||x.description||"")+'</p><div class="meta">'+escapeHtml(x.date||"")+" · "+escapeHtml(x.readTime||"")+'</div></div></article>';
  }).join("");
}

async function renderCategoryPage(){
  const grid=document.getElementById("categoryGrid");
  if(!grid)return;
  const items=await fetchArticleFeed();
  const cats=[
    ["AI","Artificial intelligence, models, agents and AI products."],
    ["Cloud","Cloud platforms, infrastructure and data services."],
    ["Gadgets","Phones, laptops, wearables and smart devices."],
    ["Software","Apps, developer tools and software platforms."],
    ["Cybersecurity","Security, privacy, breaches and cyber defense."],
    ["Mobile","Smartphones, mobile apps and wireless technology."],
    ["Gaming","Games, consoles, PC gaming and interactive technology."],
    ["Startups","Founders, funding, products and emerging companies."],
    ["Fintech","Payments, digital finance and financial technology."],
    ["Enterprise","Business software, IT and enterprise technology."],
    ["Science","Space, research and technology breakthroughs."],
    ["Technology","Major technology stories across the industry."]
  ];
  grid.innerHTML=cats.map(([name,desc])=>{
    const count=items.filter(x=>String(x.category||"").toLowerCase()===name.toLowerCase()).length;
    return '<a class="category-tile" href="latest.html?cat='+encodeURIComponent(name)+'"><div class="category-icon">'+categoryIcon(name)+'</div><div><h2>'+name+'</h2><p>'+desc+'</p><span class="category-count">'+count+' '+(count===1?'story':'stories')+'</span></div></a>';
  }).join("");
}
function categoryIcon(name){
  return ({AI:"✦",Cloud:"☁",Gadgets:"◉",Software:"▣",Cybersecurity:"⌁",Mobile:"▤",Gaming:"◇",Startups:"↗",Fintech:"₹",Enterprise:"▦",Science:"✧",Technology:"⌘"})[name]||"•";
}
function searchArticles(query){
  const q=String(query||"").trim().toLowerCase();
  if(!q){renderHome(articles);return;}
  const filtered=articles.filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(q));
  renderHome(filtered);
  if(document.getElementById("latest"))document.getElementById("latest").scrollIntoView({behavior:"smooth"});
}

async function subscribe(e){
  e.preventDefault();
  const form=e.currentTarget,b=document.getElementById("subscribeButton"),s=document.getElementById("subscribeStatus");
  if(!b||!s)return;
  const name=(document.getElementById("subscriberName")?.value||"").trim();
  const email=(document.getElementById("subscriberEmail")?.value||"").trim();
  b.disabled=true;s.className="subscribe-status loading";s.textContent="Subscribing…";
  try{
    const r=await fetch(WORKER_URL+"/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email})});
    let d={};try{d=await r.json();}catch(_){}
    if(!r.ok)throw new Error(d.error||("Subscription failed ("+r.status+")"));
    s.className="subscribe-status success";s.textContent="✓ "+(d.message||"You're subscribed to TechPulse.");
    form.reset();
  }catch(error){s.className="subscribe-status error";s.textContent="✕ "+error.message;}
  finally{b.disabled=false;}
}

function ensureSearchModal(){
  if(document.getElementById("searchModal"))return;
  document.body.insertAdjacentHTML("beforeend",'<div class="search-modal" id="searchModal" hidden><div class="search-box" role="dialog" aria-modal="true"><div class="search-top"><input id="globalSearchInput" type="search" placeholder="Search TechPulse…"><button class="search-close" id="searchClose">×</button></div><div class="search-results" id="searchResults"><div class="search-empty">Type to search TechPulse.</div></div></div></div>');
  const m=document.getElementById("searchModal"),i=document.getElementById("globalSearchInput");
  document.getElementById("searchClose").onclick=closeSearch;
  m.addEventListener("click",e=>{if(e.target===m)closeSearch();});
  i.addEventListener("input",()=>renderSearchResults(i.value));
  i.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
}
async function renderSearchResults(query){
  const box=document.getElementById("searchResults"),q=String(query||"").trim().toLowerCase();
  if(!q){box.innerHTML='<div class="search-empty">Type to search TechPulse.</div>';return;}
  if(!articles.length)articles=await fetchArticleFeed();
  const matches=articles.filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(q)).slice(0,10);
  box.innerHTML=matches.length?matches.map(x=>'<a class="search-result" href="'+escapeHtml(x.page)+'"><small>'+escapeHtml(x.category||"Technology")+'</small><b>'+escapeHtml(x.title)+'</b><span>'+escapeHtml(x.excerpt||x.description||"")+'</span></a>').join(""):'<div class="search-empty">No stories found.</div>';
}
function openSearch(){
  ensureSearchModal();
  const m=document.getElementById("searchModal"),i=document.getElementById("globalSearchInput");
  m.hidden=false;i.value="";document.body.style.overflow="hidden";setTimeout(()=>i.focus(),20);
}
function closeSearch(){const m=document.getElementById("searchModal");if(m)m.hidden=true;document.body.style.overflow="";}

function setupNavigation(){
  const mt=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");
  if(mt&&nav)mt.addEventListener("click",()=>nav.classList.toggle("open"));
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
  document.querySelectorAll(".mobile-menu-trigger").forEach(btn=>btn.addEventListener("click",e=>{e.preventDefault();nav?.classList.toggle("open");}));
  const search=document.getElementById("searchToggle");
  if(search)search.addEventListener("click",openSearch);
}

document.addEventListener("DOMContentLoaded",()=>{
  setupNavigation();
  const isHome=!!document.getElementById("newsGrid") || !!document.getElementById("heroCard");
  if(isHome)loadArticles();
  if(document.getElementById("allNewsGrid"))renderLatestPage();
  if(document.getElementById("categoryGrid"))renderCategoryPage();
  document.getElementById("subscribeForm")?.addEventListener("submit",subscribe);
});

async function loadMarketData(){
 const strip=document.getElementById("homeMarketStrip");if(!strip)return;
 try{const r=await fetch("https://tech-news-channel.rahulsocialwits.workers.dev/market",{cache:"default"}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Market data unavailable");
 strip.innerHTML=(d.quotes||[]).map(q=>{const p=Number(q.price),c=Number(q.change),pc=Number(q.changePercent),up=c>=0;return '<a class="market-strip-card" href="market.html?symbol='+encodeURIComponent(q.symbol)+'"><div><b>'+escapeHtml(q.name)+'</b><span>'+escapeHtml(q.symbol)+'</span></div><strong>'+(Number.isFinite(p)?"$"+p.toFixed(2):"—")+'</strong><small class="'+(up?"up":"down")+'">'+(Number.isFinite(c)?((up?"+":"")+c.toFixed(2)+" · "+(up?"+":"")+pc.toFixed(2)+"%"):"Quote unavailable")+'</small><em>Details →</em></a>';}).join("");
 }catch(e){console.warn(e);strip.innerHTML='<div class="loading-card">Live market data is temporarily unavailable.</div>';}
}
document.addEventListener("DOMContentLoaded",loadMarketData);
