import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[], smartLinks=[], settings={telegramUrl:""};
export const $=id=>document.getElementById(id);
export const isAdmin=()=>profile?.role==='admin' || profile?.isAdmin===true;
const safe=(v)=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

window.addEventListener('click',e=>{ const a=e.target.closest('a[href="#"]'); if(a)e.preventDefault(); });
window.addEventListener('submit',e=>e.preventDefault());

async function getCollection(name){ try{return (await getDocs(collection(db,name))).docs.map(d=>({id:d.id,_collection:name,...d.data()}));}catch(e){console.warn('Load failed:',name,e.message);return []} }
export async function init(){
  document.body.insertAdjacentHTML('afterbegin','<div id="loading" class="loading">Loading...</div>');
  onAuthStateChanged(auth, async(u)=>{
    user=u;
    if(u){
      const s=await getDoc(doc(db,"users",u.uid));
      if(s.exists()) profile={id:u.uid,...s.data()};
      else { profile={id:u.uid,email:u.email,balance:0,role:"user",createdAt:Date.now()}; await setDoc(doc(db,"users",u.uid),profile,{merge:true}); }
    } else profile=null;
    await loadData();
    document.getElementById('loading')?.remove();
    window.renderPage && window.renderPage();
  });
}
export async function loadData(){
  campaigns=await getCollection('campaigns');
  const s1=await getCollection('submissions'), s2=await getCollection('lead_submissions');
  submissions=[...s1,...s2];
  const w1=await getCollection('withdraws'), w2=await getCollection('withdrawals');
  withdraws=[...w1,...w2];
  smartLinks=await getCollection('smart_links');
  const set=await getDoc(doc(db,'settings','main')).catch(()=>null); if(set?.exists()) settings={...settings,...set.data()};
  if(isAdmin()) users=await getCollection('users'); else users=profile?[profile]:[];
  if(!isAdmin() && user){ submissions=submissions.filter(x=>x.userId===user.uid || x.publisherId===user.uid || x.uid===user.uid || x.email===user.email); withdraws=withdraws.filter(x=>x.userId===user.uid || x.uid===user.uid || x.email===user.email); }
}
export function requireLogin(){ if(!user){ location.href='login.html'; return false;} return true;}
export function goTelegram(){ const url=settings.telegramUrl || localStorage.getItem('telegramUrl') || 'https://t.me/'; window.open(url,'_blank'); }
window.goTelegram=goTelegram;
export function sidebar(active){
 const menu=[["dashboard.html","▦","Dashboard","dashboard"],["offers.html","▣","All Offers","offers"],["smartlinks.html","🔗","Smart Links","smart"],["reports.html","▤","Reports","reports"],["wallet.html","₹","Wallet","wallet"],["postback.html","⚙","Postback","postback"],["profile.html","♙","Profile","profile"],["support.html","?","Support","support"]];
 if(isAdmin()) menu.push(["admin.html","🛠","Admin","admin"]);
 return `<aside class="sidebar"><div class="side-logo">Effortless<span>Earn</span></div><div class="sub">PUBLISHER PANEL</div><div class="walletbox"><small>Wallet Balance</small><h1>₹${profile?.balance||0}</h1><span class="idbadge">${isAdmin()?'ADMIN':'PUB'}: ${(user?.uid||'').slice(0,8).toUpperCase()}</span></div><div class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}"><span>${m[1]}</span>${m[2]}<b>›</b></a>`).join('')}<a href="#" onclick="logoutUser()"><span>↪</span>Logout<b>›</b></a></div></aside>`;
}
export function shell(active,content){document.getElementById('root').innerHTML=`<div class="app">${sidebar(active)}<main class="main"><div class="topbar"><div><h1>${safe(active).toUpperCase()}</h1><p>Welcome, ${safe(profile?.name||profile?.email||'Publisher')}</p></div><button type="button" class="btn tg" onclick="goTelegram()">✈ Join Telegram</button></div>${content}</main></div>`}
export function modal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.add('show')}
window.closeModal=()=>document.getElementById('modal')?.classList.remove('show');
window.logoutUser=async()=>{await signOut(auth);location.href='login.html'};

export function offerCards(list,admin=false){
 return list.length?list.map(d=>`<div class="offer"><div class="offerhead"><img src="${safe(d.image)}"><div><h3>${safe(d.title)}</h3><p class="muted">${safe(d.category||'CPA')} • ₹${d.reward||d.userReward||0}</p></div><span class="tag ${d.status==='paused'?'bad':''}">${safe(d.status||'active')}</span></div><p>${safe((d.steps||'Complete steps').slice(0,100))}</p><button type="button" onclick="openOffer('${d.id}')" class="btn full">Start Earning →</button>${admin?`<div class="actions"><button type="button" class="btn orange" onclick="toggleCampaign('${d.id}','${d.status==='paused'?'active':'paused'}')">${d.status==='paused'?'Active':'Pause'}</button><button type="button" class="btn red" onclick="deleteCampaign('${d.id}')">Delete</button></div>`:''}</div>`).join(''):`<div class="empty">No data found. Admin se data add karo ya Firestore rules check karo.</div>`;
}
window.openOffer=(id)=>{ const d=campaigns.find(x=>x.id===id); if(!d)return; const link=`${location.origin}${location.pathname.replace(/[^/]*$/,'')}campaign.html?id=${d.id}&pub=${user?.uid||''}`; modal(`<img class="preview" src="${safe(d.image)}"><h1>${safe(d.title)}</h1><p><span class="tag">${safe(d.category||'CPA')}</span> <b class="greenText">Reward ₹${d.reward||d.userReward||0}</b></p><div class="notice"><b>Terms</b><p>${safe(d.steps||'Complete all steps.').replaceAll('\n','<br>')}</p></div><div class="linkbox"><b>Your Tracking Link</b><input class="field" value="${link}" readonly><button type="button" class="btn blue" onclick="navigator.clipboard.writeText('${link}');alert('Copied')">Copy</button></div><input id="upi" class="field" placeholder="UPI ID"><input id="proof" type="file" class="field" accept="image/*"><textarea id="note" class="field" placeholder="Note"></textarea><button type="button" onclick="submitTask('${d.id}')" class="btn green full">Submit Task</button>`); };
window.submitTask=async(id)=>{ let proofUrl='', f=document.getElementById('proof')?.files?.[0]; if(f){let r=ref(storage,'proof/'+Date.now()+'-'+f.name);await uploadBytes(r,f);proofUrl=await getDownloadURL(r)} const c=campaigns.find(x=>x.id===id)||{}; await addDoc(collection(db,'lead_submissions'),{campaignId:id,campaign:id,campaignTitle:c.title||'',userId:user.uid,publisherId:user.uid,email:user.email,upi:upi.value,note:note.value,proof:proofUrl,status:'pending',reward:Number(c.reward||c.userReward||0),time:Date.now()}); alert('Task submitted'); closeModal(); await loadData(); window.renderPage(); };
