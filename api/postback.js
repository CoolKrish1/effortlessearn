const PROJECT_ID = "effortless-earn-7f39e";
const API_KEY = "AIzaSyDxdJ6f2WtbfIzjBjQDybxCSYYYEkTgc0E";

const BASE =
`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getValue(v){
if(v.stringValue !== undefined) return v.stringValue;
if(v.integerValue !== undefined) return Number(v.integerValue);
if(v.doubleValue !== undefined) return Number(v.doubleValue);
return null;
}

function makeFields(obj){
let fields = {};
for(const key in obj){
const val = obj[key];

if(typeof val === "number"){
fields[key] = { integerValue: val };
}else{
fields[key] = { stringValue: String(val) };
}
}
return { fields };
}

async function findByTracking(collection, trackingId){
const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`,{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
structuredQuery:{
from:[{ collectionId:collection }],
where:{
fieldFilter:{
field:{ fieldPath:"trackingId" },
op:"EQUAL",
value:{ stringValue:trackingId }
}
},
limit:10
}
})
});

const data = await res.json();
return data.filter(x=>x.document).map(x=>x.document);
}

async function patchDoc(docName, data){
await fetch(
`https://firestore.googleapis.com/v1/${docName}?key=${API_KEY}`,
{
method:"PATCH",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify(makeFields(data))
}
);
}

async function getUser(userId){
const res = await fetch(`${BASE}/users/${userId}?key=${API_KEY}`);
if(!res.ok) return null;
return await res.json();
}

export default async function handler(req,res){

const trackingId = req.query.trackingId;
const payout = Number(req.query.payout || 0);
const status = req.query.status || "approved";

if(!trackingId){
return res.status(400).json({
success:false,
message:"trackingId missing"
});
}

const apps = await findByTracking("applications",trackingId);

if(apps.length === 0){
return res.status(404).json({
success:false,
message:"No application found for trackingId",
trackingId
});
}

const appDoc = apps[0];
const appData = appDoc.fields;

const userId = getValue(appData.userId);
const reward = payout || getValue(appData.reward) || 0;

await patchDoc(appDoc.name,{
status:status,
approvedAt:Date.now()
});

const reports = await findByTracking("reports",trackingId);

for(const r of reports){
await patchDoc(r.name,{
status:status,
payout:reward,
updatedAt:Date.now()
});
}

if(status === "approved" && userId){
const user = await getUser(userId);
const oldBalance =
user && user.fields && user.fields.balance
? getValue(user.fields.balance)
: 0;

await patchDoc(
`projects/${PROJECT_ID}/databases/(default)/documents/users/${userId}`,
{
balance: oldBalance + reward
}
);
}

return res.status(200).json({
success:true,
trackingId,
userId,
status,
payout:reward,
message:"Postback processed successfully"
});

}
