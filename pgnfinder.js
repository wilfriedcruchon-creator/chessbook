/* ChessBook : module « Trouver le chapitre de ma partie ».
 * Lit un PGN, rejoue la partie (mini moteur de règles) et compare ses positions à l'index des chapitres
 * (champ `pk` de chaque fiche, produit par build.py) ; pour les finales, compare le matériel (`ms`).
 * Tout se passe dans le navigateur : rien n'est envoyé nulle part. */
(function(root){
"use strict";

/* ---------- clé de position : même algorithme que build.py (cyrb53) ---------- */
function cyrb53(str, seed){
  seed = seed||0;
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i=0,ch;i<str.length;i++){ ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1 = Math.imul(h1^(h1>>>16),2246822507); h1 ^= Math.imul(h2^(h2>>>13),3266489909);
  h2 = Math.imul(h2^(h2>>>16),2246822507); h2 ^= Math.imul(h1^(h1>>>13),3266489909);
  return 4294967296*(2097151&h2) + (h1>>>0);
}
const keyOf = (placement, turn)=>cyrb53(placement+" "+turn).toString(36);

/* ---------- mini moteur (cases 0..63, a1=0, h8=63) ---------- */
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const isW = p=>p!=="" && p===p.toUpperCase();
const KN = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KG = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const DG = [[1,1],[1,-1],[-1,1],[-1,-1]], OR = [[1,0],[-1,0],[0,1],[0,-1]];

function parseFEN(fen){
  const f = fen.trim().split(/\s+/), b = new Array(64).fill("");
  const rows = f[0].split("/");
  for(let r=0;r<8;r++){ let c=0; for(const ch of rows[r]){ if(/\d/.test(ch)) c+=+ch; else b[(7-r)*8+c++]=ch; } }
  const ep = (f[3] && f[3]!=="-") ? (+f[3][1]-1)*8 + "abcdefgh".indexOf(f[3][0]) : -1;
  return {b, turn:f[1]||"w", cast:(f[2]&&f[2]!=="-")?f[2]:"", ep};
}
function placement(pos){
  let s="";
  for(let r=7;r>=0;r--){ let e=0; for(let c=0;c<8;c++){ const p=pos.b[r*8+c]; if(!p) e++; else { if(e){s+=e;e=0;} s+=p; } } if(e)s+=e; if(r)s+="/"; }
  return s;
}
function attacked(pos, sq, byW){
  const b=pos.b, f=sq&7, r=sq>>3;
  // pions
  const pr = byW ? r-1 : r+1, pc = byW?"P":"p";
  if(pr>=0 && pr<8){ if(f>0 && b[pr*8+f-1]===pc) return true; if(f<7 && b[pr*8+f+1]===pc) return true; }
  const kn = byW?"N":"n", kg = byW?"K":"k";
  for(const [df,dr] of KN){ const x=f+df,y=r+dr; if(x>=0&&x<8&&y>=0&&y<8 && b[y*8+x]===kn) return true; }
  for(const [df,dr] of KG){ const x=f+df,y=r+dr; if(x>=0&&x<8&&y>=0&&y<8 && b[y*8+x]===kg) return true; }
  const bq = byW?["B","Q"]:["b","q"], rq = byW?["R","Q"]:["r","q"];
  for(const [df,dr] of DG){ let x=f+df,y=r+dr; while(x>=0&&x<8&&y>=0&&y<8){ const p=b[y*8+x]; if(p){ if(bq.includes(p)) return true; break; } x+=df; y+=dr; } }
  for(const [df,dr] of OR){ let x=f+df,y=r+dr; while(x>=0&&x<8&&y>=0&&y<8){ const p=b[y*8+x]; if(p){ if(rq.includes(p)) return true; break; } x+=df; y+=dr; } }
  return false;
}
function pseudo(pos){
  const b=pos.b, w=pos.turn==="w", mv=[];
  const add=(from,to,extra)=>mv.push(Object.assign({from,to,piece:b[from].toLowerCase()},extra||{}));
  for(let i=0;i<64;i++){
    const p=b[i]; if(!p || isW(p)!==w) continue;
    const t=p.toLowerCase(), f=i&7, r=i>>3;
    if(t==="p"){
      const dir=w?1:-1, last=w?7:0, start=w?1:6, r1=r+dir;
      if(r1<0||r1>7) continue;
      const push=(to,ex)=>{ if((to>>3)===last) for(const pr of ["q","r","b","n"]) add(i,to,Object.assign({promo:pr},ex)); else add(i,to,ex); };
      if(!b[r1*8+f]){ push(r1*8+f); if(r===start && !b[(r+2*dir)*8+f]) add(i,(r+2*dir)*8+f,{dbl:true}); }
      for(const df of [-1,1]){ const x=f+df; if(x<0||x>7) continue; const to=r1*8+x, q=b[to];
        if(q && isW(q)!==w) push(to,{cap:true});
        else if(!q && to===pos.ep) add(i,to,{cap:true,epcap:true}); }
    } else if(t==="n"||t==="k"){
      for(const [df,dr] of (t==="n"?KN:KG)){ const x=f+df,y=r+dr; if(x<0||x>7||y<0||y>7) continue; const q=b[y*8+x]; if(!q||isW(q)!==w) add(i,y*8+x,{cap:!!q}); }
      if(t==="k"){
        const base=w?0:56, K=w?"K":"k", R=w?"R":"r";
        if(i===base+4 && !attacked(pos,base+4,!w)){
          if(pos.cast.includes(w?"K":"k") && b[base+7]===R && !b[base+5] && !b[base+6] && !attacked(pos,base+5,!w) && !attacked(pos,base+6,!w)) add(i,base+6,{castle:"K"});
          if(pos.cast.includes(w?"Q":"q") && b[base]===R && !b[base+1] && !b[base+2] && !b[base+3] && !attacked(pos,base+3,!w) && !attacked(pos,base+2,!w)) add(i,base+2,{castle:"Q"});
        }
      }
    } else {
      const dirs = t==="b"?DG : t==="r"?OR : DG.concat(OR);
      for(const [df,dr] of dirs){ let x=f+df,y=r+dr; while(x>=0&&x<8&&y>=0&&y<8){ const q=b[y*8+x];
        if(!q) add(i,y*8+x); else { if(isW(q)!==w) add(i,y*8+x,{cap:true}); break; } x+=df; y+=dr; } }
    }
  }
  return mv;
}
function make(pos,m){
  const b=pos.b.slice(), w=pos.turn==="w";
  let p=b[m.from]; b[m.from]="";
  if(m.epcap) b[m.to + (w?-8:8)]="";
  if(m.promo) p = w ? m.promo.toUpperCase() : m.promo;
  if(m.castle){ const base=w?0:56; if(m.castle==="K"){ b[base+5]=b[base+7]; b[base+7]=""; } else { b[base+3]=b[base]; b[base]=""; } }
  const captured = pos.b[m.to];
  b[m.to]=p;
  let cast=pos.cast;
  const strip=c=>{ cast=cast.replace(c,""); };
  if(p==="K"){ strip("K"); strip("Q"); } if(p==="k"){ strip("k"); strip("q"); }
  for(const [sq,c] of [[0,"Q"],[7,"K"],[56,"q"],[63,"k"]]) if(m.from===sq||m.to===sq) strip(c);
  return {b, turn:w?"b":"w", cast, ep: m.dbl ? (m.from+m.to)/2 : -1};
}
function kingSq(pos,w){ const k=w?"K":"k"; return pos.b.indexOf(k); }
function legal(pos){
  const w=pos.turn==="w";
  return pseudo(pos).filter(m=>{ const n=make(pos,m); const ks=kingSq(n,w); return ks>=0 && !attacked(n,ks,!w); });
}
function inCheck(pos){ const w=pos.turn==="w"; const ks=kingSq(pos,w); return ks>=0 && attacked(pos,ks,!w); }

/* ---------- SAN ---------- */
const FR2EN = {C:"N", F:"B", T:"R", D:"Q", R:"K"};
function resolveSAN(pos, tok, french){
  let t = tok.replace(/[+#!?]+/g,"").replace(/[‑–]/g,"-");
  if(/^[0O]-[0O](-[0O])?$/.test(t)){
    const q = t.length>3, mv = legal(pos).filter(m=>m.castle===(q?"Q":"K"));
    return mv.length===1 ? mv[0] : null;
  }
  if(french) t = t.replace(/^([CFTDR])/, (m,c)=>FR2EN[c]).replace(/=([CFTD])/, (m,c)=>"="+FR2EN[c]);
  let m, piece, from=null, to, promo=null, df=null, dr=null;
  if((m=/^([NBRQK])([a-h])?([1-8])?x?([a-h][1-8])$/.exec(t))){
    piece=m[1].toLowerCase(); df=m[2]||null; dr=m[3]||null; to=m[4];
  } else if((m=/^(?:([a-h])x)?([a-h][1-8])(?:=?([QRBN]))?$/.exec(t))){
    piece="p"; df=m[1]||null; to=m[2]; promo=m[3]?m[3].toLowerCase():null;
  } else return null;
  const ti = "abcdefgh".indexOf(to[0]) + (+to[1]-1)*8;
  let c = legal(pos).filter(x=>x.piece===piece && x.to===ti && !x.castle);
  if(piece==="p") c = c.filter(x=>(x.promo||null)===promo);
  if(df) c = c.filter(x=>"abcdefgh"[x.from&7]===df);
  if(dr) c = c.filter(x=>(x.from>>3)===+dr-1);
  return c.length===1 ? c[0] : null;
}

/* ---------- signature de matériel (même définition que build.py) ---------- */
function msig(pos){
  const side={w:{Q:0,R:0,B:0,N:0},b:{Q:0,R:0,B:0,N:0}}, bish={w:[],b:[]};
  let pawns=0;
  for(let i=0;i<64;i++){ const p=pos.b[i]; if(!p) continue; const col=isW(p)?"w":"b", t=p.toUpperCase();
    if(t==="P") pawns++; else if(t==="B"){ side[col].B++; bish[col].push(((i&7)+(i>>3))%2); } else if(side[col][t]!==undefined) side[col][t]++; }
  const str=c=>"Q".repeat(side[c].Q)+"R".repeat(side[c].R)+"B".repeat(side[c].B)+"N".repeat(side[c].N);
  let flag="";
  if(bish.w.length===1 && bish.b.length===1) flag = bish.w[0]!==bish.b[0] ? "o" : "s";
  return [str("w"),str("b")].sort().join("|") + flag + (pawns?"p":"");
}

/* ---------- PGN ---------- */
function splitGames(text){
  text = text.replace(/^﻿/,"").replace(/\r/g,"");
  const parts = text.split(/\n(?=\[Event\s)/).map(s=>s.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}
function parseGame(text){
  const headers={}; let m; const re=/\[(\w+)\s+"([^"]*)"\]/g;
  while((m=re.exec(text))) headers[m[1]]=m[2];
  let mt = text.replace(/^\s*\[\w+\s+"[^"]*"\]\s*$/gm," ");
  mt = mt.replace(/\{[^}]*\}/g," ").replace(/;[^\n]*/g," ");
  let prev; do { prev=mt; mt=mt.replace(/\([^()]*\)/g," "); } while(mt!==prev);
  mt = mt.replace(/\$\d+/g," ").replace(/\d+\s*\.+/g," ");
  const RES = ["1-0","0-1","1/2-1/2","½-½","*"];
  const toks = mt.split(/\s+/).filter(t=>t && !/^[-–]+$/.test(t) && !RES.includes(t) && !/^e\.?p\.?$/i.test(t));
  return {headers, tokens:toks, fen:headers.FEN||null, text};
}
function parsePGN(text){ return splitGames(text).map(parseGame).filter(g=>g.tokens.length); }

const FRN = {N:"C",B:"F",R:"T",Q:"D",K:"R"};
const frSAN = san=>/^O/.test(san) ? san : (FRN[san[0]]? FRN[san[0]]+san.slice(1) : san).replace(/=([NBRQ])/,(m,c)=>"="+FRN[c]);

/* rejoue la partie : positions (clé), signatures, coups lisibles */
function replay(game){
  let pos = parseFEN(game.fen||START);
  const french = game.tokens.some(t=>/^[CFTD][a-h1-8x]/.test(t));
  const out = {plies:[], error:null};
  let n = pos.turn==="w" ? 1 : 1, side = pos.turn;
  const startNum = game.fen ? (+(game.fen.split(/\s+/)[5])||1) : 1;
  n = startNum;
  for(let i=0;i<game.tokens.length;i++){
    const tok=game.tokens[i], m=resolveSAN(pos,tok,french);
    if(!m){ out.error = {ply:i+1, token:tok}; break; }
    const white = pos.turn==="w";
    const nxt = make(pos,m);
    // SAN canonique pour l'affichage : on reconstruit à partir du jeton nettoyé et on le met en notation française
    let san = tok.replace(/[+#!?]+/g,"");
    if(/^[a-h]/.test(san) === false && san[0]==="0") san = san.replace(/0/g,"O");
    if(french) san = san; else san = frSAN(san);
    const check = inCheck(nxt) ? (legal(nxt).length ? "+" : "#") : "";
    out.plies.push({ply:i+1, label:(white? n+"." : n+"…")+san+check, key:keyOf(placement(nxt),nxt.turn), sig:msig(nxt), pieces:nxt.b.filter(p=>p&&!/[pPkK]/.test(p)).length});
    if(!white) n++;
    pos = nxt;
  }
  out.final = pos;
  return out;
}

/* ---------- index et recherche ---------- */
function buildIndex(fiches){
  const pos = new Map(), sig = new Map();
  fiches.forEach((f,fi)=>{
    (f.pk||[]).forEach(e=>{ let a=pos.get(e[0]); if(!a){a=[];pos.set(e[0],a);} a.push({fi,k:e[1],p:e[2],d:e[3]}); });
    (f.ms||[]).forEach(e=>{ let a=sig.get(e[0]); if(!a){a=[];sig.set(e[0],a);} a.push({fi,k:e[1],p:e[2]}); });
  });
  const nf = m=>{ const r=new Map(); m.forEach((a,key)=>r.set(key,new Set(a.map(x=>x.fi)).size)); return r; };
  return {pos, sig, posN:nf(pos), sigN:nf(sig)};
}
const PIECE_FR = {Q:"dame",R:"tour",B:"fou",N:"cavalier"};
function sigText(s){
  const m=/^([A-Z]*)\|([A-Z]*)([os]?)(p?)$/.exec(s); if(!m) return s;
  const side=x=>x?x.split("").map(c=>PIECE_FR[c]).join(" + "):"roi seul";
  let t = side(m[1])+" contre "+side(m[2]);
  if(m[3]==="o") t+=" (fous de couleurs opposées)"; else if(m[3]==="s") t+=" (fous de même couleur)";
  return t + (m[4]?" avec pions":"");
}

function analyse(fiches, rep, index){
  index = index || buildIndex(fiches);
  const total = rep.plies.length, res = new Map();
  /* 1. positions communes */
  rep.plies.forEach(pl=>{
    const hits = index.pos.get(pl.key); if(!hits) return;
    const w = 1/(index.posN.get(pl.key)||1);
    const perF = new Map();
    hits.forEach(h=>{ const cur=perF.get(h.fi); if(!cur || (h.d&&!cur.d)) perF.set(h.fi,h); });
    perF.forEach((h,fi)=>{
      let r=res.get(fi); if(!r){ r={fi,score:0,n:0,deepest:null,diag:null}; res.set(fi,r); }
      r.score += w*(h.d?3:1); r.n++;
      if(!r.deepest || pl.ply>r.deepest.ply) r.deepest={ply:pl.ply,label:pl.label,k:h.k};
      if(h.d && (!r.diag || pl.ply>r.diag.ply)) r.diag={ply:pl.ply,label:pl.label,k:h.k,p:h.p};
    });
  });
  const theory=[];
  res.forEach(r=>{
    const f=fiches[r.fi];
    if(f.categorie==="Mes parties" && !(r.n>=15 && r.n>=0.6*total)) return;
    const sec = (r.diag||r.deepest).k;
    let why = `Votre partie suit ce chapitre jusqu'au coup ${r.deepest.label} (${r.n} position${r.n>1?"s":""} commune${r.n>1?"s":""}).`;
    if(r.diag){
      const pt = (f.sections[r.diag.k]||{points:[]}).points.find(p=>p.ply===r.diag.p && r.diag.p>0);
      why = `La position de votre partie après ${r.diag.label} est identique à un diagramme du chapitre${pt&&pt.titre?" (« "+pt.titre+" »)":""} ; ${r.n} position${r.n>1?"s":""} commune${r.n>1?"s":""} en tout.`;
    }
    /* un chapitre d'ouverture prime sur un chapitre de concepts qui ne partage que quelques positions */
    const damp = !r.diag && (f.categorie==="Concepts et tactique" || f.categorie==="Silman · Style") ? 0.6 : 1;
    theory.push({fi:r.fi,id:f.id,titre:f.titre,groupe:f.groupe,categorie:f.categorie,k:sec,score:r.score*damp,n:r.n,depth:r.deepest.ply,why});
  });
  theory.sort((a,b)=>b.score-a.score || b.depth-a.depth || a.fi-b.fi);
  /* 2. finale : signature de matériel dominante parmi les positions « de finale » */
  const ending=[]; let endSig=null;
  const cnt=new Map();
  rep.plies.forEach(pl=>{ if(pl.pieces<=6){ cnt.set(pl.sig,(cnt.get(pl.sig)||0)+1); } });
  let bestN=0; cnt.forEach((c,s)=>{ if(c>=6 && c>=bestN && /^[A-Z]*\|[A-Z]*[os]?p?$/.test(s)){ bestN=c; endSig=s; } });
  if(endSig){
    const hits = index.sig.get(endSig)||[], nF=index.sigN.get(endSig)||1, perF=new Map();
    hits.forEach(h=>{ const a=perF.get(h.fi)||{n:0,k:h.k,p:h.p}; a.n++; perF.set(h.fi,a); });
    /* fiches de finale sans diagramme : repérées par un motif de signature */
    let nH=0;
    fiches.forEach((f,fi)=>{ const h=HINTS[f.id]; if(h && h.test(endSig) && !perF.has(fi)){ perF.set(fi,{n:2,k:0,p:0}); nH++; } });
    perF.forEach((a,fi)=>{ const f=fiches[fi];
      if(f.categorie==="Mes parties") return;
      ending.push({fi,id:f.id,titre:f.titre,groupe:f.groupe,categorie:f.categorie,k:a.k,score:Math.min(a.n,3)/Math.sqrt(nF+nH),n:a.n,
        why:`Votre partie arrive en finale ${sigText(endSig)} (pendant ${bestN} demi-coups) : mêmes pièces que dans ce chapitre.`}); });
    ending.sort((a,b)=>b.score-a.score || a.fi-b.fi);
  }
  return {theory:theory.slice(0,6), ending:ending.slice(0,6), endSig, endLen:bestN, endText:endSig?sigText(endSig):"", total};
}
const HINTS = {
  fous_opposes:/o(p?)$/, finale_fous_astuces:/^B\|Bop$|^\|Bp$/, finale_espace_pions:/^\|p$/, maree_pions:/^\|p$/,
  zugzwang:/^\|p$/, silman_p8_maitres:/^[NB]\|[NB]s?p$/
};

/* choix du chapitre vers lequel rediriger */
function pickBest(a){
  const t=a.theory[0], e=a.ending[0];
  if(t && t.score>=3) return {best:t, kind:"theory"};
  if(e && a.endLen>=10) return {best:e, kind:"ending"};
  if(t && t.score>=1.0) return {best:t, kind:"theory"};
  if(e) return {best:e, kind:"ending"};
  if(t && t.score>=0.4) return {best:t, kind:"theory"};
  return null;
}

root.PGNF = {parsePGN, replay, buildIndex, analyse, pickBest, keyOf, cyrb53, msig, parseFEN, placement, legal, resolveSAN, sigText, START};
if(typeof module!=="undefined") module.exports = root.PGNF;
})(typeof window!=="undefined" ? window : globalThis);
