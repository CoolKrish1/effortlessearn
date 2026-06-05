import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[], smartLinks=[], clickLogs=[], settings={telegramUrl:""};
export const $=id=>document.getElementById(id);
export const isAdmin=()=>profile?.role==='admin' || profile?.isAdmin===true;
export const isAffiliate=()=>['affiliate','admin'].includes(profile?.role) || isAdmin();
const safe=(v)=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
export const money=(n)=>Number(n||0).toLocaleString('en-IN');

// Global anti-refresh guard: form submit, blank # links and buttons without type.
document.addEventListener('submit',e=>e.preventDefault(),true);
document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(btn && !btn.getAttribute('type')) btn.setAttribute('type','button');
  const a=e.target.closest('a[href="#"],a[href=""],a[href="javascript:void(0)"]');
  if(a)e.preventDefault();
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
export function requireLogin(){ if(!user){ location.href='login.html'; return false;} return true; }
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
window.openOffer=(id)=>{ const d=campaigns.find(x=>x.id===id); if(!d)return; const link=`${location.origin}${location.pathname.replace(/[^/]*$/,'')}campaign.html?id=${d.id}&pub=${user?.uid||''}`; modal(`<button type="button" class="close" onclick="closeModal()">×</button><div style="display:flex;gap:16px;align-items:center"><img class="preview" src="${safe(d.image)}"><div><span class="tag">${safe(d.category||'CPA')}</span><h1>${safe(d.title)}</h1><b class="greenText">Total Potential: ₹${money(totalMax(d))}</b></div></div><hr><div class="notice"><b>Terms & Conditions</b><p>${safe(d.terms||d.steps||'').replaceAll('\n','<br>')}</p></div><div class="linkbox"><b>Smart Tracking Link</b><div class="toolbar"><input class="field" value="${link}" readonly><button type="button" class="btn blue" onclick="navigator.clipboard.writeText('${link}');toast('Link copied')">Copy</button></div></div>${goalsTable(d)}<div class="notice"><b>Steps</b><p>${safe(d.instructions||d.steps||'Complete the required steps correctly.').replaceAll('\n','<br>')}</p></div><button type="button" class="btn green full" onclick="location.assign('smartlinks.html?campaign=${d.id}')">Create Smart Campaign</button>`); };



// Soft navigation: sidebar page changes without full browser reload.
window.navigate=(page,url)=>{ history.pushState({page},'',url); renderRoute(page); return false; };
window.addEventListener('popstate',()=>renderRoute(pageFromPath(location.pathname)));
function pageFromPath(path){let f=(path.split('/').pop()||'dashboard.html').replace('.html',''); return f==='index'?'dashboard':(f==='smartlinks'?'smart':f);}
function renderRoute(page){
  window.scrollTo({top:0,behavior:'instant'});
  if(page==='dashboard') return renderDashboardPage();
  if(page==='offers') return renderOffersPage();
  if(page==='reports') return renderReportsPage();
  if(page==='smart') { location.href='smartlinks.html'; return; }
  if(page==='wallet') { location.href='wallet.html'; return; }
  if(page==='postback') { location.href='postback.html'; return; }
  if(page==='profile') { location.href='profile.html'; return; }
  if(page==='support') { location.href='support.html'; return; }
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

export async function submitLead({campaignId,goalId='',goalName='',upi='',note='',proofUrl=''}){
 const c=campaigns.find(x=>x.id===campaignId)||{}; const goal=getGoals(c).find(g=>g.id===goalId)||getGoals(c)[0]||{};
 await addDoc(collection(db,'lead_submissions'),{campaignId,campaign:campaignId,campaignTitle:c.title||'',goalId:goal.id||goalId,goalName:goal.name||goalName,userId:user?.uid||'',publisherId:user?.uid||'',email:user?.email||'',upi,note,proof:proofUrl,status:'pending',reward:Number(goal.userReward||0),affiliateProfit:Number(goal.affiliateProfit||0),time:Date.now()});
}
