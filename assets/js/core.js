/* TechPulse core shell: navigation + on-demand search only. No article or market request on static pages. */
(()=>{"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
let searchItems=null;
const prefix=location.pathname.includes("/articles/")?"../":"";
function setup(){
 const nav=document.getElementById("mainNav"),menu=document.getElementById("menuToggle");
 menu?.addEventListener("click",()=>nav?.classList.toggle("open"));
 nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav?.classList.remove("open")));
 document.getElementById("searchToggle")?.addEventListener("click",openSearch);
}
function ensure(){
 if(document.getElementById("searchModal"))return;
 document.body.insertAdjacentHTML("beforeend",'<div class="search-modal" id="searchModal" hidden><div class="search-box" role="dialog" aria-modal="true" aria-label="Search TechPulse"><div class="search-top"><input id="globalSearchInput" type="search" placeholder="Search TechPulse…" autocomplete="off"><button class="search-close" id="searchClose" aria-label="Close search">×</button></div><div class="search-results" id="searchResults"><div class="search-empty">Type a keyword to search TechPulse stories.</div></div></div></div>');
 const m=document.getElementById("searchModal"),i=document.getElementById("globalSearchInput");
 document.getElementById("searchClose").onclick=close;
 m.addEventListener("click",e=>{if(e.target===m)close()});
 i.addEventListener("input",()=>render(i.value));
 i.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
async function render(q){
 const box=document.getElementById("searchResults"),term=String(q||"").trim().toLowerCase();
 if(!term){box.innerHTML='<div class="search-empty">Type a keyword to search TechPulse stories.</div>';return}
 if(!searchItems){
  try{const r=await fetch(prefix+"data/articles.json",{cache:"default"});searchItems=await r.json();}catch(_){searchItems=[]}
 }
 const matches=(Array.isArray(searchItems)?searchItems:[]).filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(term)).slice(0,10);
 box.innerHTML=matches.length?matches.map(x=>'<a class="search-result" href="'+esc(x.page)+'"><small>'+esc(x.category||"Technology")+'</small><b>'+esc(x.title)+'</b><span>'+esc(x.excerpt||x.description||"")+'</span></a>').join(""):'<div class="search-empty">No stories found.</div>';
}
function openSearch(){ensure();const m=document.getElementById("searchModal"),i=document.getElementById("globalSearchInput");m.hidden=false;i.value="";document.body.style.overflow="hidden";i.focus()}
function close(){const m=document.getElementById("searchModal");if(m)m.hidden=true;document.body.style.overflow=""}
document.addEventListener("DOMContentLoaded",setup);
})();