import { auth, db, storage } from './firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[], support=[];
export const $ = id => document.getElementById(id);
export const money = n => '₹' + Number(n||0).toLocaleString('en-IN');
export const safe = v => String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
export const baseUrl = () => location.origin + location.pathname.replace(/[^/]*$/,'');

export async function init(){
  document.addEventListener('click', e => {
    const b=e.target.closest('button'); if(b && !b.type) b.type='button';
    const a=e.target.closest('a[href="#"]'); if(a) e.preventDefault();
  });
  onAuthStateChanged(auth, async u => {
    user=u;
    if(u){
      const snap=await getDoc(doc(db,'users',u.uid));
      profile=snap.exists()?{id:u.uid,...snap.data()}:{id:u.uid,email:u.email,balance:0,role:'user'};
    } else profile=null;
    await loadData();
    window.renderPage && window.renderPage();
  });
}

export async function loadData(){
  try{
    campaigns=(await getDocs(query(collection(db,'campaigns'),limit(300)))).docs.map(d=>({id:d.id,...d.data()}));
    if(user && profile?.role==='admin'){
      submissions=(await getDocs(query(collection(db,'submissions'),limit(500)))).docs.map(d=>({id:d.id,...d.data()}));
      withdraws=(await getDocs(query(collection(db,'withdraws'),limit(500)))).docs.map(d=>({id:d.id,...d.data()}));
      users=(await getDocs(query(collection(db,'users'),limit(500)))).docs.map(d=>({id:d.id,...d.data()}));
      support=(await getDocs(query(collection(db,'support'),limit(200)))).docs.map(d=>({id:d.id,...d.data()}));
    } else if(user){
      submissions=(await getDocs(query(collection(db,'submissions'),where('userId','==',user.uid),limit(200)))).docs.map(d=>({id:d.id,...d.data()}));
      withdraws=(await getDocs(query(collection(db,'withdraws'),where('userId','==',user.uid),limit(100)))).docs.map(d=>({id:d.id,...d.data()}));
      users=[]; support=[];
    }
  }catch(e){ console.error(e); toast('Data load error: '+e.message,'red'); }
}

export function requireLogin(){ if(!user){ location.replace('login.html'); return false; } return true; }
export function requireAdmin(){ return requireLogin() && profile?.role==='admin'; }

export function sidebar(active){
  const menu=[['dashboard.html','🏠','Dashboard','dashboard'],['offers.html','🎯','All Offers','offers'],['smartlinks.html','🔗','Smart Links','smart'],['reports.html','📊','Reports','reports'],['wallet.html','💳','Wallet','wallet'],['postback.html','⚙️','Postback','postback'],['profile.html','👤','Profile','profile'],['support.html','💬','Support','support']];
  if(profile?.role==='admin') menu.push(['admin.html','🛠️','Admin','admin']);
  return `<aside class="sidebar"><div class="side-logo">Effortless<span>Earn</span></div><div class="sub">PUBLISHER PANEL</div><div class="walletbox"><small>Wallet Balance</small><h1>${money(profile?.balance)}</h1><span class="idbadge">ID: ${safe(user?.uid?.slice(0,8).toUpperCase()||'PUB')}</span></div><div class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}"><span>${m[1]}</span>${m[2]}<span style="margin-left:auto">›</span></a>`).join('')}<a href="#" onclick="logoutUser()"><span>↪</span>Logout</a></div></aside>`;
}
export function shell(active,content){ $('root').innerHTML=`<div class="app">${sidebar(active)}<main class="main"><div class="page-top"><div><h1>${active[0].toUpperCase()+active.slice(1)}</h1><p>Welcome, ${safe(profile?.name||user?.email||'User')}</p></div><button type="button" class="btn light" onclick="location.reload()">↻ Refresh</button></div>${content}</main></div>`; }
export function modal(html){ $('modalContent').innerHTML=html; $('modal').classList.add('show'); }
window.closeModal=()=> $('modal')?.classList.remove('show');
window.logoutUser=async()=>{ await signOut(auth); location.replace('index.html'); };
window.copyText=async t=>{ await navigator.clipboard.writeText(t); toast('Link copied'); };
export function toast(msg,type='green'){ let d=document.createElement('div'); d.className='toast '+type; d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),3000); }

export function offerCards(list){
  const active=list.filter(x=>x.status!=='paused');
  return active.length ? active.map(d=>`<div class="offer"><div class="offerhead"><img src="${safe(d.image||'')}" loading="lazy"><div><h3>${safe(d.title)}</h3><p class="muted">${safe(d.category||'CPA')} • CPA</p></div><span class="tag ${safe(d.status||'active')}" style="margin-left:auto">${safe(d.status||'active')}</span></div><div class="earn"><span>User Reward</span><span>${money(d.reward)}</span></div><div class="mini">Admin payout: ${money(d.companyPayout)} • Profit: ${money(d.profit)}</div><button type="button" onclick="openOffer('${d.id}')" class="btn full">Start Earning →</button></div>`).join('') : `<div class="empty">No offers found.</div>`;
}

window.openOffer=(id)=>{
  const d=campaigns.find(x=>x.id===id); if(!d) return toast('Offer not found','red');
  const link=`${baseUrl()}campaign.html?id=${d.id}&pub=${user?.uid||''}`;
  modal(`<img class="preview" src="${safe(d.image||'')}"><h1>${safe(d.title)}</h1><p><span class="tag">${safe(d.category||'CPA')}</span> <b style="color:#16a34a">Reward: ${money(d.reward)}</b></p><div class="panel soft"><b>Terms & Instructions</b><p>${safe(d.steps||'Complete all steps.').replaceAll('\n','<br>')}</p></div><div class="linkbox"><b>Your Smart Tracking Link</b><input class="field" value="${safe(link)}" readonly><button type="button" class="btn blue" onclick="copyText('${link}')">Copy Link</button></div><input id="upi" class="field" placeholder="UPI ID for cashback"><input id="proof" type="file" class="field" accept="image/*"><textarea id="note" class="field" placeholder="Note"></textarea><button type="button" onclick="submitTask('${d.id}')" class="btn green full">Submit Task</button>`);
};
window.submitTask=async(id)=>{
  try{
    const d=campaigns.find(x=>x.id===id); let proofUrl='', f=$('proof').files[0];
    if(f){ const r=ref(storage,'proof/'+Date.now()+'-'+f.name); await uploadBytes(r,f); proofUrl=await getDownloadURL(r); }
    await addDoc(collection(db,'submissions'),{campaign:id,campaignId:id,campaignTitle:d?.title||'',reward:Number(d?.reward||0),companyPayout:Number(d?.companyPayout||0),profit:Number(d?.profit||0),userId:user.uid,email:user.email,upi:$('upi').value.trim(),note:$('note').value.trim(),proof:proofUrl,status:'pending',time:Date.now()});
    toast('Task submitted'); closeModal(); setTimeout(()=>location.href='reports.html',500);
  }catch(e){ toast(e.message,'red'); }
};

export async function setLeadStatus(id,status){
  const s=submissions.find(x=>x.id===id); if(!s) return;
  await updateDoc(doc(db,'submissions',id),{status,updatedAt:Date.now(),approvedBy:user.uid});
  if(status==='approved' && s.userId) await updateDoc(doc(db,'users',s.userId),{balance:increment(Number(s.reward||0))});
}
