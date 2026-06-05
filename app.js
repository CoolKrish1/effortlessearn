import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[], smartLinks=[], clickLogs=[], settings={telegramUrl:""};
let authChecked=false;
export const $=id=>document.getElementById(id);
export const isAdmin=()=>profile?.role==='admin' || profile?.isAdmin===true || ['krish1235nayak@gmail.com'].includes(String(user?.email||'').toLowerCase());
export const isAffiliate=()=>['affiliate','admin'].includes(profile?.role) || isAdmin();
const safe=(v)=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
export const money=(n)=>Number(n||0).toLocaleString('en-IN');

// Global anti-refresh guard: form submit, blank # links and buttons without type.
document.addEventListener('submit',e=>e.preventDefault(),true);
document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(btn && !btn.getAttribute('type')) btn.setAttribute('type','button');
  const a=e.target.closest('a');
  if(!a) return;
  const href=a.getAttribute('href')||'';
  if(href==='#'||href===''||href.startsWith('javascript:')){ e.preventDefault(); return; }
  if(a.target==='_blank' || a.hasAttribute('download')) return;
  try{
    const u=new URL(href, location.href);
    const file=(u.pathname.split('/').pop()||'');
    if(u.origin===location.origin && file.endsWith('.html')){
      e.preventDefault();
      const page=pageFromPath(u.pathname);
      history.pushState({page},'',u.pathname+u.search);
      renderRoute(page);
    }
  }catch(_){}
},true);
export function toast(msg){let old=document.querySelector('.toast'); if(old)old.remove(); let t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200)}
window.toast=toast;

async function getCollection(name){try{return (await getDocs(collection(db,name))).docs.map(d=>({id:d.id,_collection:name,...d.data()}));}catch(e){console.warn('Load failed:',name,e.message);return []}}
export async function init(){
  onAuthStateChanged(auth, async(u)=>{
    user=u;
    if(u){
      const s=await getDoc(doc(db,'users',u.uid));
      if(s.exists()) profile={id:u.uid,...s.data()};
      else { profile={id:u.uid,email:u.email,balance:0,role:'user',createdAt:Date.now()}; await setDoc(doc(db,'users',u.uid),profile,{merge:true}); }
    }else profile=null;
    await loadData();
    authChecked=true;
    window.renderPage && window.renderPage();
  });
}
export async function loadData(){
  campaigns=await getCollection('campaigns');
  submissions=[...(await getCollection('submissions')),...(await getCollection('lead_submissions'))];
  withdraws=[...(await getCollection('withdraws')),...(await getCollection('withdrawals'))];
  smartLinks=await getCollection('smart_links');
  clickLogs=[...(await getCollection('click_logs')),...(await getCollection('clicks'))];
  const set=await getDoc(doc(db,'settings','main')).catch(()=>null); if(set?.exists()) settings={...settings,...set.data()};
  users=isAdmin()?await getCollection('users'):(profile?[profile]:[]);
  if(!isAdmin() && user){
    const uid=user.uid;
    submissions=submissions.filter(x=>[x.userId,x.publisherId,x.affiliateId,x.uid].includes(uid)||x.email===user.email);
    withdraws=withdraws.filter(x=>[x.userId,x.publisherId,x.uid].includes(uid)||x.email===user.email);
    smartLinks=smartLinks.filter(x=>!x.publisherId || x.publisherId===uid || x.userId===uid);
    clickLogs=clickLogs.filter(x=>!x.publisherId || x.publisherId===uid || x.userId===uid);
  }
}
export function requireLogin(){ if(!authChecked){document.getElementById('root')&&(document.getElementById('root').innerHTML='<div class=\"boot\">Loading...</div>'); return false;} if(!user){ location.href='login.html'; return false;} return true; }
export function goTelegram(){ const url=settings.telegramUrl || localStorage.getItem('telegramUrl') || 'https://t.me/'; window.open(url,'_blank'); }
window.goTelegram=goTelegram;
window.logoutUser=async()=>{await signOut(auth);location.href='login.html'};
window.closeModal=()=>document.getElementById('modal')?.classList.remove('show');
export function ensureModal(){
  if(!document.getElementById('modal')){
    document.body.insertAdjacentHTML('beforeend',`<div id="modal" class="modal"><div class="modalbox"><button type="button" class="close" onclick="closeModal()">×</button><div id="modalContent"></div></div></div>`);
  }
}
export function modal(html){ensureModal();document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.add('show')}

