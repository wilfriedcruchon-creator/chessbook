(function(){
"use strict";
const d=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
async function tryPw(pw){
  const E=window.ENC, enc=new TextEncoder();
  const km=await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:d(E.s),iterations:E.n,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
  const buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:d(E.i)},key,d(E.c));
  window.FICHES=JSON.parse(new TextDecoder().decode(buf));
}
function start(){ const s=document.createElement("script"); s.src="app.js?v="+Date.now(); document.body.appendChild(s); }
const box=document.createElement("div");
box.style.cssText="position:fixed;inset:0;background:#f6f3ee;display:flex;align-items:center;justify-content:center;z-index:99;font-family:Segoe UI,system-ui,sans-serif";
box.innerHTML='<form style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:28px;max-width:340px;width:90%;text-align:center"><h2 style="margin:0 0 6px;font-family:Georgia,serif">Tsubasa</h2><p style="color:#666;margin:0 0 16px">Accès protégé</p><input type="password" placeholder="Mot de passe" autocomplete="current-password" style="width:100%;padding:10px;border:1px solid #bbb;border-radius:8px;font-size:16px;box-sizing:border-box"><button style="margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#9a4a1f;color:#fff;font-size:16px">Entrer</button><p class="e" style="color:#b33;min-height:1.2em;margin:10px 0 0"></p></form>';
async function attempt(pw,silent){
  try{ await tryPw(pw); try{localStorage.setItem("pw",pw)}catch(e){} box.remove(); start(); return true; }
  catch(e){ if(!silent) box.querySelector(".e").textContent="Mot de passe incorrect."; return false; }
}
document.body.appendChild(box);
const f=box.querySelector("form"), inp=box.querySelector("input");
f.onsubmit=async ev=>{ ev.preventDefault(); box.querySelector(".e").textContent="…"; await attempt(inp.value,false); };
let saved=null; try{saved=localStorage.getItem("pw")}catch(e){}
if(saved) attempt(saved,true);
})();
