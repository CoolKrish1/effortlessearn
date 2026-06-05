import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], smartLinks=[], submissions=[], withdraws=[], users=[], clickLogs=[], transactions=[], supportTickets=[], settings={telegramUrl:"",siteName:"EffortlessEarn"};
export let authReady=false;
export const $=id=>document.getElementById(id);
export const safe=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
export const money=v=>'₹'+Number(v||0).toLocaleString('en-IN');
export const now=()=>Date.now();
export const uid=()=>user?.uid||'';
export const isAdmin=()=>profile?.role==='admin'||profile?.isAdmin===true;
export const isAffiliate=()=>isAdmin()||profile?.role==='affiliate'||profile?.role==='publisher';
export const canManageLink=l=>isAdmin()||l.publisherId===uid()||l.ownerId===uid();

window.addEventListener('click',e=>{const a=e.target.closest('a[href="#"]'); if(a){e.preventDefault();}});
window.addEventListener('submit',e=>e.preventDefault());

async function all(name){try{return (await getDocs(collection(db,name))).docs.map(d=>({id:d.id,_collection:name,...d.data()}));}catch(e){console.warn('Firestore load failed:',name,e.message);return []}}
async function readSettings(){try{const s=await getDoc(doc(db,'settings','main')); if(s.exists()) settings={...settings,...s.data()};}catch(e){}}
export async function init(){
  if(!document.getElementById('loading')) document.body.insertAdjacentHTML('afterbegin','<div id="loading" class="loading"><div class="loaderCard">Loading panel...</div></div>');
  onAuthStateChanged(auth, async(u)=>{
    user=u; authReady=true;
    if(u){
      const s=await getDoc(doc(db,'users',u.uid)).catch(()=>null);
      if(s?.exists()) profile={id:u.uid,...s.data()};
      else { profile={id:u.uid,email:u.email,name:u.displayName||'',balance:0,role:'affiliate',createdAt:now()}; await setDoc(doc(db,'users',u.uid),profile,{merge:true}); }
    } else profile=null;
    await loadData();
    document.getElementById('loading')?.remove();
    window.renderPage && window.renderPage();
  });
}
export async function loadData(){
  await readSettings();
  campaigns=(await all('campaigns')).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  smartLinks=(await all('smart_links')).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  submissions=[...(await all('lead_submissions')),...(await all('submissions'))].sort((a,b)=>(b.time||b.createdAt||0)-(a.time||a.createdAt||0));
  withdraws=[...(await all('withdrawals')),...(await all('withdraws'))].sort((a,b)=>(b.createdAt||b.time||0)-(a.createdAt||a.time||0));
  clickLogs=(await all('click_logs')).sort((a,b)=>(b.createdAt||b.time||0)-(a.createdAt||a.time||0));
  transactions=(await all('transactions')).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  supportTickets=(await all('support_tickets')).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  users=isAdmin()?await all('users'):(profile?[profile]:[]);
  if(!isAdmin()&&user){
    const me=uid(), email=user.email;
    smartLinks=smartLinks.filter(x=>x.publisherId===me||x.ownerId===me||x.email===email);
    submissions=submissions.filter(x=>x.publisherId===me||x.userId===me||x.ownerId===me||x.email===email);
    withdraws=withdraws.filter(x=>x.publisherId===me||x.userId===me||x.uid===me||x.email===email);
    clickLogs=clickLogs.filter(x=>x.publisherId===me||x.userId===me||x.ownerId===me||x.email===email);
    transactions=transactions.filter(x=>x.userId===me||x.publisherId===me||x.email===email);
    supportTickets=supportTickets.filter(x=>x.userId===me||x.email===email);
  }
}
export function requireLogin(){ if(!authReady) return false; if(!user){location.replace('login.html'); return false;} return true; }
export async function refresh(){ await loadData(); window.renderPage&&window.renderPage(); }
export function goTelegram(){const url=settings.telegramUrl||localStorage.getItem('telegramUrl')||'https://t.me/'; window.open(url,'_blank','noopener');}
window.goTelegram=goTelegram;
window.logoutUser=async()=>{await signOut(auth);location.replace('login.html')};

