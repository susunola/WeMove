'use strict';
// Reuse native SDK connections; changed credentials receive a different pool key.
const clients=new Map();
function getClient(key,create){let entry=clients.get(key);if(entry){entry.at=Date.now();return entry.client}if(clients.size>=8){const oldest=[...clients].sort((a,b)=>a[1].at-b[1].at).find(([,e])=>!e.used);if(oldest){oldest[1].client.destroy();clients.delete(oldest[0])}}const client=create();clients.set(key,{client,at:Date.now(),used:0});return client}
function retain(key){const entry=clients.get(key);if(entry)entry.used++;return()=>{if(entry)entry.used=Math.max(0,entry.used-1)}}
function closeClients(){for(const e of clients.values())e.client.destroy();clients.clear()}
module.exports={getClient,retain,closeClients};
