/* state.js — État partagé de la partie (S), petits utilitaires (stockage local, identifiant de session) et fonctions dérivées en lecture seule (points, accès aux documents, détenteur actif d'une équipe, conditions de fin de partie). Dépend de data.js. */

const S = {me:null, db:null, tab:"docs", sel:"D00", chan:"general", phase:"lobby",
           ledger:[], access:[], decls:[], chat:[], guesses:[], found:[], claims:[],
           ready:false, lastFb:null};

const $ = s => document.querySelector(s);
const el = (t,cls,txt)=>{const n=document.createElement(t); if(cls)n.className=cls; if(txt!=null)n.textContent=txt; return n;};
const team = id => TEAMS.find(t=>t.id===id);
const docById = id => DOCS.find(d=>d.id===id);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const hhmm = ts => new Date(ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function store(k,v){ try{ v===undefined ? localStorage.removeItem(k) : localStorage.setItem(k,v);}catch(e){} }
function loadLS(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function clientId(){ let id=loadLS("helios_client"); if(!id){ id=uid(); store("helios_client", id); } return id; }

async function sha(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT+"|"+s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,16);
}
const inKey = (arr,h) => arr.some(k=>k.h===h);

/* ====================== POINTS & PARTIE ====================== */
let _ptsCache = null;
function ptsMap(){
  if(_ptsCache) return _ptsCache;
  const m = {}; TEAMS.forEach(t=>m[t.id]=CAPITAL);
  for(const l of S.ledger) if(m[l.team]!==undefined) m[l.team] += (l.delta||0);
  return _ptsCache = m;
}
function pts(t){ const m = ptsMap(); return m[t]!==undefined ? m[t] : CAPITAL; }
function dead(t){ return pts(t) <= 0; }
function foundCount(t){ return S.found.filter(f=>f.team===t).length; }
function anomaliesLeft(){ return KEY_LINE.length - S.found.length; }
function endReason(){
  if(TEAMS.filter(t=>dead(t.id)).length >= TEAMS.length-1) return "elimination";
  if(anomaliesLeft() <= 0) return "anomalies";
  return null;
}
const over = () => !!endReason();
const playable = () => S.ready && S.me && S.phase==="playing" && !over() && !dead(S.me);
function teamName(id){
  const c = S.claims.find(x=>x._id===id);
  return (c && c.name) ? c.name : team(id).nom;
}
function activeClaims(){ return S.claims.filter(c=>c.holder); }
function holderOf(id){ const c = S.claims.find(x=>x._id===id); return c && c.holder ? c.holder : null; }

function hasDoc(docId, t){
  const d = docById(docId);
  if(!d) return false;
  if(d.owner===null || d.owner===t) return true;
  return S.access.some(a=>a.team===t && a.docId===docId);
}
const myDocs = () => DOCS.filter(d=>hasDoc(d.id,S.me));
const foundKey = (doc,lig) => doc+"_"+lig;
const isFound = (doc,lig) => S.found.some(f=>f._id===foundKey(doc,lig));