export function sidebar(active){
 const menu=[['dashboard.html','▦','Dashboard','dashboard'],['offers.html','▣','All Offers','offers'],['smartlinks.html','🔗','Smart Links','smart'],['reports.html','▤','Reports','reports'],['wallet.html','₹','Wallet','wallet'],['postback.html','⚙','Postback','postback'],['profile.html','♙','Profile','profile'],['support.html','?','Support','support']];
 if(isAdmin()) menu.push(['admin.html','🛠','Admin','admin']);
 return `<aside class="sidebar"><div class="brand"><div class="brandIcon">E</div><div><b>${safe(settings.siteName||'EffortlessEarn')}</b><small>PUBLISHER PANEL</small></div></div><div class="walletbox"><small>Wallet Balance</small><h1>${money(profile?.balance||0)}</h1><span class="idbadge">${isAdmin()?'ADMIN':'AFF'} ${(uid()||'--------').slice(0,8).toUpperCase()}</span></div><nav class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}"><span>${m[1]}</span>${m[2]}<b>›</b></a>`).join('')}<a href="#" onclick="logoutUser()"><span>↪</span>Logout<b>›</b></a></nav></aside>`;
}
export function shell(active,content){
 const root=document.getElementById('root');
 root.innerHTML=`<div class="app">${sidebar(active)}<main class="main"><div class="topbar"><div><h1>${safe(active).toUpperCase()}</h1><p>Welcome, ${safe(profile?.name||profile?.email||'Publisher')}</p></div><button type="button" class="btn tg" onclick="goTelegram()">✈ Join Telegram</button></div>${content}</main></div><div id="modal" class="modal"><div class="modalbox"><button type="button" class="close" onclick="closeModal()">×</button><div id="modalContent"></div></div></div>`;
}
export function modal(html){let m=document.getElementById('modal'); if(!m){document.body.insertAdjacentHTML('beforeend','<div id="modal" class="modal"><div class="modalbox"><button type="button" class="close" onclick="closeModal()">×</button><div id="modalContent"></div></div></div>');m=document.getElementById('modal')} document.getElementById('modalContent').innerHTML=html;m.classList.add('show')}
window.closeModal=()=>document.getElementById('modal')?.classList.remove('show');

export function baseUrl(){return location.origin+location.pathname.replace(/[^/]*$/,'');}
export function trackingLink(campaignId, publisherId=uid(), smartId=''){return `${baseUrl()}campaign.html?id=${encodeURIComponent(campaignId)}&pub=${encodeURIComponent(publisherId)}${smartId?`&sid=${encodeURIComponent(smartId)}`:''}`}
export function campaignPayout(c){return Number(c.networkPayout||c.companyPayout||c.payout||c.reward||0)}
export function defaultReward(c){return Number(c.userReward||c.reward||0)}
export function profit(c, reward){return Math.max(0,campaignPayout(c)-Number(reward||0))}

export function offerCards(list,admin=false){
 if(!list.length) return `<div class="empty">No campaigns found. Admin panel se campaign add karo.</div>`;
 return list.map(d=>`<div class="offer"><div class="offerhead"><img src="${safe(d.image||'')}" onerror="this.style.display='none'"><div><h3>${safe(d.title||'Campaign')}</h3><p class="muted">${safe(d.category||'CPA')} • Max ${money(campaignPayout(d))}</p></div><span class="tag ${d.status==='paused'?'bad':''}">${safe(d.status||'active')}</span></div><p>${safe((d.steps||'Complete steps and submit valid details.').slice(0,120))}</p><div class="split"><div><small>User Reward</small><b>${money(defaultReward(d))}</b></div><div><small>Affiliate Profit</small><b>${money(profit(d,defaultReward(d)))}</b></div></div><div class="actions"><button type="button" onclick="openOffer('${d.id}')" class="btn blue">Start Earning</button><button type="button" onclick="quickSmart('${d.id}')" class="btn light">Create Link</button>${admin?`<button type="button" class="btn orange" onclick="editCampaign('${d.id}')">Edit</button><button type="button" class="btn red" onclick="deleteCampaign('${d.id}')">Delete</button>`:''}</div></div>`).join('');
}
window.openOffer=(id)=>{const d=campaigns.find(x=>x.id===id); if(!d)return; modal(`<div class="offerModal"><img class="preview" src="${safe(d.image||'')}"><h1>${safe(d.title||'Campaign')}</h1><p><span class="tag">${safe(d.category||'CPA')}</span> <b class="greenText">Max Payout ${money(campaignPayout(d))}</b></p><div class="notice"><b>Terms & Steps</b><p>${safe(d.steps||'Complete valid task.').replaceAll('\n','<br>')}</p></div><div class="grid2"><div><label>Worker/User Reward</label><input id="mReward" class="field" type="number" value="${defaultReward(d)}" oninput="calcModalProfit('${id}')"></div><div><label>Your Profit</label><input id="mProfit" class="field" value="${money(profit(d,defaultReward(d)))}" readonly></div></div><button type="button" class="btn blue full" onclick="createSmartFromModal('${id}')">Create Smart Tracking Link</button></div>`);};
window.calcModalProfit=(id)=>{const d=campaigns.find(x=>x.id===id); if($('mProfit')) $('mProfit').value=money(profit(d,Number($('mReward').value||0)));};
window.createSmartFromModal=async(id)=>{await createSmartLink(id,Number($('mReward').value||0)); closeModal(); await refresh(); location.href='smartlinks.html';};
window.quickSmart=async(id)=>{await createSmartLink(id,defaultReward(campaigns.find(x=>x.id===id)||{})); alert('Smart link created'); await refresh();};
export async function createSmartLink(campaignId,userReward,slug=''){
 const c=campaigns.find(x=>x.id===campaignId)||{}; const max=campaignPayout(c); const reward=Math.max(0,Math.min(Number(userReward||0),max));
 return await addDoc(collection(db,'smart_links'),{campaignId,campaignTitle:c.title||'',publisherId:uid(),email:user?.email||'',slug:slug||('sl-'+Date.now()),networkPayout:max,userReward:reward,affiliateCommission:max-reward,status:'active',createdAt:now()});
}
export async function uploadFile(file,path){if(!file)return ''; const r=ref(storage,path+'/'+Date.now()+'-'+file.name); await uploadBytes(r,file); return await getDownloadURL(r);}
