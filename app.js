(function(){
"use strict";
const F = window.FICHES || [];
const GLYPH = {k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
const FILES = "abcdefgh";
const $ = (s,el=document)=>el.querySelector(s);
const esc = s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

function parseFen(fen){
  const rows = fen.split(" ")[0].split("/"), b = [];
  for(const r of rows){ const row=[]; for(const ch of r){ if(/\d/.test(ch)) for(let i=0;i<+ch;i++) row.push(null); else row.push(ch);} b.push(row);}
  return b;
}
function sqXY(sq, flip){
  const f = FILES.indexOf(sq[0]), r = +sq[1]-1;
  return flip ? [7-f, r] : [f, 7-r];
}
function boardSVG(fen, o={}){
  const flip = o.orientation==="b", S=44, M=16, W=S*8+M*2;
  const b = parseFen(fen);
  let s = `<svg viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagramme">`;
  s += `<rect width="${W}" height="${W}" fill="#3b3229"/>`;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const light=(x+y)%2===0;
    s += `<rect x="${M+x*S}" y="${M+y*S}" width="${S}" height="${S}" fill="${light?"#f0d9b5":"#b58863"}"/>`;
  }
  for(const sq of (o.cases||[])){ const [x,y]=sqXY(sq,flip); s+=`<rect x="${M+x*S}" y="${M+y*S}" width="${S}" height="${S}" fill="#ffd400" opacity=".45"/>`; }
  for(let i=0;i<8;i++){
    const fl = flip?FILES[7-i]:FILES[i], rk = flip? i+1 : 8-i;
    s += `<text x="${M+i*S+S/2}" y="${W-4}" font-size="10" fill="#d9cdb8" text-anchor="middle">${fl}</text>`;
    s += `<text x="${M/2}" y="${M+i*S+S/2+3.5}" font-size="10" fill="#d9cdb8" text-anchor="middle">${rk}</text>`;
  }
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    // b[row 0 = rank 8]
    const p = flip ? b[7-y][7-x] : b[y][x];
    if(!p) continue;
    const white = p===p.toUpperCase();
    s += `<text x="${M+x*S+S/2}" y="${M+y*S+S*0.78}" font-size="${S*0.86}" text-anchor="middle" font-family="'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols 2',serif" fill="${white?"#fff":"#111"}" stroke="${white?"#111":"#fff"}" stroke-width="${white?1.3:0.5}" paint-order="stroke">${GLYPH[p.toLowerCase()]}︎</text>`;
  }
  const cols = ["#2e8b3d","#c98a00","#c0392b","#2b6cb0"];
  (o.fleches||[]).forEach((a,i)=>{
    let col = cols[0], m=a;
    if(a.includes(":")){ let [c,mm]=a.split(":"); if(/^[a-h][1-8][a-h][1-8]$/.test(c)) [c,mm]=[mm,c]; col=({v:cols[0],j:cols[1],r:cols[2],b:cols[3]})[c]||cols[0]; m=mm; }
    const [x1,y1]=sqXY(m.slice(0,2),flip), [x2,y2]=sqXY(m.slice(2,4),flip);
    const cx1=M+x1*S+S/2, cy1=M+y1*S+S/2, cx2=M+x2*S+S/2, cy2=M+y2*S+S/2;
    const dx=cx2-cx1, dy=cy2-cy1, L=Math.hypot(dx,dy), ux=dx/L, uy=dy/L, hw=11, hl=13;
    const ex=cx2-ux*hl, ey=cy2-uy*hl, sx=cx1+ux*8, sy=cy1+uy*8;
    s += `<g opacity=".82" fill="${col}" stroke="${col}"><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke-width="7" stroke-linecap="round"/>`+
         `<polygon stroke="none" points="${cx2},${cy2} ${ex-uy*hw},${ey+ux*hw} ${ex+uy*hw},${ey-ux*hw}"/></g>`;
  });
  return s + "</svg>";
}

function byCat(){
  const cats = {};
  F.forEach(f=>{ const c=cats[f.categorie]=cats[f.categorie]||{}; (c[f.groupe]=c[f.groupe]||[]).push(f); });
  return cats;
}
function nav(cur){
  const cats = byCat();
  let h = `<h1>ChessBook</h1>
  <input id="q" type="search" placeholder="Rechercher…" aria-label="Rechercher">
  <a href="#/" class="${cur===""?"on":""}"><span class="n">⌂</span>Accueil</a>
  <a href="#/trouver" class="${cur==="trouver"?"on":""}"><span class="n">♞</span>Trouver le chapitre de ma partie</a>`;
  for(const c in cats){
    h += `<div class="cat">${esc(c)}</div>`;
    const groups = cats[c];
    for(const g in groups){
      const open = groups[g].some(f=>f.id===cur);
      h += `<details class="dg" ${open?"open":""}><summary class="grp">${esc(g)}</summary>`;
      groups[g].forEach(f=>{ h += `<a href="#/${f.id}" data-t="${esc([f.titre,f.groupe,f.num,f.resume,...(f.idees||[])].join(" ").replace(/<[^>]*>/g," ").replace(/"/g,"'").toLowerCase())}" class="${cur===f.id?"on":""}"><span class="n">${esc(f.num||"")}</span><span>${esc(f.titre)}</span></a>`; });
      h += `</details>`;
    }
  }
  h += `<div class="foot"><button id="theme">Thème clair / sombre</button> <button onclick="print()">Imprimer</button></div>`;
  return h;
}

function fichePage(f, i){
  let h = `<header class="fh"><div class="kick">${esc(f.groupe)}${f.num?" · "+esc(f.num):""}</div><h2>${esc(f.titre)}</h2>
    <div class="meta">${esc(f.duree)}${f.duree?" · ":""}Source : ${esc(f.source)}</div></header>`;
  h += `<div class="essentiel"><p>${f.resume}</p>${f.idees.length?"<ul>"+f.idees.map(x=>`<li>${x}</li>`).join("")+"</ul>":""}</div>`;
  if(f.sections.length>1) h += `<div class="toc">${f.sections.map((s,k)=>`<a href="#/${f.id}/s${k}" data-s="s${k}">${esc(s.titre)}</a>`).join("")}</div>`;
  f.sections.forEach((s,k)=>{
    h += `<section class="sec" id="s${k}"><h3>${esc(s.titre)}</h3>`;
    if(s.intro) h += `<div class="intro">${s.intro}</div>`;
    if(s.coups.length){
      const keys = new Set(s.points.map(p=>p.ply));
      let line = "";
      s.coups.forEach((m,j)=>{
        const mm = m.match(/^(\d+\.(?:\.\.)?)(.*)$/);
        const ply=j+1;
        if(mm){ if(!mm[1].endsWith("...") || j===0) line += `<span class="m n">${mm[1]}</span>`;
          line += `<span class="m ${keys.has(ply)?"key":""}">${esc(mm[2])}</span>`; }
      });
      h += `<div class="line" aria-label="Ordre des coups">${line}</div>`;
    }
    h += `<div class="cards">`;
    s.points.forEach(p=>{
      const ctx = p.ply? `Après ${esc(p.dernier)}` : (p.dernier ? esc(p.dernier) : "Position de départ");
      h += `<article class="card"><div class="bd">${boardSVG(p.fen,p)}</div><div><h4>${esc(p.titre||ctx)}</h4><div class="ctx">${p.titre?ctx:""}</div>`+
           (p.esprit?`<div class="esp"><b class="lbl">L'esprit de la position</b>${p.esprit}</div>`:"")+`</div></article>`;
    });
    h += `</div>`;
    if(s.conclusion) h += `<div class="concl">${s.conclusion}</div>`;
    h += `</section>`;
  });
  h += `<div class="two">`;
  if(f.retenir.length) h += `<div class="box"><h3>À retenir</h3><ul>${f.retenir.map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
  if(f.pieges.length) h += `<div class="box warn"><h3>Pièges et erreurs fréquentes</h3><ul>${f.pieges.map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
  h += `</div>`;
  const pv=F[i-1], nx=F[i+1];
  h += `<div class="pn"><div>${pv?`<a href="#/${pv.id}"><small>← Précédent</small>${esc(pv.titre)}</a>`:""}</div><div>${nx?`<a href="#/${nx.id}"><small>Suivant →</small>${esc(nx.titre)}</a>`:""}</div></div>`;
  return h;
}

function homePage(){
  const cats = byCat();
  let h = `<div class="home"><h2>ChessBook</h2>
    <a class="cta" href="#/trouver"><b>♞ Trouver le chapitre de ma partie</b><span>Collez ou importez un fichier PGN : le site vous ouvre le chapitre le plus utile.</span></a>`;
  for(const c in cats){
    h += `<h2 class="hc">${esc(c)}</h2>`;
    const groups = cats[c];
    for(const g in groups){
      h += `<h3>${esc(g)}</h3><div class="grid">`;
      groups[g].forEach(f=>{ h += `<a class="tile" href="#/${f.id}"><b>${esc(f.num||"")}</b><span>${esc(f.titre)}</span><small>${esc(f.duree)}</small></a>`; });
      h += `</div>`;
    }
  }
  return h + `</div>`;
}

/* ---- recherche par PGN : le module pgnfinder.js n'est chargé qu'à la demande ---- */
const BK = "cb_found";
let findIdx = null;
function loadFinder(){
  return window.PGNF ? Promise.resolve() : new Promise((ok,ko)=>{
    const s=document.createElement("script"); s.src="pgnfinder.js"; s.onload=ok; s.onerror=()=>ko(new Error("pgnfinder.js")); document.head.appendChild(s); });
}
function finderPage(){
  return `<div class="finder"><header class="fh"><div class="kick">Outil</div><h2>Trouver le chapitre de ma partie</h2></header>
  <div class="essentiel"><p>Collez le PGN de votre partie (chess.com, Lichess, ChessBase…) ou importez le fichier. Le site rejoue la partie, la compare aux positions de tous les chapitres et ouvre directement le plus proche : ouverture suivie ou finale atteinte. Tout se passe dans votre navigateur, rien n'est envoyé.</p></div>
  <textarea id="pgn" rows="10" placeholder="[Event &quot;…&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5 …" spellcheck="false" aria-label="PGN de la partie"></textarea>
  <div class="frow"><label class="btn">Importer un fichier .pgn<input id="pgnfile" type="file" accept=".pgn,.txt,text/plain" hidden></label><button id="go" class="btn pri">Trouver le chapitre</button></div>
  <div id="fres" aria-live="polite"></div></div>`;
}
function finderInit(){
  const ta=$("#pgn"), res=$("#fres"); let games=[];
  const msg=(h,cls)=>{ res.innerHTML=`<div class="fmsg ${cls||""}">${h}</div>`; };
  function analyseGame(gi){
    const P=window.PGNF, rep=P.replay(games[gi]);
    if(rep.plies.length<2) return msg(rep.error ? `Coup illisible au demi-coup ${rep.error.ply} (« ${esc(rep.error.token)} »). Vérifiez le PGN.` : "Cette partie ne contient pas assez de coups.","w");
    findIdx = findIdx || P.buildIndex(F);
    const a=P.analyse(F,rep,findIdx), pb=P.pickBest(a);
    if(!pb) return msg("Aucun chapitre ne recoupe vraiment cette partie (ni ouverture connue, ni finale reconnaissable). Utilisez la recherche du menu pour parcourir les chapitres.","w");
    const seen=new Set([pb.best.id]), alts=[];
    [...a.theory.filter(x=>x.score>=0.4), ...a.ending.slice(0,3)].forEach(x=>{ if(!seen.has(x.id) && alts.length<5){ seen.add(x.id); alts.push({id:x.id,k:x.k,titre:x.titre}); } });
    let why=pb.best.why;
    if(rep.error) why += ` (Partie lue jusqu'au demi-coup ${rep.error.ply-1} : le coup « ${rep.error.token} » n'a pas pu être interprété.)`;
    try{ sessionStorage.setItem(BK, JSON.stringify({id:pb.best.id,why,alts})); }catch(e){}
    location.hash=`#/${pb.best.id}/s${pb.best.k}`;
  }
  function run(){
    const txt=ta.value.trim(); if(!txt) return msg("Collez d'abord un PGN ou importez un fichier.","w");
    loadFinder().then(()=>{
      games=window.PGNF.parsePGN(txt);
      if(!games.length) return msg("Aucun coup trouvé dans ce texte.","w");
      if(games.length===1) return analyseGame(0);
      res.innerHTML=`<div class="fmsg"><b>${games.length} parties trouvées</b> — choisissez celle à analyser :</div><div class="glist">`+
        games.map((g,k)=>{ const h=g.headers; return `<button data-g="${k}">${esc((h.White||"?")+" – "+(h.Black||"?"))}<small>${esc([h.Result,h.Date,h.Event].filter(x=>x&&x!=="?").join(" · "))}</small></button>`; }).join("")+`</div>`;
      res.querySelectorAll("button[data-g]").forEach(b=>b.onclick=()=>analyseGame(+b.dataset.g));
    }).catch(()=>msg("Le module de recherche n'a pas pu être chargé.","w"));
  }
  $("#go").onclick=run;
  $("#pgnfile").onchange=e=>{ const f=e.target.files[0]; if(f) f.text().then(t=>{ ta.value=t; run(); }); };
}
function foundBanner(id){
  let d=null; try{ d=JSON.parse(sessionStorage.getItem(BK)||"null"); }catch(e){}
  if(!d) return "";
  if(d.id!==id){ try{ sessionStorage.removeItem(BK); }catch(e){} return ""; }
  return `<div class="fbanner"><button class="x" aria-label="Fermer">✕</button><b>Chapitre trouvé à partir de votre partie</b><p>${esc(d.why)}</p>`+
    (d.alts.length?`<p class="alts">Autres pistes : ${d.alts.map(x=>`<a href="#/${x.id}/s${x.k}">${esc(x.titre)}</a>`).join(" · ")}</p>`:"")+
    `<p><a href="#/trouver">Analyser une autre partie</a></p></div>`;
}

function route(){
  const parts = (location.hash||"#/").replace(/^#\/?/,"").split("/");
  const id = parts[0]||"";
  const i = F.findIndex(f=>f.id===id);
  $("#nav").innerHTML = nav(i>=0||id==="trouver"?id:"");
  const main = $("#main");
  if(id==="trouver"){ main.innerHTML = finderPage(); document.title="Trouver le chapitre — ChessBook"; window.scrollTo(0,0); finderInit(); }
  else if(i<0){ main.innerHTML = homePage(); document.title="ChessBook"; window.scrollTo(0,0); }
  else { main.innerHTML = foundBanner(id) + fichePage(F[i],i); document.title = F[i].titre+" — ChessBook";
    const bx=$(".fbanner .x"); if(bx) bx.onclick=()=>{ try{sessionStorage.removeItem(BK)}catch(e){} $(".fbanner").remove(); };
    if(parts[1]){ const el=document.getElementById(parts[1]); if(el) el.scrollIntoView(); } else window.scrollTo(0,0); }
  $("#nav").classList.remove("open");
  const q=$("#q");
  const dgs=[...document.querySelectorAll("nav details.dg")];
  dgs.forEach(d=>d.dataset.o=d.open?"1":"");
  const strip=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"");
  q.oninput=()=>{
    const v=strip(q.value.toLowerCase().trim());
    dgs.forEach(d=>{
      let n=0;
      d.querySelectorAll("a[data-t]").forEach(a=>{ const m=!v||strip(a.dataset.t).includes(v); a.style.display=m?"":"none"; if(m)n++; });
      d.style.display=n?"":"none";
      d.open = v ? n>0 : !!d.dataset.o;
    });
    document.querySelectorAll("nav .cat").forEach(c=>{
      let e=c.nextElementSibling, any=false;
      while(e && !e.classList.contains("cat")){ if(e.style.display!=="none") any=true; e=e.nextElementSibling; }
      c.style.display=any?"":"none";
    });
  };
  $("#theme").onclick=()=>{ const r=document.documentElement; const dark = r.dataset.theme? r.dataset.theme==="dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark?"light":"dark"; try{localStorage.setItem("theme",r.dataset.theme)}catch(e){} };
}
try{ const t=localStorage.getItem("theme"); if(t) document.documentElement.dataset.theme=t; }catch(e){}
$(".burger").onclick=()=>$("#nav").classList.toggle("open");
addEventListener("hashchange",route);
document.addEventListener("keydown",e=>{ if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return; const i=F.findIndex(f=>location.hash==="#/"+f.id);
  if(e.key==="ArrowRight"&&i>=0&&F[i+1]) location.hash="#/"+F[i+1].id; if(e.key==="ArrowLeft"&&i>0) location.hash="#/"+F[i-1].id; });
route();
})();


