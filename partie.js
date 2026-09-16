/* partie.js — Cycle de vie de la partie : réinitialisation complète (deux boutons, dans l'appli et sur l'écran de choix), navigation entre onglets, boucle de rendu principale, salle d'attente (comptage de joueurs, lancement à 2+ équipes), sélection et changement d'équipe (avec réservation via firebase-config.js), et câblage des boutons/formulaires. Dépend de tous les fichiers précédents. */

/* ====================== RÉINITIALISATION ====================== */
function wireResetButton(btnId, progId){
  const btn=$(btnId), prog=$(progId);
  let armed=false, running=false;
  async function wipe(col,id){
    for(let a=0;a<3;a++){
      try{ await S.db.collection(col).doc(id).delete(); return; }
      catch(e){ if(a===2) throw e; await sleep(350*(a+1)); }
    }
  }
  btn.onclick=async()=>{
    if(running || !S.ready) return;
    if(!armed){
      armed=true; btn.textContent="Confirmer la remise à zéro";
      prog.textContent="Cliquez une seconde fois pour tout effacer.";
      setTimeout(()=>{ if(armed&&!running){armed=false; btn.textContent="Réinitialiser la partie"; prog.textContent="";} },7000);
      return;
    }
    armed=false; running=true; btn.disabled=true; btn.textContent="Réinitialisation…";
    let n=0;
    try{
      for(const col of ["ledger","decls","access","chat","guesses","found","claims"]){
        let guard=0;
        while(guard++<60){
          const snap=await S.db.collection(col).limit(200).get();
          if(!snap.docs.length) break;
          for(const d of snap.docs){ await wipe(col,d.id); n++; prog.textContent="Suppression… "+n; await sleep(20); }
        }
      }
      prog.textContent=n+" enregistrement"+(n>1?"s":"")+" effacé"+(n>1?"s":"")+". Chaque équipe repart avec "+CAPITAL+" points.";
      await S.db.doc("meta/phase").set({phase:"lobby", ts:Date.now()});
      S.me=null; store("helios_team", undefined);
      toast("Nouvelle partie prête.");
    }catch(e){
      prog.textContent="Interruption après "+n+" suppressions ("+((e&&e.code)||"erreur réseau")+"). Relancez pour terminer.";
    }
    btn.disabled=false; btn.textContent="Réinitialiser la partie"; running=false;
  };
}

/* ====================== NAVIGATION ====================== */
function go(tab){
  S.tab=tab;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===tab?"true":"false"));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("on", p.id==="p-"+tab));
  if(tab==="ano"){ fillDocSelect(); refreshAnoForm(); }
  if(tab==="mkt"){ renderChanBar(); renderChat(); }
  window.scrollTo({top:0});
}

function renderAll(){
  renderGate();
  if(!S.me || S.phase!=="playing") return;
  renderMe(); renderBoard(); renderDocList(); renderReader();
  renderJournal(); renderFeed(); renderOver();
  $("#anoRule").textContent = "Relever une anomalie ne vous rapporte rien : cela retire des points à toutes les autres équipes. "
    + "Plus votre qualification est précise, plus la perte est lourde, jusqu'à "+DMG_PLAFOND+" points. Une anomalie déjà relevée est neutralisée.";
  if(S.tab==="ano"){ fillDocSelect(); refreshAnoForm(); }
  if(S.tab==="mkt"){ renderChat(); }
}

/* ====================== SALLE D'ATTENTE ====================== */
function renderGate(){
  const g = $("#gate");
  if(!S.me){
    g.hidden=false; $("#gatePickBox").hidden=false; $("#lobbyBox").hidden=true;
    buildGate();
    return;
  }
  if(!S.db){ S.phase="playing"; g.hidden=true; return; } // pas de session partagée : rien à attendre
  if(S.phase==="playing"){ g.hidden=true; return; }
  g.hidden=false; $("#gatePickBox").hidden=true; $("#lobbyBox").hidden=false;
  renderLobby();
}
function renderLobby(){
  const n = activeClaims().length;
  $("#lobbyStatus").textContent = "Vous jouez "+teamName(S.me)+". "+n+" équipe"+(n>1?"s":"")+" sur "+TEAMS.length
    + (n>1?" ont":" a")+" rejoint — il en faut au moins 2 pour lancer la partie.";
  const box = $("#lobbyTeams"); box.innerHTML="";
  TEAMS.forEach(t=>{
    const joined = !!holderOf(t.id);
    const mine = t.id===S.me;
    const label = (joined ? teamName(t.id) : (t.nom+" — en attente")) + (mine ? " (vous)" : "");
    const row = el("div","lobby-team"+(joined?" joined":"")+(mine?" self":""), label);
    box.append(row);
  });
  const input = $("#renameInput");
  if(document.activeElement!==input) input.value = teamName(S.me);
  $("#launchBtn").hidden = n < 2;
}
async function launchGame(){
  if(activeClaims().length < 2) return;
  if(!S.db){ S.phase="playing"; renderAll(); return; }
  try{ await S.db.doc("meta/phase").set({phase:"playing", ts:Date.now()}); }
  catch(e){ toast("Impossible de lancer la partie, réessayez."); }
}
async function renameMyTeam(newName){
  newName = newName.trim().slice(0,24);
  if(!newName || !S.me || !S.db) return;
  try{ await S.db.doc("claims/"+S.me).update({name:newName}); toast("Équipe renommée."); }
  catch(e){ toast("Échec du renommage, réessayez."); }
}

