/* TechPulse lightweight site shell. Search data loads only when search is used. */
(function(){
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const prefix=location.pathname.includes("/articles/")?"../":"";
  let searchItems=null;
  function setupNav(){
    const mt=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");
    if(mt&&nav)mt.addEventListener("click",()=>nav.classList.toggle("open"));
    nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
    const search=document.getElementById("searchToggle");
    if(search)search.addEventListener("click",openSearch);
  }
  function modal(){
    if(document.getElementById("searchModal"))return document.getElementById("searchModal");
    document.body.insertAdjacentHTML("beforeend",'<div class="search-modal" id="searchModal" hidden><div class="search-box" role="dialog" aria-modal="true" aria-label="Search TechPulse"><div class="search-top"><input id="globalSearchInput" type="search" placeholder="Search AI, gadgets, startups, software…" autocomplete="off"><button class="search-close" id="searchClose" aria-label="Close search">×</button></div><div class="search-results" id="searchResults"></div></div></div>');
    const m=document.getElementById("searchModal"),i=document.getElementById("globalSearchInput");
    document.getElementById("searchClose").onclick=closeSearch;
    m.addEventListener("click",e=>{if(e.target===m)closeSearch();});
    i.addEventListener("input",()=>render(i.value));
    i.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
    return m;
  }
  async function render(q){
    const box=document.getElementById("searchResults"),term=String(q||"").trim().toLowerCase();
    if(!term){box.innerHTML='<div class="search-empty">Type a keyword to search TechPulse stories.</div>';return;}
    if(!searchItems){
      try{const r=await fetch(prefix+"data/articles.json",{cache:"default"});searchItems=await r.json();}catch(_){searchItems=[];}
    }
    const matches=(Array.isArray(searchItems)?searchItems:[]).filter(x=>(String(x.title||"")+" "+String(x.category||"")+" "+String(x.excerpt||x.description||"")+" "+(Array.isArray(x.labels)?x.labels.join(" "):"")).toLowerCase().includes(term)).slice(0,10);
    box.innerHTML=matches.length?matches.map(x=>'<a class="search-result" href="'+escapeHtml(x.page)+'"><small>'+escapeHtml(x.category||"Technology")+'</small><b>'+escapeHtml(x.title)+'</b><span>'+escapeHtml(x.excerpt||x.description||"")+'</span></a>').join(""):'<div class="search-empty">No stories found for “'+escapeHtml(q)+'”.</div>';
  }
  function openSearch(){const m=modal(),i=document.getElementById("globalSearchInput");m.hidden=false;i.value="";document.body.style.overflow="hidden";setTimeout(()=>i.focus(),20);render("");}
  function closeSearch(){const m=document.getElementById("searchModal");if(m)m.hidden=true;document.body.style.overflow="";}
  document.addEventListener("DOMContentLoaded",setupNav);
})();