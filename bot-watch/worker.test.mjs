import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "./worker.js";
globalThis.crypto ||= webcrypto;
const env={OWNER_GITHUB_ID:"253505737",GITHUB_CLIENT_ID:"test",GITHUB_CLIENT_SECRET:"test-secret",SESSION_SECRET:"s".repeat(64),APPS_JSON:'{"wct":"World Clock Together"}',ALLOWED_ORIGINS:"https://madisastateofmind.github.io"};
test("unauthenticated visitors receive sign-in, never private statistics",async()=>{
 let queried=false;
 const r=await worker.fetch(new Request("https://watch.example/"),{...env,DB:{prepare(){queried=true;throw Error("Must not query");}}});
 assert.equal(r.status,200);assert.match(await r.text(),/Sign in with GitHub/);assert.equal(queried,false);
 assert.equal(r.headers.get("Cache-Control"),"no-store");
});
test("forged session is denied",async()=>{
 const r=await worker.fetch(new Request("https://watch.example/",{headers:{Cookie:"__Host-botwatch=forged.invalid"}}),env);
 assert.match(await r.text(),/Sign in with GitHub/);
});
test("invalid OAuth state is rejected",async()=>{
 const r=await worker.fetch(new Request("https://watch.example/callback?state=bad&code=test",{headers:{Cookie:"__Host-botwatch-state=good"}}),env);
 assert.equal(r.status,400);
});
test("valid login for another GitHub account is rejected",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>Response.json(url.includes("access_token")?{access_token:"private-test-token"}:{id:999});
 try{
  const r=await worker.fetch(new Request("https://watch.example/callback?state=good&code=test",{headers:{Cookie:"__Host-botwatch-state=good"}}),env);
  assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/private-test-token/);
 }finally{globalThis.fetch=old;}
});
test("owner gets secure signed cookie, token is not exposed",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>Response.json(url.includes("access_token")?{access_token:"private-test-token"}:{id:253505737});
 try{
  const r=await worker.fetch(new Request("https://watch.example/callback?state=good&code=test",{headers:{Cookie:"__Host-botwatch-state=good"}}),env);
  assert.equal(r.status,302);
  const cookies=r.headers.get("Set-Cookie");assert.match(cookies,/HttpOnly/);assert.match(cookies,/Secure/);assert.doesNotMatch(cookies,/private-test-token/);
  const value=cookies.match(/__Host-botwatch=([^;]+)/)[1];
  const db={prepare(){return {bind(){return this},async all(){return {results:[]}}}}};
  const dash=await worker.fetch(new Request("https://watch.example/",{headers:{Cookie:"__Host-botwatch="+value}}),{...env,DB:db});
  assert.match(await dash.text(),/Total launches/);
 }finally{globalThis.fetch=old;}
});
test("foreign origin cannot send metrics",async()=>{
 const r=await worker.fetch(new Request("https://watch.example/collect",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},body:"{}"}),env);
 assert.equal(r.status,403);
});
test("unknown app is rejected",async()=>{
 const r=await worker.fetch(new Request("https://watch.example/collect",{method:"POST",headers:{Origin:"https://madisastateofmind.github.io","Content-Type":"application/json"},body:JSON.stringify({app:"unknown",source:"web",sid:crypto.randomUUID()})}),env);
 assert.equal(r.status,400);
});
test("valid metrics use transactional duplicate-safe counting",async()=>{
 let statements;
 const db={prepare(sql){return {sql,bind(...args){this.args=args;return this}}},async batch(s){statements=s}};
 const r=await worker.fetch(new Request("https://watch.example/collect",{method:"POST",headers:{Origin:"https://madisastateofmind.github.io","Content-Type":"application/json"},body:JSON.stringify({app:"wct",source:"web",sid:crypto.randomUUID()})}),{...env,DB:db});
 assert.equal(r.status,204);assert.equal(statements.length,2);assert.match(statements[0].sql,/NOT EXISTS/);
});
