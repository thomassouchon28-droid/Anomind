/* documents.js — Bandeau d'équipe (nom, points, renommer, changer), classement des points, liste et lecture des documents, mécanique de devinette et formulaire de relevé d'anomalie (jusqu'au calcul du barème). Dépend de state.js. */

let toastT;
function toast(msg){
  document.querySelectorAll(".toast").forEach(n=>n.remove());
  const n = el("div","toast",msg); document.body.appendChild(n);
  clearTimeout(toastT); toastT = setTimeout(()=>n.remove(), 4200);
}

async function spend(team, delta, reason, id){
  await S.db.collection("ledger").doc(id||uid()).set({team, delta, reason, ts:Date.now()});
}

/* ====================== BANDEAU ====================== */
function renderMe(){
  const box = $("#me");
  box.hidden = !S.me;
  if(!S.me) return;
  const v = pts(S.me);
  $("#meTeamName").textContent = teamName(S.me);
  $("#mePts").className = "pts"+(v<=60?" crit":v<=120?" low":"");
  $("#mePtsVal").textContent = String(Math.max(0,v));
  const input = $("#meRenameInput");
  if(document.activeElement!==input) input.value = teamName(S.me);
}

function renderBoard(){
  const bar = $("#board"); bar.innerHTML="";
  const ranked = [...TEAMS].map(t=>({t, p:pts(t.id)})).sort((a,b)=>b.p-a.p);
  ranked.forEach(r=>{
    const n = el("div","t"+(r.t.id===S.me?" self":"")+(r.p<=0?" dead":""));
    n.style.setProperty("--tc", r.t.c);
    const l = el("div","l");
    l.append(el("b",null,teamName(r.t.id)), el("i",null, r.p<=0 ? "hors jeu" : String(r.p)));
    n.append(l);
    const bg = el("div","bar"), fill = el("span");
    fill.style.width = Math.max(0, Math.min(100, r.p/CAPITAL*100))+"%";
    bg.append(fill); n.append(bg);
    bar.append(n);
  });
}

function renderOver(){
  const o = $("#over");
  const reason = endReason();
  if(!reason){ o.hidden = true; return; }
  const box = $("#overBox"); box.innerHTML="";
  const ranking = [...TEAMS].sort((a,b)=> pts(b.id)-pts(a.id) || foundCount(b.id)-foundCount(a.id));
  const winner = ranking[0];
  const tie = pts(ranking[0].id)===pts(ranking[1].id);
  const tieNote = tie ? " (égalité de points, départagée par le nombre d'anomalies trouvées)" : "";
  box.append(el("h2",null,"Partie terminée"));
  if(reason==="elimination"){
    const nb = TEAMS.filter(t=>dead(t.id)).length;
    box.append(el("p",null, nb+" équipes sur "+TEAMS.length+" sont tombées à zéro point. "+teamName(winner.id)+" remporte la partie."+tieNote));
  } else {
    box.append(el("p",null,"Les "+KEY_LINE.length+" anomalies du dossier ont toutes été relevées. "+teamName(winner.id)+" remporte la partie avec le plus grand nombre de points."+tieNote));
  }
  const ol = el("ol");
  ranking.forEach(t=>{
    const n = foundCount(t.id);
    ol.append(el("li",null, teamName(t.id)+" — "+pts(t.id)+" points · "+n+" anomalie"+(n>1?"s":"")+" trouvée"+(n>1?"s":"")+(t.id===winner.id?" · vainqueur":"")));
  });
  box.append(el("p",null,"Classement final :"));
  box.append(ol);
  const b = el("button","btn","Lancer une nouvelle partie");
  b.onclick = ()=>{ o.hidden=true; go("mkt"); $("#resetBtn").scrollIntoView({block:"center"}); };
  box.append(b);
  o.hidden = false;
}

/* ====================== ONGLET 1 — DOCUMENTS ====================== */
/* Ordre d'affichage : documents possédés en tête, le reste mélangé.
   Le mélange est déterministe par équipe : il ne bouge pas d'un rendu
   à l'autre ni d'un rechargement au suivant, mais diffère d'une équipe
   à l'autre, de sorte que la position ne trahisse rien.               */
