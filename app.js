
import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[], smartLinks=[], revenueShare=[], siteSettings={telegramUrl:'https://t.me/YOUR_CHANNEL_USERNAME',brandName:'Effortless Earn'};
export const $=id=>document.getElementById(id);
const baseUrl=()=>location.origin+location.pathname.replace(/[^/]*$/,'');
const safe=v=>(v??'').toString().replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

// Stop accidental form submit / page refresh on button clicks
window.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) e.preventDefault();
}, true);
window.addEventListener('submit', e => e.preventDefault(), true);

export async function init(){
  onAuthStateChanged(auth, async(u)=>{
    user=u;
    if(u){
      let s=await getDoc(doc(db,"users",u.uid));
      if(!s.exists()) await setDoc(doc(db,"users",u.uid),{email:u.email,balance:0,role:"user",createdAt:Date.now()});
      s=await getDoc(doc(db,"users",u.uid));
      profile={id:u.uid,...s.data()};
    }
    await loadData();
    window.renderPage && window.renderPage();
  });
}
async function readCol(name){try{return (await getDocs(collection(db,name))).docs.map(d=>({id:d.id,_col:name,...d.data()}));}catch(e){console.warn(name,e);return []}}
export async function loadData(){
  campaigns=await readCol('campaigns');
  users=await readCol('users');
  smartLinks=await readCol('smart_links');
  revenueShare=await readCol('revenue_share');
  const sets=await readCol('settings');
  const mainSet=sets.find(x=>x.id==='site')||sets[0];
  Object.assign(siteSettings,{telegramUrl:mainSet?.telegramUrl||'https://t.me/YOUR_CHANNEL_USERNAME',brandName:mainSet?.brandName||'Effortless Earn',supportUrl:mainSet?.supportUrl||''});
  submissions=[...(await readCol('submissions')),...(await readCol('lead_submissions'))];
  withdraws=[...(await readCol('withdraws')),...(await readCol('withdrawals'))];
}
export async function refresh(){await loadData(); window.renderPage&&window.renderPage();}
export function requireLogin(){ if(!user){ location.href='login.html'; return false;} return true;}
export function modal(html){$('modalContent').innerHTML=html;$('modal').classList.add('show')}
window.closeModal=()=>$('modal')?.classList.remove('show');
window.logoutUser=async()=>{await signOut(auth);location.href='index.html'};

export function sidebar(active){
 const brand=safe(siteSettings.brandName||'Effortless Earn').replace(' ','<span>')+'</span>';
 const menu=[["dashboard.html","🏠","Dashboard","dashboard"],["offers.html","🎯","All Offers","offers"],["smartlinks.html","🔗","Smart Links","smart"],["reports.html","📊","Reports","reports"],["wallet.html","💳","Wallet","wallet"],["postback.html","⚙️","Postback","postback"],["profile.html","👤","Profile","profile"],["support.html","💬","Support","support"],...(profile?.role==='admin' ? [["admin.html","🛠️","Admin","admin"]] : [])];
 return `<aside class="sidebar"><div class="side-logo">${brand}</div><div class="sub">Publisher Panel</div><div class="walletbox"><small>Wallet Balance</small><h1>₹${profile?.balance||0}</h1><span class="idbadge">${safe(user?.email||'Guest')}</span></div><div class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}"><span>${m[1]}</span>${m[2]}</a>`).join('')}<a href="javascript:void(0)" onclick="logoutUser()"><span>↪</span>Logout</a></div></aside>`
}
export function shell(active,content){
  const y = window.scrollY || 0;
  $('root').innerHTML=`<div class="app">${sidebar(active)}<main class="main"><div class="topbar"><div><h1>${active[0].toUpperCase()+active.slice(1)}</h1><p>Auto synced with Firebase</p></div><b class="rolePill">● ${safe(profile?.role||'user')}</b></div>${content}</main></div>`;
  setTimeout(()=>window.scrollTo(0,y),0);
}
export function offerCards(list, admin=false){
 return list.length?list.map(d=>`<div class="offer"><div class="offerhead"><img src="${safe(d.image||d.logo||'')}" onerror="this.style.display='none'"><div><h3>${safe(d.title||d.name||'Untitled Offer')}</h3><p class="muted">${safe(d.category||'CPA')} • ₹${d.reward||d.userReward||0}</p></div><span class="tag ${d.status==='paused'?'paused':'active'}">${safe(d.status||'active')}</span></div><div class="earn"><span>User Reward</span><span>₹${d.reward||d.userReward||0}</span></div><button type="button" onclick="openOffer('${d.id}')" class="btn full">Start Earning →</button>${admin?`<div class="actions"><button type="button" class="btn light" onclick="toggleCampaign('${d.id}','${d.status==='paused'?'active':'paused'}')">${d.status==='paused'?'Activate':'Pause'}</button><button type="button" class="btn red" onclick="deleteCampaign('${d.id}')">Delete</button></div>`:''}</div>`).join(''):`<div class="empty">No data found in Firebase.</div>`;
}
window.openOffer=(id)=>{const d=campaigns.find(x=>x.id===id); if(!d)return; const link=`${baseUrl()}campaign.html?id=${d.id}`; modal(`<img class="preview" src="${safe(d.image||'')}"><h1>${safe(d.title||'Offer')}</h1><p><span class="tag active">${safe(d.category||'CPA')}</span> <b class="greenText">Reward: ₹${d.reward||d.userReward||0}</b></p><div class="note"><b>Steps / Terms</b><p>${safe(d.steps||d.description||'Complete all steps and submit proof.').replaceAll('\n','<br>')}</p></div><div class="linkbox"><b>Your Tracking Link</b><input class="field" value="${link}" readonly><button type="button" class="btn blue full" onclick="navigator.clipboard.writeText('${link}');alert('Link copied')">Copy Link</button></div><input id="upi" class="field" placeholder="UPI ID"><input id="proof" type="file" class="field" accept="image/*"><textarea id="note" class="field" placeholder="Note"></textarea><button type="button" onclick="submitTask('${d.id}')" class="btn green full">Submit Task</button>`)};
window.submitTask=async(id)=>{let proofUrl='', f=$('proof')?.files?.[0]; if(f){let r=ref(storage,'proof/'+Date.now()+'-'+f.name); await uploadBytes(r,f); proofUrl=await getDownloadURL(r)} const c=campaigns.find(x=>x.id===id)||{}; await addDoc(collection(db,'lead_submissions'),{campaignId:id,campaignTitle:c.title||'',userId:user.uid,email:user.email,upi:$('upi')?.value||'',note:$('note')?.value||'',proof:proofUrl,status:'pending',time:Date.now(),userReward:Number(c.reward||c.userReward||0)}); alert('Submitted'); closeModal(); await refresh()};
export const api={db,storage,collection,addDoc,doc,updateDoc,deleteDoc,increment,setDoc,refresh,baseUrl,safe,siteSettings};
