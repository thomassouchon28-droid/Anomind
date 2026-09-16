/* journal.js — Journal public de la partie (avec le compteur d'anomalies restantes) et messagerie par équipe. Dépend de state.js et documents.js (toast, hasDoc). */

function renderJournal(){
  if(S.lastFb && !S.decls.some(d=>d._id===S.lastFb)){ S.lastFb=null; $("#anoFeedback").innerHTML=""; }
  const j=$("#anoJrnl"); j.innerHTML="";
  const list = S.decls.filter(d=>d.team===S.me).sort((a,b)=>b.ts-a.ts);
  if(!list.length){
    const e=el("div","empty"); e.append(el("b",null,"Aucun relevé"));
    e.append(el("div",null,"Ouvrez un document, repérez une ligne anormale et qualifiez-la le plus précisément possible."));
    j.append(e); $("#anoStats").textContent=""; return;
  }
  list.forEach(d=>{
    const it=el("div","it");
    const v=el("div","v "+d.verdict);
    if(d.damage){ v.append(document.createTextNode("−"+d.damage)); v.append(el("small",null,"aux autres")); }
    else { v.append(document.createTextNode(String(d.delta))); v.append(el("small",null,"pour vous")); }
    it.append(v);
    const b=el("div","d");
    const head=el("b", null, (docById(d.docId)?.code||d.docId)+" · "+d.ligne+"  ");
    const lbl = d.verdict==="exact"?"qualification complète":d.verdict==="partiel"?"qualification partielle"
      :d.verdict==="prise"?"déjà relevée":"infondée";
    head.append(el("span","tag "+d.verdict, lbl));
    b.append(head);
    b.append(el("p",null, CATS[d.cat]+" · "+NATURES[d.nat]+" · "+INCIDENCES[d.inc]+" — "+d.note));
    b.append(el("div","bd", breakdown(d)));
    it.append(b); j.append(it);
  });
  const hits = list.filter(d=>d.damage).length;
  const dealt = list.reduce((s,d)=>s+(d.damage||0)*(d.cibles||0),0);
  $("#anoStats").textContent = hits+" anomalie"+(hits>1?"s":"")+" neutralisée"+(hits>1?"s":"")+
    " · "+dealt+" points retirés à l'adversaire";
}

/* ====================== JOURNAL DE PARTIE ====================== */
function anoLeftText(){
  const total = KEY_LINE.length, left = total - S.found.length;
  return left+" anomalie"+(left>1?"s":"")+" restante"+(left>1?"s":"")+" sur "+total+" au total.";
}
function renderFeed(){
  const txt = anoLeftText();
  $("#anoLeft").textContent = "— "+txt;
  $("#anoLeftTop").textContent = txt;
  const box=$("#feed"); box.innerHTML="";
  const ev=[];
  S.decls.filter(d=>d.damage).forEach(d=>{
    const doc = docById(d.docId);
    const canSee = doc && hasDoc(d.docId, S.me);
    let detail = CATS[d.cat]+" · "+NATURES[d.nat]+" · "+INCIDENCES[d.inc]+", ligne "+d.ligne;
    if(canSee) detail += ", "+doc.code+" — "+doc.titre;
    ev.push({ts:d.ts, t:d.team,
      tx: teamName(d.team)+" a relevé une anomalie ("+detail+") : −"+d.damage+" points pour chacune des "+d.cibles+" autres équipes."});
  });
  S.guesses.filter(g=>g.right).forEach(g=>ev.push({ts:g.ts, t:g.team,
    tx: teamName(g.team)+" a deviné le détenteur d'un document et en a obtenu une copie."}));
  S.guesses.filter(g=>!g.right).forEach(g=>ev.push({ts:g.ts, t:g.team,
    tx: teamName(g.team)+" s'est trompée de détenteur : −"+MALUS_DEVINE+" points."}));
  ev.sort((a,b)=>b.ts-a.ts);
  if(!ev.length){ const e=el("div","empty"); e.append(el("b",null,"Rien ne s'est encore passé"));
    e.append(el("div",null,"Les relevés et les devinettes de toutes les équipes apparaîtront ici, avec la ligne et la qualification de chaque anomalie. Seul le nom du document reste masqué pour les équipes qui n'y ont pas accès.")); box.append(e); return; }
  ev.slice(0,60).forEach(x=>{
    const n=el("div","e");
    const dot=el("span","dot"); dot.style.setProperty("--tc", team(x.t)?.c||"var(--muted)");
    n.append(dot, el("span","tx",x.tx), el("time",null,hhmm(x.ts)));
    box.append(n);
  });
}

/* ====================== CHAT ====================== */
function channels(){
  const out=[{id:"general", nom:"Toutes les équipes"}];
  TEAMS.filter(t=>t.id!==S.me).forEach(t=>out.push({id:[S.me,t.id].sort().join("-"), nom:teamName(t.id)}));
  return out;
}
function renderChanBar(){
  const bar=$("#chanBar"); bar.innerHTML="";
  channels().forEach(c=>{
    const b=el("button",null,c.nom);
    b.setAttribute("aria-pressed", c.id===S.chan?"true":"false");
    b.onclick=()=>{ S.chan=c.id; renderChanBar(); renderChat(); };
    bar.append(b);
  });
}
function renderChat(){
  $("#chatRule").textContent = "Chaque message envoyé coûte "+COUT_MSG+" points. Négocier n'est jamais gratuit.";
  const box=$("#msgs"); const stick = box.scrollTop+box.clientHeight >= box.scrollHeight-60;
  box.innerHTML="";
  const list=S.chat.filter(m=>m.chan===S.chan).sort((a,b)=>a.ts-b.ts).slice(-200);
  if(!list.length){
    const e=el("div","empty"); e.append(el("b",null,"Pas encore de message"));
    e.append(el("div",null,"Marchander, bluffer ou faire diversion : tout cela se paie."));
    box.append(e);
  }
  list.forEach(m=>{
    const n=el("div","msg"+(m.team===S.me?" mine":""));
    const t=team(m.team);
    n.style.setProperty("--tc", t?t.c:"var(--muted)");
    n.append(el("div","au", t?teamName(t.id):"—"));
    n.append(el("div","bu", m.text));
    n.append(el("time",null,hhmm(m.ts)));
    box.append(n);
  });
  if(stick) box.scrollTop=box.scrollHeight;
  $("#chatSend").disabled = !playable();
  $("#chatIn").disabled = !playable();
}
async function sendChat(){
  const i=$("#chatIn"); const text=i.value.trim();
  if(!text || !playable()) return;
  if(pts(S.me) <= COUT_MSG){ toast("Il ne vous reste pas assez de points pour écrire."); return; }
  i.value="";
  const id=uid();
  await Promise.all([
    S.db.collection("chat").doc(id).set({chan:S.chan, team:S.me, text:text.slice(0,500), ts:Date.now()}),
    spend(S.me, -COUT_MSG, "Message", "m_"+id)
  ]);
}