function roleLabel(){return isAdmin()?'ADMIN':(isAffiliate()?'AFF':'PUB')}
export function sidebar(active){
 const menu=[['dashboard.html','▦','Dashboard','dashboard'],['offers.html','▣','All Offers','offers'],['smartlinks.html','🔗','Smart Links','smart'],['reports.html','▤','Reports','reports'],['wallet.html','₹','Wallet','wallet'],['postback.html','⚙','Postback','postback'],['profile.html','♙','Profile','profile'],['support.html','?','Support','support']];
 if(isAdmin()) menu.push(['admin.html','🛠','Admin','admin']);
 return `<aside class="sidebar"><div class="side-logo">Effortless<span>Earn</span></div><div class="sub">PUBLISHER PANEL</div><div class="walletbox"><small>Wallet Balance</small><h1>₹${money(profile?.balance||0)}</h1><span class="idbadge">${roleLabel()}: ${(user?.uid||'').slice(0,8).toUpperCase()}</span></div><div class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}" onclick="return navigate('${m[3]}','${m[0]}')"><span>${m[1]}</span>${m[2]}<b>›</b></a>`).join('')}<a href="javascript:void(0)" onclick="goTelegram()"><span>✈</span>Join Telegram<b>›</b></a><a class="logout" href="javascript:void(0)" onclick="logoutUser()"><span>↪</span>Logout<b>›</b></a></div></aside>`;
}
export function shell(active,content){document.getElementById('root').innerHTML=`<div class="app">${sidebar(active)}<main class="main"><div class="topbar"><div><h1>${safe(active).toUpperCase()}</h1><p>${safe(profile?.name||profile?.email||'Publisher')}</p></div><button type="button" class="btn tg" onclick="goTelegram()">✈ Join Telegram</button></div>${content}</main></div>`}

export function getGoals(c){
 let goals=Array.isArray(c.goals)?c.goals:[];
 if(!goals.length){goals=[{name:c.goalName||'Task Complete',maxPayout:Number(c.companyPayout||c.maxPayout||c.reward||c.userReward||0),userReward:Number(c.userReward||c.reward||0),affiliateProfit:Number(c.affiliateCommission||c.profit||0)}]}
 return goals.map((g,i)=>({id:g.id||('g'+i),name:g.name||g.title||('Goal '+(i+1)),maxPayout:Number(g.maxPayout||g.payout||g.companyPayout||0),userReward:Number(g.userReward||g.reward||0),affiliateProfit:Number(g.affiliateProfit||g.profit||Math.max(0,Number(g.maxPayout||g.payout||0)-Number(g.userReward||g.reward||0)))}));
}
export function totalReward(c){return getGoals(c).reduce((a,g)=>a+Number(g.userReward||0),0)}
export function totalMax(c){return getGoals(c).reduce((a,g)=>a+Number(g.maxPayout||0),0) || Number(c.reward||0)}
export function totalProfit(c){return getGoals(c).reduce((a,g)=>a+Number(g.affiliateProfit||0),0)}

export function offerCards(list,admin=false){
 return list.length?list.map(d=>`<div class="offer"><div class="offerhead"><img src="${safe(d.image)}"><div><h3>${safe(d.title)}</h3><p class="muted">${safe(d.category||'CPA')} • ${getGoals(d).length} Goal</p></div><span class="tag ${d.status==='paused'?'bad':'green'}">${safe(d.status||'active')}</span></div><div class="earn"><span>Total Earnings</span><b>₹${money(totalMax(d))}</b></div><button type="button" onclick="openOffer('${d.id}')" class="btn full">Start Earning →</button>${admin?`<div class="actions"><button type="button" class="btn orange" onclick="editCampaignAdmin('${d.id}')">Edit</button><button type="button" class="btn blue" onclick="toggleCampaign('${d.id}','${d.status==='paused'?'active':'paused'}')">${d.status==='paused'?'Active':'Pause'}</button><button type="button" class="btn red" onclick="deleteCampaign('${d.id}')">Delete</button></div>`:''}</div>`).join(''):`<div class="empty">No data found</div>`;
}
function goalsTable(c){return `<div class="panel"><h3>Earning Breakdown</h3><table class="table" style="min-width:0"><tr><th>Event / Action</th><th>Max</th><th>Worker</th><th>Your Profit</th></tr>${getGoals(c).map(g=>`<tr><td>${safe(g.name)}</td><td>₹${money(g.maxPayout)}</td><td>₹${money(g.userReward)}</td><td class="greenText">₹${money(g.affiliateProfit)}</td></tr>`).join('')}</table></div>`}
window.openOffer=(id)=>{ const d=campaigns.find(x=>x.id===id); if(!d)return; const link=`${location.origin}${location.pathname.replace(/[^/]*$/,'')}campaign.html?id=${d.id}&pub=${user?.uid||''}`; modal(`<button type="button" class="close" onclick="closeModal()">×</button><div style="display:flex;gap:16px;align-items:center"><img class="preview" src="${safe(d.image)}"><div><span class="tag">${safe(d.category||'CPA')}</span><h1>${safe(d.title)}</h1><b class="greenText">Total Potential: ₹${money(totalMax(d))}</b></div></div><hr><div class="notice"><b>Terms & Conditions</b><p>${safe(d.terms||d.steps||'').replaceAll('\n','<br>')}</p></div><div class="linkbox"><b>Smart Tracking Link</b><div class="toolbar"><input class="field" value="${link}" readonly><button type="button" class="btn blue" onclick="navigator.clipboard.writeText('${link}');toast('Link copied')">Copy</button></div></div>${goalsTable(d)}<div class="notice"><b>Steps</b><p>${safe(d.instructions||d.steps||'Complete the required steps correctly.').replaceAll('\n','<br>')}</p></div><button type="button" class="btn green full" onclick="window.closeModal();return navigate('smart','smartlinks.html?campaign=${d.id}')">Create Smart Campaign</button>`); };



// Soft navigation: sidebar page changes without full browser reload.
window.navigate=(page,url)=>{ history.pushState({page},'',url); renderRoute(page); return false; };
window.addEventListener('popstate',()=>renderRoute(pageFromPath(location.pathname)));
function pageFromPath(path){let f=(path.split('/').pop()||'dashboard.html').replace('.html',''); if(!f)f='dashboard'; return f==='index'?'dashboard':(f==='smartlinks'?'smart':f);}
window.__renderRoute=renderRoute;
async function renderRoute(page){
  if(!authChecked) return;
  if(user){ try{ await loadData(); }catch(e){ console.warn('route data refresh failed',e); } }
  if(page==='dashboard') return renderDashboardPage();
  if(page==='offers') return renderOffersPage();
  if(page==='reports') return renderReportsPage();
  if(page==='smart') return renderSmartLinksPage();
  if(page==='wallet') return renderWalletPage();
  if(page==='postback') return renderPostbackPage();
  if(page==='profile') return renderProfilePage();
  if(page==='support') return renderSupportPage();
  if(page==='admin') { location.href='admin.html'; return; }
}
function renderDashboardPage(){
  if(!requireLogin())return;
  let pending=submissions.filter(x=>(x.status||'pending')==='pending').length, approved=submissions.filter(x=>x.status==='approved').length;
  shell('dashboard',`<div class="banner" onclick="goTelegram()"><b>✈ JOIN TELEGRAM CHANNEL</b><br><small>Get new offers & payment updates instantly.</small></div><div class="stats"><div class="stat"><span class="muted">Revenue</span><h2>₹${money(profile?.balance||0)}</h2><small>Total balance</small></div><div class="stat"><span class="muted">Pending</span><h2>${pending}</h2><small>Verification</small></div><div class="stat"><span class="muted">Conversions</span><h2>${approved}</h2><small>Approved leads</small></div><div class="stat"><span class="muted">Offers</span><h2>${campaigns.filter(x=>x.status!=='paused').length}</h2><small>Live campaigns</small></div></div><div class="section-title"><h2>Top Offers</h2></div><div class="offers">${offerCards(campaigns.filter(x=>x.status!=='paused').slice(0,6))}</div>`);
}
function renderOffersPage(){
  if(!requireLogin())return;
  shell('offers',`<div class="toolbar bigsearch"><input id="offerSearch" class="field" placeholder="Search offers..." oninput="filterOffers()"><select id="offerFilter" class="field smallSelect" onchange="filterOffers()"><option value="all">All Offers</option><option value="active">Active</option><option value="approved">My Approved</option></select></div><div id="offerGrid" class="offers">${offerCards(campaigns.filter(x=>x.status!=='paused'))}</div>`);
  window.filterOffers=()=>{let q=(document.getElementById('offerSearch')?.value||'').toLowerCase();document.getElementById('offerGrid').innerHTML=offerCards(campaigns.filter(x=>x.status!=='paused').filter(x=>(x.title||'').toLowerCase().includes(q)));};
}
let reportPage=1, reportFilter='all', reportCols={time:true,offer:true,event:true,payout:true,status:true,p1:true,p2:true,ip:false,source:false,sub1:false,sub2:false};
function reportStatus(r){return (r.status||r.type||'clicked').toLowerCase()}
function reportRowsData(){return [...submissions.map(x=>({...x,type:(x.status||'pending')})),...clickLogs.map(x=>({...x,type:'clicked'}))].sort((a,b)=>(b.time||b.createdAt||0)-(a.time||a.createdAt||0));}
function reportDate(t){const d=new Date(t||Date.now());return `<b>${d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</b><br><small>${d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small>`}
function reportRow(r){const st=reportStatus(r);return `<tr><td data-col="time">${reportDate(r.time||r.createdAt)}</td><td data-col="offer"><b>${safe(r.campaignTitle||r.offerName||r.campaignId||r.campaign||'-')}</b></td><td data-col="event"><span class="blueText">${safe(r.goalName||r.event||'BASE')}</span></td><td data-col="payout"><b class="greenText">${Number(r.reward||r.payout||0)?'₹'+money(r.reward||r.payout):'-'}</b></td><td data-col="status"><span class="status ${st}">${st}</span></td><td data-col="p1">${r.upi?String(r.upi).slice(0,8)+'***':(safe(r.p1||r.worker||'-'))}</td><td data-col="p2">${safe(r.p2||r.refer||'-')}</td><td data-col="ip">${safe(r.ip||r.ipAddress||'-')}</td><td data-col="source"><span class="sourceTag">${safe(r.source||'campaign')}</span></td><td data-col="sub1">${safe(r.sub1||'-')}</td><td data-col="sub2">${safe(r.sub2||'-')}</td></tr>`}
function getFilteredReports(){let q=(document.getElementById('q')?.value||'').toLowerCase();return (window._reports||[]).filter(x=>reportFilter==='all'||reportStatus(x)===reportFilter).filter(x=>(x.campaignTitle||x.offerName||x.campaignId||x.campaign||'').toLowerCase().includes(q));}
window.renderReportRows=()=>{let arr=getFilteredReports();let pages=Math.max(1,Math.ceil(arr.length/20));if(reportPage>pages)reportPage=pages;let start=(reportPage-1)*20;let pageArr=arr.slice(start,start+20);document.getElementById('rows').innerHTML=pageArr.map(reportRow).join('')||'<tr><td colspan="11" class="emptyCell">No Records Found</td></tr>';document.getElementById('pageInfo').textContent=`Page ${reportPage} / ${pages} • ${arr.length} records`;document.getElementById('prevPage').disabled=reportPage<=1;document.getElementById('nextPage').disabled=reportPage>=pages;applyReportCols();}
window.changeReportPage=(n)=>{reportPage+=n;renderReportRows()};
window.filterReport=(f='all')=>{reportFilter=f;reportPage=1;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===reportFilter));renderReportRows()};
window.toggleReportCol=(k,checked)=>{reportCols[k]=checked;applyReportCols()};
function applyReportCols(){Object.keys(reportCols).forEach(k=>document.querySelectorAll(`[data-col="${k}"]`).forEach(el=>el.style.display=reportCols[k]?'':'none'));}
function renderReportsPage(){
  if(!requireLogin())return; const all=reportRowsData(); window._reports=all; reportPage=1;
  const approved=all.filter(x=>reportStatus(x)==='approved').length, pending=all.filter(x=>reportStatus(x)==='pending').length;
  shell('reports',`<div class="report-tabs"><button type="button" data-tab="all" class="report-tab active" onclick="filterReport('all')">All <b>${all.length}</b></button><button type="button" data-tab="approved" class="report-tab paid" onclick="filterReport('approved')">Approved <b>${approved}</b></button><button type="button" data-tab="pending" class="report-tab pending" onclick="filterReport('pending')">Pending <b>${pending}</b></button></div><div class="panel report-head"><div><h2>Tracking History</h2><p class="muted">Offer, event, payout and status</p></div><input id="q" class="field report-search" placeholder="Search offer..." oninput="filterReport(reportFilter)"></div><div class="panel report-filter compact"><div class="checkgrid small">${Object.keys(reportCols).map(k=>`<label><input type="checkbox" ${reportCols[k]?'checked':''} onchange="toggleReportCol('${k}',this.checked)"> ${k.toUpperCase()}</label>`).join('')}</div></div><div class="tablewrap report-table"><table class="table"><thead><tr><th data-col="time">Time</th><th data-col="offer">Offer Name</th><th data-col="event">Event</th><th data-col="payout">Payout</th><th data-col="status">Status</th><th data-col="p1">P1 Worker</th><th data-col="p2">P2 Refer</th><th data-col="ip">IP Address</th><th data-col="source">Source</th><th data-col="sub1">Sub 1</th><th data-col="sub2">Sub 2</th></tr></thead><tbody id="rows"></tbody></table></div><div class="pager"><button id="prevPage" type="button" class="btn light" onclick="changeReportPage(-1)">← Previous</button><span id="pageInfo"></span><button id="nextPage" type="button" class="btn light" onclick="changeReportPage(1)">Next →</button></div>`); renderReportRows();
}

function smartBase(){return location.origin+location.pathname.replace(/[^/]*$/,'')}
function smartUrl(l){return smartBase()+'campaign.html?id='+(l.campaignId||'')+'&slug='+(l.slug||l.id)+'&pub='+(l.publisherId||user?.uid||'')}
function smartCard(l){
  const link=smartUrl(l);
  const goals=Array.isArray(l.goals)?l.goals:[];
  const worker=goals.reduce((a,g)=>a+Number(g.userReward||0),0);
  const profit=goals.reduce((a,g)=>a+Number(g.affiliateProfit||0),0);
  const c=campaigns.find(x=>x.id===l.campaignId)||{};
  return `<div class="smart-card pro-smart" id="smart_${l.id}">
    <div class="smart-card-head">
      <div class="smart-title"><img src="${safe(c.image||'')}"><div><h2>${safe(l.campaignTitle||l.offerName||c.title||'Smart Campaign')}</h2><p class="muted">${safe(l.slug||l.id)} • ${goals.length||1} goal</p></div></div>
      <div class="actions"><button type="button" class="iconbtn" title="Edit" onclick="openSmartBuilder('${l.campaignId}','${l.id}')">✎</button><button type="button" class="iconbtn danger" title="Delete" onclick="deleteSmartLive('${l.id}')">🗑</button></div>
    </div>
    <div class="smart-metrics"><span>Worker <b>₹${money(worker)}</b></span><span>Profit <b>₹${money(profit)}</b></span><span class="greenText">Active</span></div>
    <div class="smart-link blueSoft"><b>Tracking Link</b><div class="toolbar"><input class="field" value="${link}" readonly><button type="button" class="btn blue" onclick="navigator.clipboard.writeText('${link}');toast('Copied')">Copy</button></div></div>
  </div>`
}
function renderSmartLinksPage(){
  if(!requireLogin())return;
  const selectedId=new URLSearchParams(location.search).get('campaign')||'';
  const pre=campaigns.find(x=>x.id===selectedId)||null;
  const list=pre?smartLinks.filter(l=>l.campaignId===pre.id):smartLinks;
  shell('smart',`<div class="panel page-title"><div><h2>Smart Campaigns</h2><p class="muted">Create tracking links, set worker payout and manage profit.</p></div><button type="button" class="btn" onclick="openSmartBuilder('${pre?.id||''}')">＋ Add Campaign</button></div>${pre?`<div class="selected-offer-mini"><img src="${safe(pre.image||'')}"><div><b>${safe(pre.title||'Campaign')}</b><small>Max ₹${money(totalMax(pre))}</small></div><span class="tag green">Selected</span></div>`:''}<div class="smart-list" id="smartList">${list.map(smartCard).join('')||`<div class="empty">No smart campaign yet.</div>`}</div>`);
}
function activeCampaigns(){return campaigns.filter(x=>String(x.status||'active')!=='paused')}
function slugify(v){return String(v||'offer').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'offer'}
function offerSelectHtml(current=''){
  const locked=!!current;
  if(locked){ const c=campaigns.find(x=>x.id===current)||{}; return `<input id="smartOffer" type="hidden" value="${current}"><label class="mini">Selected Offer</label><div class="selected-offer-mini compact"><img src="${safe(c.image||'')}"><div><b>${safe(c.title||'Campaign')}</b><small>Max ₹${money(totalMax(c))}</small></div></div>`; }
  return `<label class="mini">Select Offer</label><select id="smartOffer" class="field" onchange="smartOfferChanged()"><option value="">-- Choose Offer --</option>${activeCampaigns().map(c=>`<option value="${c.id}">${safe(c.title||'Campaign')}</option>`).join('')}</select>`
}
function smartGoalHtml(c,l=null){
  const goals=(l?.goals?.length?l.goals:getGoals(c));
  return `<label class="mini">Campaign Title</label><input id="smartTitle" class="field" value="${safe(l?.campaignTitle||c.title||'')}"><label class="mini">Custom Slug</label><input id="smartSlug" class="field" value="${safe(l?.slug||'')}" placeholder="${safe(slugify(c.title))}"><div class="goal-panel smart-compact"><div class="toolbar"><b>Payout Calculator</b><label class="ref-toggle"><input type="checkbox" id="smartP2" ${l?.enableP2?'checked':''}> P2</label></div>${goals.map((g,i)=>`<div class="goalbox"><h3>${safe(g.name)} <span class="tag">Max ₹${money(g.maxPayout)}</span></h3><label class="mini">Worker Payout</label><input class="field smartSplit" data-max="${Number(g.maxPayout||0)}" data-name="${safe(g.name)}" value="${Number(g.userReward||0)}" type="number" min="0" max="${Number(g.maxPayout||0)}" oninput="calcProfit(this)"><div class="profitline">Profit ₹<span>${money(Math.max(0,Number(g.maxPayout||0)-Number(g.userReward||0)))}</span></div></div>`).join('')}</div><label class="mini">Worker Steps</label><textarea id="smartSteps" class="field" rows="3">${safe(l?.steps||c.instructions||c.steps||'Complete task carefully.')}</textarea><button type="button" class="btn full" id="saveSmartBtn" onclick="saveSmartLive('${l?.id||''}')">${l?'Save Changes':'Create Campaign'}</button>`
}
window.smartOfferChanged=()=>{const c=campaigns.find(x=>x.id===document.getElementById('smartOffer')?.value); document.getElementById('smartBuilderBody').innerHTML=c?smartGoalHtml(c):'<div class="empty small">Select an offer to continue.</div>';};
window.openSmartBuilder=(campaignId='', smartId='')=>{
  const l=smartLinks.find(x=>x.id===smartId)||null;
  const c=campaigns.find(x=>x.id===(campaignId||l?.campaignId));
  modal(`<h2>${l?'Edit':'New'} Campaign</h2>${offerSelectHtml(c?.id||'')}<div id="smartBuilderBody">${c?smartGoalHtml(c,l):'<div class="empty small">Select an offer to continue.</div>'}</div>`)
};
window.calcProfit=(el)=>{let max=Number(el.dataset.max||0), val=Math.min(max,Math.max(0,Number(el.value||0))); if(Number(el.value)>max){el.value=max;val=max} if(Number(el.value)<0){el.value=0;val=0} el.closest('.goalbox').querySelector('.profitline span').textContent=money(Math.max(0,max-val))};
window.saveSmartLive=async(smartId='')=>{
  try{
    if(!user?.uid){toast('Please login again');return}
    const btn=document.getElementById('saveSmartBtn'); if(btn){btn.disabled=true;btn.textContent='Saving...'}
    const campaignId=document.getElementById('smartOffer')?.value;
    if(!campaignId){toast('Select offer'); if(btn){btn.disabled=false;btn.textContent=smartId?'Save Changes':'Create Campaign'} return}
    const c=campaigns.find(x=>x.id===campaignId)||{};
    const gs=[...document.querySelectorAll('.smartSplit')].map((el,i)=>({id:'g'+i,name:el.dataset.name,maxPayout:Number(el.dataset.max||0),userReward:Number(el.value||0),affiliateProfit:Math.max(0,Number(el.dataset.max||0)-Number(el.value||0))}));
    const title=document.getElementById('smartTitle')?.value||c.title||'Campaign';
    const rawSlug=document.getElementById('smartSlug')?.value||slugify(title)+'-'+Date.now().toString().slice(-4);
    const payload={campaignId,campaignTitle:title,offerName:c.title||title,publisherId:user.uid,userId:user.uid,slug:slugify(rawSlug),goals:gs,enableP2:document.getElementById('smartP2')?.checked||false,steps:document.getElementById('smartSteps')?.value||'',updatedAt:Date.now()};
    if(smartId){await updateDoc(doc(db,'smart_links',smartId),payload)}else{payload.createdAt=Date.now(); const refDoc=await addDoc(collection(db,'smart_links'),payload); payload.id=refDoc.id; smartLinks.unshift(payload)}
    window.closeModal();
    await loadData();
    renderSmartLinksPage();
    toast(smartId?'Updated':'Smart campaign created');
  }catch(e){console.error(e); toast(e?.message||'Campaign not created');}
};
window.deleteSmartLive=async(id)=>{try{if(!confirm('Delete this smart campaign?'))return; await deleteDoc(doc(db,'smart_links',id)); smartLinks=smartLinks.filter(x=>x.id!==id); document.getElementById('smart_'+id)?.remove(); if(!document.querySelector('.smart-card')) renderSmartLinksPage(); toast('Deleted')}catch(e){console.error(e);toast(e?.message||'Delete failed')}};
function renderWalletPage(){
  if(!requireLogin())return;
  const history=[...withdraws.map(w=>({...w,kind:'Payout'})),...submissions.filter(s=>s.status==='approved').map(s=>({...s,kind:'Task',amount:s.reward||s.payout||0,name:s.campaignTitle||s.offerName||s.campaignId,status:'credit'}))].sort((a,b)=>(b.time||b.createdAt||0)-(a.time||a.createdAt||0));
  shell('wallet',`<div class="banner compact"><b>Wallet</b><small>Withdrawals and transaction history.</small></div><div class="grid2"><div class="panel payout-panel"><h2>Request Payout</h2><div class="balance-card"><span>Available Balance</span><strong>₹${money(profile?.balance||0)}</strong><em>Min Withdraw ₹100</em></div><input id="wname" class="field" placeholder="Name"><input id="wupi" class="field" placeholder="UPI ID"><input id="wamount" type="number" class="field" placeholder="Amount"><button type="button" onclick="requestWithdrawLive()" class="btn full">Withdraw Money →</button></div><div class="panel history-panel"><div class="panel-head"><h2>History</h2><span>${history.length}</span></div><div id="walletHistory" class="wallet-history">${history.slice(0,20).map(x=>`<div class="history-item"><div><b>${safe(x.name||x.kind||'Transaction')}</b><small>${compactDate(x.time||x.createdAt)} • ${safe(x.upi||x.status||'')}</small></div><strong class="${x.kind==='Task'?'greenText':''}">${x.kind==='Task'?'+':''}₹${money(x.amount||0)}</strong></div>`).join('')||'<div class="empty small">No history</div>'}</div></div></div>`);
}
window.requestWithdrawLive=async()=>{const amount=Number(document.getElementById('wamount')?.value||0); if(amount<100){toast('Minimum withdraw ₹100');return} if(amount>Number(profile?.balance||0)){toast('Balance low');return} await addDoc(collection(db,'withdrawals'),{userId:user.uid,email:user.email,name:document.getElementById('wname')?.value||'',upi:document.getElementById('wupi')?.value||'',amount,status:'pending',time:Date.now()}); await loadData(); renderWalletPage(); toast('Withdraw requested')};
function renderPostbackPage(){ if(!requireLogin())return; shell('postback',`<div class="panel"><h2>Global Postback URL</h2><div class="toolbar"><input class="field" placeholder="https://domain.com/callback?click_id={click_id}&payout={payout}&status={event_id}"><button type="button" class="btn">Save</button></div><div class="macro-grid"><span>{click_id}</span><span>{event_id}</span><span>{payout}</span><span>{p1_upi}</span><span>{ip}</span><span>{sub1}</span></div></div>`)}
function renderProfilePage(){ if(!requireLogin())return; shell('profile',`<div class="grid2"><div class="panel details-panel"><h2>Details</h2><p>Name <b>${safe(profile?.name||'')}</b></p><p>Email <b>${safe(profile?.email||user.email)}</b></p><p>ID <b>${safe(user.uid.slice(0,8).toUpperCase())}</b></p><p>Role <b>${safe(profile?.role||'user')}</b></p></div><div class="panel"><h2>Security</h2><input class="field" placeholder="Current Password"><input class="field" placeholder="New Password"><button type="button" class="btn full">Update</button></div></div>`)}
function renderSupportPage(){ if(!requireLogin())return; shell('support',`<div class="panel"><h2>Support Ticket</h2><input id="subject" class="field" placeholder="Subject"><textarea id="message" class="field" rows="5" placeholder="Message"></textarea><button type="button" onclick="sendTicketLive()" class="btn blue">Submit Ticket</button></div>`)}
window.sendTicketLive=async()=>{await addDoc(collection(db,'support'),{userId:user.uid,email:user.email,subject:document.getElementById('subject')?.value||'',message:document.getElementById('message')?.value||'',status:'open',time:Date.now()});toast('Ticket submitted')};

export async function submitLead({campaignId,goalId='',goalName='',upi='',note='',proofUrl=''}){
 const c=campaigns.find(x=>x.id===campaignId)||{}; const goal=getGoals(c).find(g=>g.id===goalId)||getGoals(c)[0]||{};
 await addDoc(collection(db,'lead_submissions'),{campaignId,campaign:campaignId,campaignTitle:c.title||'',goalId:goal.id||goalId,goalName:goal.name||goalName,userId:user?.uid||'',publisherId:user?.uid||'',email:user?.email||'',upi,note,proof:proofUrl,status:'pending',reward:Number(goal.userReward||0),affiliateProfit:Number(goal.affiliateProfit||0),time:Date.now()});
}

window.addEventListener('error',e=>{console.error(e.error||e.message); try{toast('Error: '+(e.message||'Something failed'))}catch(_){}});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason); try{toast('Error: '+(e.reason?.message||'Request failed'))}catch(_){}});
