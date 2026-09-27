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
  try{
    const response=await fetch(pagePrefix()+"data/articles.json",{cache:"no-store"});
    if(!response.ok)throw new Error("feed unavailable");
    const data=await response.json();
    articles=Array.isArray(data)?data:[];
  }catch(e){articles=FALLBACK_ARTICLES;}
  renderHome(articles);
}

function renderHome(items){
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
      const r=await fetch(path+"?v="+Date.now(),{cache:"no-store"});
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
  grid.innerHTML='<div class="loading-card">Loading latest stories…</div>';
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

function ensureSearchModal(){
  if(document.getElementById("searchModal"))return;
  document.body.insertAdjacentHTML("beforeend",'<div class="search-modal" id="searchModal" hidden><div class="search-box" role="dialog" aria-modal="true" aria-label="Search TechPulse"><div class="search-top"><input id="globalSearchInput" type="search" placeholder="Search AI, gadgets, startups, software…" autocomplete="off"><button class="search-close" id="searchClose" aria-label="Close search">×</button></div><div class="search-results" id="searchResults"></div></div></div>');
  const modal=document.getElementById("searchModal"),input=document.getElementById("globalSearchInput");
  document.getElementById("searchClose").onclick=()=>closeSearch();
  modal.addEventListener("click",e=>{if(e.target===modal)closeSearch();});
  input.addEventListener("input",()=>renderSearchResults(input.value));
  input.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
}
function renderSearchResults(query){
  const box=document.getElementById("searchResults"),q=String(query||"").trim().toLowerCase();
  if(!q){box.innerHTML='<div class="search-empty">Type a keyword to search TechPulse stories.</div>';return;}
  const matches=articles.filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(q)).slice(0,12);
  box.innerHTML=matches.length?matches.map(x=>'<a class="search-result" href="'+escapeHtml(x.page)+'"><small>'+escapeHtml(x.category||"Technology")+'</small><b>'+escapeHtml(x.title)+'</b><span>'+escapeHtml(x.excerpt||x.description||"")+'</span></a>').join(""):'<div class="search-empty">No stories found for “'+escapeHtml(query)+'”.</div>';
}
function openSearch(){
  ensureSearchModal();
  const modal=document.getElementById("searchModal");
  modal.hidden=false;
  const input=document.getElementById("globalSearchInput");
  input.value="";
  renderSearchResults("");
  setTimeout(()=>input.focus(),30);
  document.body.style.overflow="hidden";
}
function closeSearch(){const modal=document.getElementById("searchModal");if(modal)modal.hidden=true;document.body.style.overflow="";}

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

function setupNavigation(){
  const mt=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");
  if(mt&&nav)mt.addEventListener("click",()=>nav.classList.toggle("open"));
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
  document.querySelectorAll(".mobile-menu-trigger").forEach(btn=>btn.addEventListener("click",e=>{e.preventDefault();nav?.classList.toggle("open");}));
  const search=document.getElementById("searchToggle");
  if(search)search.addEventListener("click",openSearch);
}

document.addEventListener("DOMContentLoaded",()=>{
  ensureSearchModal();
  setupNavigation();
  loadArticles();
  document.getElementById("subscribeForm")?.addEventListener("submit",subscribe);
  renderLatestPage();
  renderCategoryPage();
});

async function loadMarketData(){
  const grid=document.querySelector(".market-masonry-grid");if(!grid)return;
  const endpoint="https://tech-news-channel.rahulsocialwits.workers.dev/market";
  try{
    const r=await fetch(endpoint+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const data=await r.json();if(!data.ok||!Array.isArray(data.quotes))throw new Error(data.error||"Market data unavailable");
    const renderQuote=q=>{const price=Number(q.price),change=Number(q.change),pct=Number(q.changePercent),valid=Number.isFinite(price),up=Number.isFinite(change)?change>=0:true,cls=valid?(up?"market-up":"market-down"):"market-unavailable";return '<a class="market-card market-card-link" href="market.html?symbol='+encodeURIComponent(q.symbol)+'"><span class="market-company">'+escapeHtml(q.name)+'</span><strong>'+escapeHtml(q.symbol)+'</strong><small>'+escapeHtml(q.sector)+'</small><div class="market-price">'+(valid?"$"+price.toFixed(2):"—")+'</div><b class="market-status '+cls+'">'+(Number.isFinite(change)?((up?"+":"")+change.toFixed(2)+" · "+(up?"+":"")+pct.toFixed(2)+"%"):"Quote unavailable")+'</b><span class="market-ticker-open">View details →</span></a>';};
    const html=data.quotes.map(renderQuote).join("");grid.innerHTML=html+html;
    const note=document.querySelector(".market-note");if(note)note.textContent="Live market data";
    requestAnimationFrame(()=>grid.classList.add("is-loaded"));
  }catch(e){console.warn("TechPulse market data:",e);grid.innerHTML='<div class="loading-card">Live market data is temporarily unavailable.</div>';}
}
document.addEventListener("DOMContentLoaded",loadMarketData);
