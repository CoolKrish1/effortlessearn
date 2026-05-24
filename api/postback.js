const PROJECT_ID = "effortless-earn-7f39e";
const API_KEY = "AIzaSyDxdJ6f2WtbfIzjBjQDybxCSYYYEkTgc0E";

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getValue(v){
if(!v) return null;
if(v.stringValue !== undefined) return v.stringValue;
if(v.integerValue !== undefined) return Number(v.integerValue);
if(v.doubleValue !== undefined) return Number(v.doubleValue);
return null;
}

function makeFields(obj){
let fields={};

for(const key in obj){
const val=obj[key];

if(typeof val==="number"){
fields[key]={integerValue:val};
}else{
fields[key]={stringValue:String(val)};
}
}

return {fields};
}

async function runQuery(collectionId,field,value){
const res=await fetch(`${BASE}:runQuery?key=${API_KEY}`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
structuredQuery:{
from:[{collectionId}],
where:{
fieldFilter:{
field:{fieldPath:field},
op:"EQUAL",
value:{stringValue:value}
}
},
limit:10
}
})
});

const data=await res.json();
return data.filter(x=>x.document).map(x=>x.document);
}

async function patchDoc(docName,data){
await fetch(`https://firestore.googleapis.com/v1/${docName}?key=${API_KEY}`,{
method:"PATCH",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(makeFields(data))
});
}

async function getUser(userId){
const res=await fetch(`${BASE}/users/${userId}?key=${API_KEY}`);
if(!res.ok) return null;
return await res.json();
}

export default async function handler(req,res){

const trackingId=req.query.trackingId;
const payout=Number(req.query.payout || 0);
const status=req.query.status || "approved";

if(!trackingId){
return res.status(400).json({
success:false,
message:"trackingId missing"
});
}

/* 1. Find click log */
const clicks=await runQuery("click_logs","trackingId",trackingId);

if(clicks.length===0){
return res.status(404).json({
success:false,
message:"Click not found",
trackingId
});
}

const clickDoc=clicks[0];
const click=clickDoc.fields;

const slug=getValue(click.slug);
const publisherId=getValue(click.publisherId);
const campaignId=getValue(click.campaignId);

/* 2. Find smart link */
const smartLinks=await runQuery("smart_links","slug",slug);

if(smartLinks.length===0){
return res.status(404).json({
success:false,
message:"Smart link not found",
slug
});
}

const smart=smartLinks[0].fields;

const title=getValue(smart.title) || "Campaign";
const userReward=Number(getValue(smart.userReward) || 0);
const affiliateCommission=Number(getValue(smart.affiliateCommission) || 0);

const companyPayout=payout;
const profit=companyPayout - userReward - affiliateCommission;

/* 3. Update click status */
await patchDoc(clickDoc.name,{
status,
payout:companyPayout,
updatedAt:Date.now()
});

/* 4. Add affiliate report */
await fetch(`${BASE}/affiliate_reports?key=${API_KEY}`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(makeFields({
trackingId,
slug,
campaignId,
publisherId,
offerName:title,
companyPayout,
userReward,
affiliateCommission,
profit,
status,
time:Date.now()
}))
});

/* 5. Add publisher commission to wallet */
if(status==="approved" && publisherId){

const user=await getUser(publisherId);

let oldBalance=0;

if(user && user.fields && user.fields.balance){
oldBalance=Number(getValue(user.fields.balance) || 0);
}

await patchDoc(
`projects/${PROJECT_ID}/databases/(default)/documents/users/${publisherId}`,
{
balance:oldBalance + affiliateCommission
}
);

}

/* 6. Add revenue share log */
await fetch(`${BASE}/revenue_share?key=${API_KEY}`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(makeFields({
trackingId,
slug,
publisherId,
campaignId,
companyPayout,
userReward,
affiliateCommission,
profit,
status,
time:Date.now()
}))
});

return res.status(200).json({
success:true,
trackingId,
slug,
publisherId,
companyPayout,
userReward,
affiliateCommission,
profit,
status,
message:"Smart postback processed"
});

}
