
const enc = new TextEncoder();
const cookieOptions = "; Path=/; HttpOnly; Secure; SameSite=Lax";
const SESSION = "__Host-botwatch";
const STATE = "__Host-botwatch-state";
function cookie(req,name) {
 return (req.headers.get("Cookie") || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1) || "";
}
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); }
function unb64(s) { return Uint8Array.from(atob(s.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0)); }
async function key(env) { return crypto.subtle.importKey("raw",enc.encode(env.SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]); }
async function sign(payload,env) {
 const data=b64(enc.encode(payload));
 return data+"."+b64(new Uint8Array(await crypto.subtle.sign("HMAC",await key(env),enc.encode(data))));
}
async function authenticated(req,env) {
 try {
  const [data,sig,extra]=cookie(req,SESSION).split(".");
  if (!data || !sig || extra) return false;
  if (!await crypto.subtle.verify("HMAC",await key(env),unb64(sig),enc.encode(data))) return false;
  const [id,expires]=new TextDecoder().decode(unb64(data)).split(":");
  return id===env.OWNER_GITHUB_ID && Number(expires)>Date.now();
 } catch { return false; }
}
function response(body,status=200,extra={}) {
 return new Response(body,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  ...extra
 }});
}
function redirect(path,cookies=[]) {
 const r=response(null,302,{Location:path}); cookies.forEach(c=>r.headers.append("Set-Cookie",c));return r;
}
const escape = x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function page(body,refresh=false) {
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 (refresh?'<meta http-equiv="refresh" content="60">':'')+
 '<title>Bot Watch</title><style>body{margin:0;background:#1a202c;color:#d9edff;font:17px/1.6 Arial,sans-serif}main{max-width:1050px;margin:24px auto;padding:24px;background:#2d3748;border-radius:14px}a,button{color:#d9edff}a.button,button{display:inline-block;padding:10px 16px;border:1px solid #85dbce66;border-radius:8px;background:linear-gradient(100deg,#124493,#08736b,#068a32);text-decoration:none;font:inherit;cursor:pointer}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #ffffff30}.table{overflow-x:auto}.note{color:#c9deee;font-size:14px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}</style><main>'+body+'</main></html>';
}
function apps(env) { return JSON.parse(env.APPS_JSON || "{}"); }
function cors(origin) { return {"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"600"}; }
async function collect(req,env) {
 const origin=req.headers.get("Origin") || "";
 const allowed=(env.ALLOWED_ORIGINS || "").split(",").map(x=>x.trim()).filter(Boolean);
 if(!allowed.includes(origin)) return response("Origin not allowed",403);
 if(req.method==="OPTIONS") return response(null,204,cors(origin));
 if(req.method!=="POST") return response("Method not allowed",405,cors(origin));
 if(!(req.headers.get("Content-Type") || "").startsWith("application/json")) return response("JSON required",415,cors(origin));
 if(Number(req.headers.get("Content-Length") || 0)>1024) return response("Too large",413,cors(origin));
 const reader=req.body?.getReader(); if(!reader) return response("Empty body",400,cors(origin));
 const chunks=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024){await reader.cancel();return response("Too large",413,cors(origin));}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let event;try{event=JSON.parse(new TextDecoder().decode(bytes));}catch{return response("Invalid JSON",400,cors(origin));}
 const {app,source,sid}=event;
 if(!Object.hasOwn(apps(env),app)||!["web","discord"].includes(source)||typeof sid!=="string"||! /^[a-f0-9-]{36}$/.test(sid))
  return response("Invalid event",400,cors(origin));
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 // D1 batch is transactional: only a new anonymous page session increases launches.
 await env.DB.batch([
  env.DB.prepare("INSERT INTO daily(app,source,day,launches) SELECT ?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM sessions WHERE app=? AND source=? AND sid=?) ON CONFLICT(app,source,day) DO UPDATE SET launches=launches+1").bind(app,source,day,app,source,sid),
  env.DB.prepare("INSERT INTO sessions(app,source,sid,seen) VALUES(?,?,?,?) ON CONFLICT(app,source,sid) DO UPDATE SET seen=excluded.seen").bind(app,source,sid,now)
 ]);
 return response(null,204,cors(origin));
}
async function dashboard(env) {
 const today=new Date().toISOString().slice(0,10);
 const totals=(await env.DB.prepare("SELECT app,source,SUM(launches) AS total,SUM(CASE WHEN day=? THEN launches ELSE 0 END) AS today FROM daily GROUP BY app,source").bind(today).all()).results;
 const active=(await env.DB.prepare("SELECT app,source,COUNT(*) AS active FROM sessions WHERE seen>? GROUP BY app,source").bind(Date.now()-300000).all()).results;
 const recent=(await env.DB.prepare("SELECT day,app,source,launches FROM daily WHERE day>=? ORDER BY day DESC,app,source").bind(new Date(Date.now()-29*86400000).toISOString().slice(0,10)).all()).results;
 const names=apps(env);let rows="";
 for(const [id,name] of Object.entries(names)) {
  const own=totals.filter(x=>x.app===id),live=active.filter(x=>x.app===id);
  for(const source of ["web","discord","combined"]) {
   const sum=(arr,col)=>arr.filter(x=>source==="combined"||x.source===source).reduce((n,x)=>n+Number(x[col]),0);
   rows+="<tr><td>"+escape(name)+"</td><td>"+escape(source)+"</td><td>"+sum(own,"today")+"</td><td>"+sum(own,"total")+"</td><td>"+sum(live,"active")+"</td></tr>";
  }
 }
 const days=recent.map(x=>"<tr><td>"+escape(x.day)+"</td><td>"+escape(names[x.app]||x.app)+"</td><td>"+escape(x.source)+"</td><td>"+Number(x.launches)+"</td></tr>").join("");
 return response(page('<header><h1>Bot Watch</h1><form method="post" action="/logout"><button>Sign out</button></form></header><p>Private dashboard · GitHub owner access only</p><h2>App usage</h2><div class="table"><table><thead><tr><th>App</th><th>Source</th><th>Launches today</th><th>Total launches</th><th>Active sessions ≈</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="note">Days use UTC. Active means a signal within the last five minutes. Sessions and launches are not unique people; reloads count as new launches. Refreshes every minute. Public usage signals can be spoofed or blocked. This is approximate usage, not a server-install count.</p><h2>Last 30 days</h2><div class="table"><table><thead><tr><th>Date</th><th>App</th><th>Source</th><th>Launches</th></tr></thead><tbody>'+days+'</tbody></table></div>',true),200,{"Content-Type":"text/html; charset=utf-8"});
}
export default {
 async fetch(req,env) {
  try {
   const url=new URL(req.url);
   if(url.pathname==="/collect") return await collect(req,env);
   if(!env.OWNER_GITHUB_ID||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)
    return response("Bot Watch is not configured yet.",503);
   if(url.pathname==="/login"&&req.method==="GET"){
    const state=crypto.randomUUID();const auth=new URL("https://github.com/login/oauth/authorize");
    auth.searchParams.set("client_id",env.GITHUB_CLIENT_ID);
    auth.searchParams.set("redirect_uri",url.origin+"/callback");
    auth.searchParams.set("state",state);
    auth.searchParams.set("scope","");
    return redirect(auth.href,[STATE+"="+state+cookieOptions+"; Max-Age=600"]);
   }
   if(url.pathname==="/callback"&&req.method==="GET"){
    const state=url.searchParams.get("state"),code=url.searchParams.get("code");
    const clear=STATE+"="+cookieOptions+"; Max-Age=0";
    if(!state||state!==cookie(req,STATE)||!code) return response("Sign-in expired or invalid. Start again at /login.",400,{"Set-Cookie":clear});
    const tokenResponse=await fetch("https://github.com/login/oauth/access_token",{
     method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},
     body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:url.origin+"/callback"})
    });
    const token=await tokenResponse.json();
    if(!tokenResponse.ok||!token.access_token) return response("GitHub sign-in failed.",401,{"Set-Cookie":clear});
    const profileResponse=await fetch("https://api.github.com/user",{headers:{Authorization:"Bearer "+token.access_token,Accept:"application/vnd.github+json","User-Agent":"Bot-Watch"}});
    const profile=await profileResponse.json();
    if(!profileResponse.ok||String(profile.id)!==env.OWNER_GITHUB_ID)
     return response("This dashboard is restricted to its owner.",403,{"Set-Cookie":clear});
    // Token is used for this identity check only; never saved or sent to the browser.
    return redirect("/",[clear,SESSION+"="+await sign(env.OWNER_GITHUB_ID+":"+(Date.now()+8*3600000),env)+cookieOptions+"; Max-Age=28800"]);
   }
   if(url.pathname==="/logout"&&req.method==="POST"){
    if(req.headers.get("Origin")!==url.origin) return response("Forbidden",403);
    return redirect("/",[SESSION+"="+cookieOptions+"; Max-Age=0"]);
   }
   if(url.pathname==="/"&&req.method==="GET"){
    if(!await authenticated(req,env)) return response(page('<h1>Bot Watch</h1><p>Usage statistics are private. Sign in with the owner’s GitHub account.</p><a class="button" href="/login">Sign in with GitHub</a>'),200,{"Content-Type":"text/html; charset=utf-8"});
    return await dashboard(env);
   }
   return response("Not found",404);
  } catch { return response("Temporarily unavailable. Please try again.",503); }
 },
 async scheduled(event,env) {
  await env.DB.prepare("DELETE FROM sessions WHERE seen<?").bind(Date.now()-86400000).run();
 }
};
