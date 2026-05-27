
import { auth, db, storage } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export let user=null, profile=null, campaigns=[], submissions=[], withdraws=[], users=[];
export const $=id=>document.getElementById(id);

export async function init(){
  onAuthStateChanged(auth, async(u)=>{
    user=u;
    if(u){
      let s=await getDoc(doc(db,"users",u.uid));
      profile=s.exists()?s.data():{email:u.email,balance:0,role:"user"};
    }
    await loadData();
    window.renderPage && window.renderPage();
  });
}

export async function loadData(){
  try{
    campaigns=(await getDocs(collection(db,"campaigns"))).docs.map(d=>({id:d.id,...d.data()}));
    submissions=(await getDocs(collection(db,"submissions"))).docs.map(d=>({id:d.id,...d.data()}));
    withdraws=(await getDocs(collection(db,"withdraws"))).docs.map(d=>({id:d.id,...d.data()}));
    users=(await getDocs(collection(db,"users"))).docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){console.log(e)}
}

export function sidebar(active){
  const menu=[
    ["dashboard.html","▦","DASHBOARD","dashboard"],
    ["offers.html","▣","ALL OFFERS","offers"],
    ["smartlinks.html","🔗","SMART LINKS","smart"],
    ["reports.html","▤","REPORTS","reports"],
    ["wallet.html","₹","WALLET","wallet"],
    ["postback.html","⚙","POSTBACK","postback"],
    ["profile.html","♙","PROFILE","profile"],
    ["support.html","?","SUPPORT","support"],
    ["admin.html","🛠","ADMIN","admin"]
  ];
  return `<aside class="sidebar">
    <div class="side-logo">EFFORTLESS<span>CPA</span></div><div class="sub">PUBLISHER PANEL</div>
    <div class="walletbox"><small>WALLET BALANCE</small><h1>₹${profile?.balance||0}</h1><span class="idbadge">ID: ${user?.uid?.slice(0,8).toUpperCase()||"PUB"}</span></div>
    <div class="menu">${menu.map(m=>`<a class="${active===m[3]?'active':''}" href="${m[0]}"><span>${m[1]}</span>${m[2]}<span style="margin-left:auto">›</span></a>`).join("")}
    <a href="#" onclick="logoutUser()"><span>↪</span>LOGOUT</a></div>
  </aside>`;
}
export function shell(active,content){document.getElementById("root").innerHTML=`<div class="app">${sidebar(active)}<main class="main">${content}</main></div>`}
export function requireLogin(){ if(!user){ location.href="login.html"; return false;} return true;}
export function modal(html){document.getElementById("modalContent").innerHTML=html;document.getElementById("modal").classList.add("show")}
window.closeModal=()=>document.getElementById("modal").classList.remove("show");
window.logoutUser=async()=>{await signOut(auth);location.href="index.html"};

export function offerCards(list){
  return list.length?list.map(d=>`<div class="offer"><div class="offerhead"><img src="${d.image||''}"><div><h3>${d.title||''}</h3><p class="muted">${d.category||'CPA'} • CPA</p></div><span class="tag" style="margin-left:auto">${d.status||'active'}</span></div><div class="earn"><span>TOTAL EARNINGS</span><span>₹${d.reward||0}</span></div><button onclick="openOffer('${d.id}')" class="btn full">START EARNING →</button></div>`).join(""):`<div class="panel">No offers found. Admin se offer add karo.</div>`;
}

window.openOffer=(id)=>{
  const d=campaigns.find(x=>x.id===id);
  modal(`<img class="preview" src="${d.image||''}"><h1>${d.title}</h1><p><span class="tag">${d.category}</span> <b style="color:#16a34a">Total Potential: ₹${d.reward}</b></p><div class="panel" style="color:#7f1d1d"><b>IMPORTANT TERMS & CONDITIONS:</b><p>${(d.steps||'Complete all steps.').replaceAll("\\n","<br>")}</p></div><div class="linkbox"><b>YOUR SMART TRACKING LINK</b><input class="field" value="${location.origin}${location.pathname.replace(/[^/]*$/,'')}campaign.html?id=${d.id}" readonly></div><input id="upi" class="field" placeholder="UPI ID for cashback"><input id="proof" type="file" class="field" accept="image/*"><textarea id="note" class="field" placeholder="Note"></textarea><button onclick="submitTask('${d.id}')" class="btn green full">SUBMIT TASK</button>`);
}
window.submitTask=async(id)=>{
  let proofUrl="", f=document.getElementById("proof").files[0];
  if(f){let r=ref(storage,"proof/"+Date.now()+"-"+f.name);await uploadBytes(r,f);proofUrl=await getDownloadURL(r)}
  await addDoc(collection(db,"submissions"),{campaign:id,campaignTitle:campaigns.find(x=>x.id===id)?.title||"",userId:user.uid,email:user.email,upi:document.getElementById("upi").value,note:document.getElementById("note").value,proof:proofUrl,status:"pending",time:Date.now()});
  alert("Task submitted. Admin approval pending."); closeModal(); location.href="reports.html";
}
