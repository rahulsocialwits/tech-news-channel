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
  if(ticker)ticker.textContent=items.length?items.map(x=>x.title).join("  •  "):"No stories found.";
  const hero=items[0],heroCard=document.getElementById("heroCard");
  if(heroCard){
    heroCard.innerHTML=hero?
      '<span class="pill">Featured</span><div><small>'+escapeHtml(hero.category)+' • '+escapeHtml(hero.readTime||"")+'</small><h2>'+escapeHtml(hero.title)+'</h2><p>'+escapeHtml(hero.excerpt||hero.description||"")+'</p><a class="btn" href="'+escapeHtml(hero.page)+'">Read story →</a></div>':
      '<span class="pill">TechPulse</span><div><h2>No matching stories</h2><p>Try another search.</p></div>';
  }
  if(!items.length){grid.innerHTML='<div class="loading-card">No stories match your search.</div>';return;}
  grid.innerHTML=items.map((item,index)=>{
    const artClass=item.category==="AI"?"ai-art":item.category==="Cloud"?"blue-art":"orange-art";
    const image=item.feature_image?'<img src="'+escapeHtml(item.feature_image)+'" alt="" loading="lazy">':"";
    return '<article class="story '+(index===0?'featured':'')+'"><a href="'+escapeHtml(item.page)+'"><div class="story-art '+artClass+(item.feature_image?" has-image":"")+'">'+image+'<span>'+escapeHtml(item.category||"Technology")+'</span></div></a><div class="story-body"><span class="tag">'+escapeHtml(item.category||"Technology")+'</span><h3><a href="'+escapeHtml(item.page)+'">'+escapeHtml(item.title)+'</a></h3><p>'+escapeHtml(item.excerpt||item.description||"")+'</p><div class="meta">'+escapeHtml(item.date||"")+" · "+escapeHtml(item.readTime||"")+'</div></div></article>';
  }).join("");
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
  const search=document.getElementById("searchToggle");
  if(search)search.addEventListener("click",openSearch);
}

document.addEventListener("DOMContentLoaded",()=>{
  ensureSearchModal();
  setupNavigation();
  loadArticles();
  document.getElementById("subscribeForm")?.addEventListener("submit",subscribe);
});

async function loadMarketData(){
  const grid=document.querySelector(".market-masonry-grid");
  if(!grid) return;
  try{
    const r=await fetch("https://tech-news-channel.rahulsocialwits.workers.dev/market",{cache:"no-store"});
    const data=await r.json();
    if(!data.ok) throw new Error(data.error||"Market data unavailable");
    grid.innerHTML=data.quotes.map(q=>{
      const has=Number.isFinite(q.price);
      const up=Number(q.change)>=0;
      const change=Number.isFinite(q.change)?((up?"+":"")+q.change.toFixed(2)):"—";
      const pct=Number.isFinite(q.changePercent)?((up?"+":"")+q.changePercent.toFixed(2)+"%"):"—";
      return '<article class="market-card"><span class="market-company">'+q.name+'</span><strong>'+q.symbol+'</strong><small>'+q.sector+'</small><div class="market-price">'+(has?"$"+q.price.toFixed(2):"Data unavailable")+'</div><b class="market-status '+(has?(up?"market-up":"market-down"):"")+'">'+(has?(change+" · "+pct):"Unavailable")+'</b></article>';
    }).join("");
    const note=document.querySelector(".market-note");
    if(note) note.textContent="Live market data";
    const disclaimer=document.querySelector(".market-disclaimer");
    if(disclaimer) disclaimer.textContent="Market data provided by Finnhub. Quotes may be delayed or subject to provider and exchange rules.";
  }catch(e){
    console.warn("TechPulse market data:",e);
  }
}
document.addEventListener("DOMContentLoaded",loadMarketData);