/* ====================== DÉMARRAGE ====================== */
async function pickTeam(id){
  const already = S.claims.find(c=>c._id===id);
  if(already && already.holder && already.holder!==clientId()) return;
  document.querySelectorAll("#gatePick button").forEach(b=>b.disabled=true);
  if(S.db){
    try{
      const ref = S.db.doc("claims/"+id);
      const lease = await claimSlot(ref, clientId());
      if(!lease.acquired){ toast("Cette équipe vient d'être prise par quelqu'un d'autre."); buildGate(); return; }
    }catch(e){ /* session hors ligne ou erreur réseau : on laisse choisir localement plutôt que de bloquer */ }
  }
  S.me=id; store("helios_team", id);
  S.lastFb=null; $("#anoFeedback").innerHTML="";
  S.chan="general";
  renderChanBar(); renderAll();
}
function buildGate(){
  $("#gateIntro").textContent = "Chaque équipe démarre avec "+CAPITAL+" points et ne peut plus en regagner. "
    + "Relever une anomalie fait perdre des points aux trois autres équipes. Pour lire un document qui n'est pas le vôtre, "
    + "il faut deviner quelle équipe le détient. La partie se termine dès que 3 des 4 équipes sont tombées à zéro point, "
    + "ou dès que toutes les anomalies du dossier ont été relevées — l'équipe avec le plus de points gagne. "
    + "Une fois votre équipe choisie, vous rejoignez une salle d'attente : il faut au moins 2 équipes présentes pour lancer la partie.";
  const p=$("#gatePick"); p.innerHTML="";
  TEAMS.forEach(t=>{
    const b=el("button",null,teamName(t.id));
    b.style.setProperty("--tc", t.c);
    const claim = S.claims.find(c=>c._id===t.id);
    const taken = !!claim && !!claim.holder && claim.holder!==clientId();
    if(taken){
      b.disabled=true;
      b.append(el("small",null,"déjà prise par un autre joueur"));
    } else {
      b.append(el("small",null, DOCS.filter(d=>d.owner===t.id).length+" documents propres"));
    }
    b.onclick=()=>pickTeam(t.id);
    p.append(b);
  });
}
function wire(){
  document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>go(b.dataset.tab));
  $("#aDoc").onchange=fillLines;
  $("#aNote").oninput=refreshAnoForm;
  $("#aSend").onclick=declare;
  $("#chatSend").onclick=sendChat;
  $("#chatIn").onkeydown=e=>{ if(e.key==="Enter") sendChat(); };
  $("#renameBtn").onclick=()=>renameMyTeam($("#renameInput").value);
  $("#renameInput").onkeydown=e=>{ if(e.key==="Enter") renameMyTeam($("#renameInput").value); };
  $("#launchBtn").onclick=launchGame;
  $("#meRenameBtn").onclick=()=>renameMyTeam($("#meRenameInput").value);
  $("#meRenameInput").onkeydown=e=>{ if(e.key==="Enter") renameMyTeam($("#meRenameInput").value); };
  $("#meChangeBtn").onclick=()=>{
    const old = S.me;
    store("helios_team", undefined); S.me=null; S.lastFb=null;
    $("#anoFeedback").innerHTML="";
    renderAll();
    if(S.db && old){ S.db.doc("claims/"+old).update({holder:null}).catch(()=>{}); }
  };
  fillSel($("#aCat"),CATS); fillSel($("#aNat"),NATURES); fillSel($("#aInc"),INCIDENCES);
  wireResetButton("#resetBtn","#resetProg");
  wireResetButton("#gateResetBtn","#gateResetProg");
  setInterval(()=>{ if(S.tab==="ano") refreshAnoForm(); }, 1000);
}
