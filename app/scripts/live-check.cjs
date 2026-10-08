/* global __dirname */
/* Read-only smoke check against the configured backend. Never prints tokens/passwords. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const dotenv = require(path.join(root, 'backend/node_modules/dotenv'));
const backendEnv = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env')));
const base = process.env.MOBILE_API_URL || 'http://localhost:5000/api';
const password = process.env.DEMO_PASSWORD || backendEnv.DEMO_PASSWORD;
async function main() {
  if (!password) throw new Error('Set DEMO_PASSWORD in the backend environment before checking seeded accounts.');
  for (const [alias, role] of [['villager','villager'],['liaison','liaison-officer'],['ranger','ranger'],['manager','park-manager'],['analyst','data-analyst']]) {
    const login = await fetch(base+'/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:alias+'@wildguard.lk',password}),signal:AbortSignal.timeout(20000)});
    if (!login.ok) throw new Error(role+' login returned HTTP '+login.status);
    const session = await login.json();
    async function get(url) { const res=await fetch(base+url,{headers:{Authorization:'Bearer '+session.token},signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error(role+' '+url.split('?')[0]+' returned HTTP '+res.status);return res.json(); }
    const profile=await get('/auth/me');if(profile.user.role!==role)throw new Error('Unexpected seeded role.');
    const {parks}=await get('/parks');const park=profile.user.park||parks[0]?.id;
    const endpoints={villager:['/conflicts/mine'],'liaison-officer':['/conflicts?view=new'],ranger:['/response-tasks/mine','/patrol/my-assignment','/incidents/mine'],'park-manager':['/patrol/coverage?parkId='+park,'/response-tasks/approvals','/reports?status=finalized'],'data-analyst':['/analytics/options','/reports']}[role];
    for(const endpoint of [...endpoints,'/notifications/me'])await get(endpoint);
    console.log(role+': login, session, parks and '+(endpoints.length+1)+' authorized reads passed');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