function shuffleRank(docId){
  const seed = (S.me||"")+"|"+docId;
  let x = 2166136261 >>> 0;                       // FNV-1a
  for(let i=0;i<seed.length;i++){ x ^= seed.charCodeAt(i); x = Math.imul(x,16777619) >>> 0; }
  x ^= x >>> 16; x = Math.imul(x,2246822507) >>> 0;   // avalanche
  x ^= x >>> 13; x = Math.imul(x,3266489909) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
function orderedDocs(){
  const mine = DOCS.filter(d=>hasDoc(d.id,S.me));
  const rest = DOCS.filter(d=>!hasDoc(d.id,S.me)).sort((a,b)=>shuffleRank(a.id)-shuffleRank(b.id));
  return mine.concat(rest);
}

function renderDocList(){
  const list = $("#docList"); list.innerHTML="";
  let owned=0;
  orderedDocs().forEach(d=>{
    const ok = hasDoc(d.id, S.me);
    if(ok) owned++;
    const b = el("button","doc-i"+(ok?"":" locked"));
    b.setAttribute("aria-current", d.id===S.sel ? "true":"false");
    b.append(el("span","code", d.code));
    b.append(el("span","ttl", d.titre));
    const m = el("div","meta");
    if(d.owner===null) m.append(el("span",null,"Remis à toutes les équipes"));
    else if(d.owner===S.me){ const dot=el("span","owner-dot"); dot.style.setProperty("--tc",team(S.me).c);
      m.append(dot, el("span",null,"Votre document")); }
    else if(ok) m.append(el("span",null,"Copie obtenue"));
    else {
      const tried = S.guesses.filter(g=>g.team===S.me && g.docId===d.id).length;
      m.append(el("span","lock","Détenteur inconnu"));
      if(tried) m.append(el("span",null,"· "+tried+" tentative"+(tried>1?"s":"")));
    }
    b.append(m);
    b.onclick = ()=>{ S.sel = d.id; renderDocList(); renderReader(); };
    list.append(b);
  });
  $("#docCount").textContent = owned+" document"+(owned>1?"s":"")+" en votre possession sur "+DOCS.length;
}

function renderReader(){
  const r = $("#reader"); r.innerHTML="";
  const d = docById(S.sel);
  if(!d) return;
  const head = el("header");
  const h = el("div"); h.style.flex="1 1 200px";
  h.append(el("h2",null,d.titre));
  head.append(h);
  head.append(el("p",null, d.code + " · " + d.fam));
  r.append(head);

  if(!hasDoc(d.id,S.me)){ renderGuess(r,d); return; }

  r.append(el("div","docintro", d.intro));
  const wrap = el("div","sheet");
  const tbl = el("table");
  const thead = el("thead"), tr = el("tr");
  d.cols.forEach(c=>{ const th=el("th"); th.innerHTML=c; tr.append(th); });
  tr.append(el("th",null,""));
  thead.append(tr); tbl.append(thead);
  const tb = el("tbody");
  const nums = NUMCOLS[d.id]||[];
  const mine = S.decls.filter(x=>x.team===S.me && x.docId===d.id);

  d.lignes.forEach(l=>{
    const row = el("tr");
    const flag = mine.find(x=>x.ligne===l.ref && x.verdict!=="faux");
    const taken = isFound(d.id, l.ref);
    if(flag) row.className="flagged";
    row.append(el("td","ref", l.ref));
    l.c.forEach((cell,i)=>{
      const td = el("td", nums.includes(i)?"num":null);
      td.append(document.createTextNode(cell));
      if(i===l.c.length-1 && l.cmt) td.append(el("span","cmt", l.cmt));
      row.append(td);
    });
    const act = el("td"); act.style.width="1%";
    let cls="tick", label="Relever";
    if(flag){ cls="tick done"; label="✓ relevée par vous"; }
    else if(taken){ cls="tick gone"; label="déjà relevée"; }
    const tick = el("button",cls,label);
    tick.disabled = !!taken && !flag;
    tick.onclick = ()=>{ go("ano"); $("#aDoc").value=d.id; fillLines(); $("#aLig").value=l.ref; $("#aNote").focus(); };
    act.append(tick); row.append(act);
    tb.append(row);
  });
  tbl.append(tb); wrap.append(tbl); r.append(wrap);
  if(d.note) r.append(el("div","docnote", d.note));
}

function renderGuess(r, d){
  const g = el("div","guess");
  g.append(el("h3",null,"Ce document appartient à l'une des trois autres équipes"));
  g.append(el("p","hint","Ni son contenu ni son détenteur ne vous sont accessibles. Désignez l'équipe que vous croyez détentrice : si vous voyez juste, vous obtenez immédiatement une copie. Sinon vous perdez "+MALUS_DEVINE+" points et l'erreur est publique."));
  const tried = S.guesses.filter(x=>x.team===S.me && x.docId===d.id);
  const cands = el("div","cands");
  TEAMS.filter(t=>t.id!==S.me).forEach(t=>{
    const done = tried.find(x=>x.guess===t.id);
    const b = el("button",null,teamName(t.id));
    b.style.setProperty("--tc", t.c);
    b.append(el("small",null, done ? "écartée — tentative déjà faite" : "risque : −"+MALUS_DEVINE+" points"));
    b.disabled = !!done || !playable();
    b.onclick = ()=>guess(d.id, t.id);
    cands.append(b);
  });
  g.append(cands);
  const left = 3 - tried.length;
  if(left===1) g.append(el("p","hint","Il ne reste qu'un candidat possible : le document est forcément à cette équipe."));
  r.append(g);
}

async function guess(docId, guessId){
  if(!playable()) return;
  const d = docById(docId);
  const right = d.owner === guessId;
  const id = uid();
  const wGuess = S.db.collection("guesses").doc(id).set({team:S.me, docId, guess:guessId, right, ts:Date.now()});
  if(right){
    await Promise.all([wGuess, S.db.collection("access").doc(S.me+"_"+docId).set({team:S.me, docId, from:"devinette", ts:Date.now()})]);
    toast("Bien vu : "+d.code+" est à vous.");
  } else {
    await Promise.all([wGuess, spend(S.me, -MALUS_DEVINE, "Détenteur erroné", "g_"+id)]);
    toast("Raté. −"+MALUS_DEVINE+" points.");
  }
}

/* ====================== ONGLET 2 — ANOMALIES ====================== */
function fillSel(sel, arr){ sel.innerHTML=""; arr.forEach((c,i)=>{ const o=el("option",null,c); o.value=String(i); sel.append(o); }); }
function fillDocSelect(){
  const s = $("#aDoc"); const cur = s.value; s.innerHTML="";
  myDocs().forEach(d=>{ const o=el("option",null,d.code+" — "+d.titre); o.value=d.id; s.append(o); });
  if(cur && myDocs().some(d=>d.id===cur)) s.value=cur;
  fillLines();
}
function fillLines(){
  const d = docById($("#aDoc").value); const s = $("#aLig"); s.innerHTML="";
  if(!d) return;
  d.lignes.forEach(l=>{
    const lbl = String(l.c[0]).slice(0,54);
    const o = el("option",null, l.ref+" — "+lbl+(String(l.c[0]).length>54?"…":"")+(isFound(d.id,l.ref)?"  (déjà relevée)":""));
    o.value = l.ref; s.append(o);
  });
}
function coolLeft(){
  const last = S.decls.filter(d=>d.team===S.me).reduce((m,d)=>Math.max(m,d.ts||0),0);
  return Math.max(0, COOLDOWN-(Date.now()-last));
}
function refreshAnoForm(){
  const n = $("#aNote").value.trim().length;
  const c = $("#aCount");
  c.textContent = n+" / "+MIN_JUSTIF+" caractères minimum";
  c.className = "counter"+(n<MIN_JUSTIF?" short":"");
  const left = coolLeft();
  $("#aCool").textContent = !playable() ? (over()?"La partie est terminée.":"")
    : left>0 ? "Prochain relevé possible dans "+Math.ceil(left/1000)+" s." : "";
  $("#aSend").disabled = !playable() || n<MIN_JUSTIF || left>0;
}

function socleOf(p){ return p>=45 ? DMG_SOCLE.majeure : p>=35 ? DMG_SOCLE.significative : DMG_SOCLE.mineure; }

async function declare(){
  const docId=$("#aDoc").value, ligne=$("#aLig").value;
  const cat=$("#aCat").value, nat=$("#aNat").value, inc=$("#aInc").value;
  const note=$("#aNote").value.trim();
  if(!docId||!ligne||note.length<MIN_JUSTIF||!playable()) return;
  $("#aSend").disabled = true;

  const hL = await sha(docId+"|"+ligne);
  const kl = KEY_LINE.find(k=>k.h===hL);

  const id = uid();
  const base = {team:S.me, docId, ligne, cat:+cat, nat:+nat, inc:+inc, note, ts:Date.now()};

  if(!kl){
    const delta = -(COUT_DECL+MALUS_FAUX);
    const rec = {...base, verdict:"faux", socle:0, qualifs:0, damage:0, delta};
    await Promise.all([S.db.collection("decls").doc(id).set(rec),
                       spend(S.me, delta, "Relevé infondé "+docId+" "+ligne, "d_"+id)]);
    S.lastFb=id;
    feedback("faux","Aucune anomalie sur cette ligne · "+delta+" points",
      "Le dossier ne retient rien sur cette ligne. Votre équipe supporte seule le coût.", breakdown(rec));
    return;
  }
  if(isFound(docId, ligne)){
    const delta = -COUT_DECL;
    const rec = {...base, verdict:"prise", socle:0, qualifs:0, damage:0, delta};
    await Promise.all([S.db.collection("decls").doc(id).set(rec),
                       spend(S.me, delta, "Anomalie déjà relevée "+docId+" "+ligne, "d_"+id)]);
    S.lastFb=id;
    feedback("prise","Anomalie déjà relevée · "+delta+" points",
      "Une autre équipe a relevé cette anomalie avant vous. Elle est neutralisée et ne peut plus servir.", breakdown(rec));
    return;
  }

  const [okCat, okNat, okInc] = await Promise.all([
    sha(docId+"|"+ligne+"|C"+cat).then(h=>inKey(KEY_CAT,h)),
    sha(docId+"|"+ligne+"|N"+nat).then(h=>inKey(KEY_NAT,h)),
    sha(docId+"|"+ligne+"|I"+inc).then(h=>inKey(KEY_INC,h))
  ]);
  const qualifs = (okCat?1:0)+(okNat?1:0)+(okInc?1:0);
  const socle = socleOf(kl.p);
  const damage = Math.min(DMG_PLAFOND, socle + qualifs*DMG_QUALIF);

  const targets = TEAMS.filter(t=>t.id!==S.me && !dead(t.id));
  const rec = {...base, verdict: qualifs===3?"exact":"partiel", socle, qualifs, okCat, okNat, okInc,
               damage, delta:-COUT_DECL, cibles:targets.length};
  // La prise de l'anomalie part seule et d'abord : c'est elle qui tranche
  // entre deux équipes qui relèveraient la même ligne au même instant.
  await S.db.collection("found").doc(foundKey(docId,ligne)).set({team:S.me, docId, ligne, damage, ts:Date.now()});
  // Le reste n'a aucune dépendance entre soi : tout part d'un coup.
  await Promise.all([
    S.db.collection("decls").doc(id).set(rec),
    spend(S.me, -COUT_DECL, "Dépôt "+docId+" "+ligne, "d_"+id),
    ...targets.map(t=>spend(t.id, -damage, "Anomalie relevée par "+teamName(S.me), "h_"+id+"_"+t.id))
  ]);

  S.lastFb=id;
  feedback(rec.verdict, "Anomalie confirmée · −"+damage+" points pour chaque autre équipe",
    qualifs===3 ? "Qualification complète : vous infligez le maximum permis par cette anomalie."
    : "Qualification incomplète : "+(3-qualifs)+" critère"+(3-qualifs>1?"s":"")+" sur trois ne correspond"+(3-qualifs>1?"ent":"")+" pas à ce qui est attendu. Affiner aurait fait plus mal.", breakdown(rec));
  $("#aNote").value=""; refreshAnoForm();
}

function breakdown(d){
  if(d.verdict==="faux") return "relevé infondé −"+MALUS_FAUX+"  ·  dépôt −"+COUT_DECL+"   =   "+d.delta+" points pour vous";
  if(d.verdict==="prise") return "anomalie déjà neutralisée  ·  dépôt −"+COUT_DECL+"   =   "+d.delta+" points pour vous";
  const p=["socle "+d.socle];
  p.push("assertion "+(d.okCat?"+"+DMG_QUALIF:"+0"));
  p.push("nature "+(d.okNat?"+"+DMG_QUALIF:"+0"));
  p.push("incidence "+(d.okInc?"+"+DMG_QUALIF:"+0"));
  const raw = d.socle + d.qualifs*DMG_QUALIF;
  return p.join("  ·  ")+"   =   −"+d.damage+" à chacune des "+d.cibles+" autres équipes"
    + (raw>DMG_PLAFOND ? "  (plafonné à "+DMG_PLAFOND+")" : "")
    + "  ·  dépôt −"+COUT_DECL+" pour vous";
}

function feedback(kind,title,body,detail){
  const box=$("#anoFeedback"); box.innerHTML="";
  const f=el("div","feedback "+kind); f.append(el("b",null,title), document.createTextNode(body));
  if(detail) f.append(el("div","bd", detail));
  box.append(f);
}
