/* state.js — État partagé de la partie (S), petits utilitaires (stockage local, identifiant de session) et fonctions dérivées en lecture seule (points, accès aux documents, détenteur actif d'une équipe, conditions de fin de partie). Dépend de data.js. */

const S = {me:null, db:null, tab:"docs", sel:"D00", chan:"general", phase:"lobby", roster:null,
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
/* Identifiant de session, retenu en mémoire pour toute la durée de la page.
   Certains navigateurs refusent le stockage local (mode restreint, cookies
   bloqués) : sans ce cache, l'identifiant changeait à chaque appel, et le
   joueur était éjecté de son équipe dès le premier rafraîchissement — donc
   dès qu'un autre joueur agissait. */
let _cid = null;
function clientId(){
  if(_cid) return _cid;
  _cid = loadLS("helios_client") || uid();
  store("helios_client", _cid);
  return _cid;
}
/* Le stockage local sert aussi à retrouver son équipe après un rechargement.
   S'il est indisponible, on garde l'équipe en mémoire pour la session en cours. */
let _memTeam = null;
function saveTeam(id){ _memTeam = id; store("helios_team", id===undefined ? undefined : id); }
function loadTeam(){ return loadLS("helios_team") || _memTeam; }
function stockageDispo(){
  try{ localStorage.setItem("helios_test","1"); localStorage.removeItem("helios_test"); return true; }
  catch(e){ return false; }
}

async function sha(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT+"|"+s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,16);
}
const inKey = (arr,h) => arr.some(k=>k.h===h);

/* ====================== POINTS & PARTIE ====================== */
let _ptsCache = null;
function ptsMap(){
  if(_ptsCache) return _ptsCache;
  const m = {}; activeTeams().forEach(t=>m[t.id]=CAPITAL);
  for(const l of S.ledger) if(m[l.team]!==undefined) m[l.team] += (l.delta||0);
  return _ptsCache = m;
}
function pts(t){ const m = ptsMap(); return m[t]!==undefined ? m[t] : CAPITAL; }
function dead(t){ return pts(t) <= 0; }
function foundCount(t){ return S.found.filter(f=>f.team===t).length; }
function anomaliesLeft(){ return KEY_LINE.length - S.found.length; }
function endReason(){
  const act = activeTeams();
  if(act.length && act.filter(t=>dead(t.id)).length >= act.length-1) return "elimination";
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

/* ---- Composition de la partie, figée au lancement ----
   Avant le lancement, les quatre équipes sont candidates. Au lancement, on
   enregistre celles réellement présentes : elles seules jouent, comptent au
   classement et subissent les relevés. Les documents des équipes absentes
   sont redistribués entre les présentes — sans quoi leurs anomalies seraient
   définitivement hors d'atteinte. */
function activeIds(){ return (S.roster && S.roster.teams) ? S.roster.teams : TEAMS.map(t=>t.id); }
function activeTeams(){ const ids = activeIds(); return TEAMS.filter(t=>ids.includes(t.id)); }
function ownerOf(docId){
  if(S.roster && S.roster.owners && S.roster.owners[docId]!==undefined) return S.roster.owners[docId];
  const d = docById(docId); return d ? d.owner : null;
}
/* Répartition des documents orphelins, à parts égales et de façon
   déterministe : tous les postes doivent aboutir au même résultat. */
function repartir(ids){
  const owners = {}, compte = {};
  ids.forEach(id => compte[id] = DOCS.filter(d=>d.owner===id).length);
  DOCS.filter(d => d.owner!==null && !ids.includes(d.owner))
      .sort((a,b) => a.id < b.id ? -1 : 1)
      .forEach(d => {
        const cible = ids.slice().sort((x,y) => compte[x]-compte[y] || (x<y?-1:1))[0];
        owners[d.id] = cible; compte[cible]++;
      });
  return owners;
}

function hasDoc(docId, t){
  const d = docById(docId);
  if(!d) return false;
  const own = ownerOf(docId);
  if(own===null || own===t) return true;
  return S.access.some(a=>a.team===t && a.docId===docId);
}
const myDocs = () => DOCS.filter(d=>hasDoc(d.id,S.me));
const foundKey = (doc,lig) => doc+"_"+lig;
const isFound = (doc,lig) => S.found.some(f=>f._id===foundKey(doc,lig));
