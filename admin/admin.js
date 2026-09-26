const WORKER_URL="https://tech-news-channel.rahulsocialwits.workers.dev";
const sources=[["TechCrunch","https://techcrunch.com/feed/"],["The Verge","https://www.theverge.com/rss/index.xml"],["Ars Technica","https://feeds.arstechnica.com/arstechnica/index"],["WIRED","https://www.wired.com/feed/rss"],["Engadget","https://www.engadget.com/rss.xml"],["VentureBeat","https://venturebeat.com/feed/"],["Tom's Hardware","https://www.tomshardware.com/feeds/all"],["Android Authority","https://www.androidauthority.com/feed/"],["9to5Google","https://9to5google.com/feed/"]];

function token(){return sessionStorage.getItem("techpulse_admin_session")||""}
async function api(path,options={}){const headers={...(options.headers||{}),"Content-Type":"application/json"};if(token())headers.Authorization="Bearer "+token();const r=await fetch(WORKER_URL+path,{...options,headers});let data={};try{data=await r.json()}catch(e){}if(!r.ok)throw new Error(data.error||"Request failed");return data}
function showLogin(show){document.getElementById("loginGate").hidden=!show;document.getElementById("adminApp").hidden=show}
async function checkAuth(){if(!token()){showLogin(true);return false}try{await api("/admin/me");showLogin(false);return true}catch(e){sessionStorage.removeItem("techpulse_admin_session");showLogin(true);return false}}
function renderSources(){document.getElementById("sourcesList").innerHTML=sources.map(s=>'<div class="source"><b>● '+s[0]+'</b><small>'+s[1]+'</small></div>').join("")}
async function loadStats(){try{const data=await api("/admin/stats");const el=document.querySelector("#subscribers .empty");if(el)el.innerHTML="👥<b>"+data.subscribers+" active subscribers</b><span>Subscriber database is connected privately to Cloudflare D1.</span>"}catch(e){}}
async function loadPublished(){try{const r=await fetch("../data/articles.json",{cache:"no-store"});const data=await r.json();document.getElementById("total").textContent=data.length;document.getElementById("publishedList").innerHTML=data.map(x=>'<div class="item">'+(x.feature_image?'<img class="admin-thumb" src="'+escapeHtml(x.feature_image)+'" alt="">':"")+'<small>'+escapeHtml(x.date)+' · '+escapeHtml(x.category)+'</small><h3>'+escapeHtml(x.title)+'</h3><div class="item-actions"><a href="../'+escapeHtml(x.page)+'" target="_blank">View article →</a><button class="secondary edit-btn" data-id="'+escapeHtml(x.id)+'">✏️ Edit</button></div></div>').join("");document.querySelectorAll(".edit-btn").forEach(b=>b.onclick=()=>openEditor(b.dataset.id));document.getElementById("newsList").innerHTML=data.slice(0,10).map(x=>'<div class="item"><small>'+x.date+' · '+x.category+'</small><h3>'+escapeHtml(x.title)+'</h3><a href="../'+escapeHtml(x.page)+'" target="_blank">Open →</a></div>').join("")}catch(e){}}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function publishTestNews(){
  const button=document.getElementById("testNews");
  const status=document.getElementById("testNewsStatus");
  if(!button||!status)return;
  button.disabled=true;
  button.textContent="⏳ Publishing...";
  status.className="action-status loading";
  status.textContent="Fetching RSS sources and generating the article with Groq…";
  try{
    const data=await api("/test-news",{method:"POST"});
    if(data.published){
      status.className="action-status success";
      status.innerHTML="✅ Published: <b>"+escapeHtml(data.title)+"</b>";
    }else if(data.duplicate){
      status.className="action-status warning";
      status.textContent="⚠️ Duplicate article skipped. Existing ID: "+data.existing_id;
    }else{
      status.className="action-status success";
      status.textContent="✅ Test completed.";
    }
    await loadPublished();
  }catch(error){
    status.className="action-status error";
    status.textContent="❌ "+error.message;
  }finally{
    button.disabled=false;
    button.textContent="🚀 Publish Test News";
  }
}
async function openEditor(id){
  try{
    const r=await fetch("../data/articles.json",{cache:"no-store"}); const data=await r.json(); const a=data.find(x=>x.id===id); if(!a) throw new Error("Article not found.");
    const html=await (await fetch("../"+a.page,{cache:"no-store"})).text(); const doc=new DOMParser().parseFromString(html,"text/html");
    document.getElementById("editId").value=a.id; document.getElementById("editTitle").value=a.title||""; document.getElementById("editDescription").value=a.description||a.excerpt||""; document.getElementById("editCategory").value=a.category||"Technology"; document.getElementById("editImage").value=a.feature_image||""; document.getElementById("editContent").value=doc.querySelector(".article-content")?.innerHTML||""; updateImagePreview(); document.getElementById("editStatus").className="action-status"; document.getElementById("editStatus").textContent=""; document.getElementById("editModal").hidden=false;
  }catch(e){alert(e.message)}
}
function closeEditor(){document.getElementById("editModal").hidden=true}
function updateImagePreview(){const u=document.getElementById("editImage").value.trim(),p=document.getElementById("imagePreview");p.innerHTML=u?'<img src="'+escapeHtml(u)+'" alt="Feature image preview"><small>Recommended canvas: 1000 × 600 px</small>':""}
async function saveArticle(e){
  e.preventDefault(); const status=document.getElementById("editStatus"),btn=document.getElementById("saveEdit"); btn.disabled=true; status.className="action-status loading"; status.textContent="Saving article to GitHub…";
  try{const payload={id:document.getElementById("editId").value,title:document.getElementById("editTitle").value,description:document.getElementById("editDescription").value,category:document.getElementById("editCategory").value,feature_image:document.getElementById("editImage").value,content:document.getElementById("editContent").value}; const r=await api("/admin/article",{method:"POST",body:JSON.stringify(payload)}); status.className="action-status success"; status.textContent="✅ Article updated successfully."; setTimeout(()=>{closeEditor();loadPublished()},700)}catch(err){status.className="action-status error";status.textContent="❌ "+err.message}finally{btn.disabled=false}
}
function route(){const id=location.hash.slice(1)||"overview";document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+id));const link=document.querySelector('nav a[href="#'+id+'"]');document.getElementById("pageTitle").textContent=link?link.textContent.replace(/^\S+\s/,""):id;document.querySelector(".sidebar")?.classList.remove("open")}
async function boot(){const ok=await checkAuth();if(!ok)return;renderSources();await Promise.all([loadPublished(),loadStats()]);route()}
document.addEventListener("DOMContentLoaded",()=>{document.getElementById("loginForm").addEventListener("submit",async e=>{e.preventDefault();const error=document.getElementById("loginError");error.textContent="Signing in...";try{const data=await fetch(WORKER_URL+"/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:document.getElementById("loginEmail").value,password:document.getElementById("loginPassword").value})});const result=await data.json();if(!data.ok)throw new Error(result.error||"Login failed");sessionStorage.setItem("techpulse_admin_session",result.token);document.getElementById("loginPassword").value="";error.textContent="";await boot()}catch(err){error.textContent=err.message}});document.getElementById("menu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");document.getElementById("refresh").onclick=loadPublished;document.getElementById("testNews").onclick=publishTestNews;document.getElementById("closeEdit").onclick=closeEditor;document.getElementById("cancelEdit").onclick=closeEditor;document.getElementById("editForm").addEventListener("submit",saveArticle);document.getElementById("editImage").addEventListener("input",updateImagePreview);document.getElementById("logout").onclick=async()=>{try{await api("/admin/logout",{method:"POST"})}catch(e){}sessionStorage.removeItem("techpulse_admin_session");showLogin(true)};window.addEventListener("hashchange",route);boot()});