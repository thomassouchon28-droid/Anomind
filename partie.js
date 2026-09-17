/* partie.js — Cycle de vie de la partie : réinitialisation (verrouillage, effacement, réouverture), navigation, boucle de rendu, salle d'attente (comptage, lancement, sortie), sélection et changement d'équipe. Dépend de tous les fichiers précédents. */

/* ====================== RÉINITIALISATION ====================== */
/* Celui qui lance la réinitialisation est lui aussi renvoyé à l'écran
   d'accueil : on affiche donc l'avancement aux deux emplacements, pour qu'il
   reste visible où qu'il se trouve. */
function resetProgress(txt){
  ["#resetProg","#gateResetProg","#lobbyResetProg"].forEach(id=>{ const n=$(id); if(n) n.textContent=txt; });
}
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
      // 1. Verrouiller AVANT d'effacer : tout le monde est renvoyé à l'écran
      //    d'accueil et ne peut plus entrer tant que l'effacement n'est pas fini.
      //    Sans cette étape, un joueur encore en partie gardait son équipe en
      //    local alors que sa réservation venait d'être supprimée — et un autre
      //    joueur pouvait alors prendre la même équipe.
      await S.db.doc("meta/phase").set({phase:"resetting", ts:Date.now()});
      resetProgress("Réinitialisation en cours…");
      // 2. Effacer
      for(const col of ["ledger","decls","access","chat","guesses","found","claims"]){
        let guard=0;
        while(guard++<60){
          const snap=await S.db.collection(col).limit(200).get();
          if(!snap.docs.length) break;
          for(const d of snap.docs){ await wipe(col,d.id); n++; resetProgress("Suppression… "+n); await sleep(20); }
        }
      }
      // 3. Rouvrir : la composition repart de zéro, toutes les équipes
      //    redeviennent disponibles.
      await S.db.doc("meta/roster").delete().catch(()=>{});
      await S.db.doc("meta/phase").set({phase:"lobby", ts:Date.now()});
      resetProgress(n+" enregistrement"+(n>1?"s":"")+" effacé"+(n>1?"s":"")+". Chaque équipe repart avec "+CAPITAL+" points.");
      toast("Nouvelle partie prête.");
    }catch(e){
      // Ne jamais laisser la session verrouillée sur un échec.
      try{ await S.db.doc("meta/phase").set({phase:"lobby", ts:Date.now()}); }catch(_){}
      resetProgress("Interruption après "+n+" suppressions ("+((e&&e.code)||"erreur réseau")+"). Relancez pour terminer.");
    }
    btn.disabled=false; btn.textContent="Réinitialiser la partie"; running=false;
  };
}

/* ====================== NAVIGATION ====================== */
function go(tab){
  if(S.tab==="mkt") markMktSeen();   // on quitte l'onglet : tout y a été vu
  S.tab=tab;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===tab?"true":"false"));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("on", p.id==="p-"+tab));
  if(tab==="ano"){ fillDocSelect(); refreshAnoForm(); }
  if(tab==="mkt"){ renderChanBar(); renderChat(); }
  renderMktBadge();
  window.scrollTo({top:0});
}

/* Filet de sécurité : si la session partagée indique que notre équipe est
   désormais détenue par quelqu'un d'autre, c'est nous qui sortons. Sans cela,
   un conflit résiduel laisserait deux joueurs jouer la même équipe en silence. */
function reconcileOwnership(){
  if(!S.db || !S.me) return;
  const c = S.claims.find(x=>x._id===S.me);
  if(c && c.holder && c.holder!==clientId()){
    S.me=null; saveTeam(undefined);
    toast("Votre équipe a été reprise par un autre joueur.");
  }
}
function renderAll(){
  reconcileOwnership();
  renderGate();
  if(!S.me || S.phase!=="playing") return;
  renderMe(); renderBoard(); renderDocList(); renderReader();
  renderJournal(); renderFeed(); renderOver();
  $("#anoRule").textContent = "Relever une anomalie ne vous rapporte rien : cela retire des points à toutes les autres équipes. "
    + "Plus votre qualification est précise, plus la perte est lourde, jusqu'à "+DMG_PLAFOND+" points. Une anomalie déjà relevée est neutralisée.";
  if(S.tab==="ano"){ fillDocSelect(); refreshAnoForm(); }
  if(S.tab==="mkt"){ renderChat(); }
  renderMktBadge();
}

/* ====================== SALLE D'ATTENTE ====================== */
function renderGate(){
  const g = $("#gate");
  if(S.db && S.phase==="resetting"){
    // Réinitialisation en cours : tout le monde sort et personne n'entre.
    if(S.me){ S.me=null; saveTeam(undefined); }
    g.hidden=false; $("#gatePickBox").hidden=false; $("#lobbyBox").hidden=true;
    buildGate();
    return;
  }
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
    + (n>1?" ont":" a")+" rejoint — il en faut au moins 2 pour lancer la partie. "
    + "Seules les équipes présentes au lancement participeront : les documents des absentes seront "
    + "redistribués entre vous, et personne ne pourra rejoindre une fois la partie commencée.";
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
  const presentes = activeClaims().map(c=>c._id);
  if(presentes.length < 2) return;
  const ids = TEAMS.map(t=>t.id).filter(id=>presentes.includes(id));   // ordre stable
  if(!S.db){ S.roster={teams:ids, owners:repartir(ids)}; S.phase="playing"; renderAll(); return; }
  try{
    // La composition est publiée AVANT la bascule en partie : sans cela, un
    // poste pourrait basculer en jeu en croyant encore que les quatre équipes
    // participent, et calculer des scores faux le temps d'un rendu.
    await S.db.doc("meta/roster").set({teams:ids, owners:repartir(ids), ts:Date.now()});
    await S.db.doc("meta/phase").set({phase:"playing", ts:Date.now()});
  }
  catch(e){ toast("Impossible de lancer la partie, réessayez."); }
}
/* Libère l'équipe sans supprimer son nom personnalisé : seule la
   réinitialisation efface les noms. */
function leaveTeam(){
  const old = S.me;
  saveTeam(undefined); S.me=null; S.lastFb=null;
  $("#anoFeedback").innerHTML="";
  renderAll();
  if(S.db && old){ S.db.doc("claims/"+old).update({holder:null}).catch(()=>{}); }
}
async function renameMyTeam(newName){
  newName = newName.trim().slice(0,24);
  if(!newName || !S.me || !S.db) return;
  try{ await S.db.doc("claims/"+S.me).update({name:newName}); toast("Équipe renommée."); }
  catch(e){ toast("Échec du renommage, réessayez."); }
}

/* ====================== DÉMARRAGE ====================== */
async function pickTeam(id){
  if(S.db && S.phase==="resetting") return;
  // partie lancée : aucune nouvelle équipe ne peut entrer
  if(S.db && S.phase==="playing" && !activeIds().includes(id)) return;
  const already = S.claims.find(c=>c._id===id);
  if(already && already.holder && already.holder!==clientId()) return;
  document.querySelectorAll("#gatePick button").forEach(b=>b.disabled=true);
  if(S.db){
    const lease = await claimSlot(S.db.doc("claims/"+id), clientId());
    if(!lease.acquired){
      toast("Cette équipe vient d'être prise par quelqu'un d'autre.");
      buildGate(); return;
    }
  }
  S.me=id; saveTeam(id);
  S.lastFb=null; $("#anoFeedback").innerHTML="";
  S.chan="general";
  renderChanBar(); renderAll();
}
function buildGate(){
  const locked = S.db && S.phase==="resetting";
  const grb = $("#gateResetBtn"); if(grb) grb.disabled = !!locked;
  if(locked){
    $("#gateIntro").textContent = "Réinitialisation de la partie en cours. Personne ne peut rejoindre une équipe "
      + "tant qu'elle n'est pas terminée — l'écran se débloquera tout seul dans quelques instants.";
    const p=$("#gatePick"); p.innerHTML="";
    TEAMS.forEach(t=>{
      const b=el("button",null,t.nom);
      b.style.setProperty("--tc", t.c);
      b.disabled=true;
      b.append(el("small",null,"réinitialisation en cours"));
      p.append(b);
    });
    return;
  }
  const enCours = S.db && S.phase==="playing";
  if(enCours){
    const libres = activeTeams().filter(t=>!holderOf(t.id));
    $("#gateIntro").textContent = libres.length
      ? "Une partie est déjà en cours : on ne peut plus la rejoindre. Vous pouvez seulement reprendre une place "
        + "laissée vacante par une équipe engagée dans cette partie."
      : "Une partie est déjà en cours et toutes les places sont occupées. Il faut attendre la fin de la partie, "
        + "ou une réinitialisation, pour pouvoir jouer.";
    const p=$("#gatePick"); p.innerHTML="";
    activeTeams().forEach(t=>{
      const b=el("button",null,teamName(t.id));
      b.style.setProperty("--tc", t.c);
      const libre = !holderOf(t.id);
      b.disabled = !libre;
      b.append(el("small",null, libre ? "place vacante — reprendre" : "place occupée"));
      b.onclick=()=>pickTeam(t.id);
      p.append(b);
    });
    return;
  }
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
  $("#meChangeBtn").onclick=leaveTeam;
  $("#lobbyLeaveBtn").onclick=leaveTeam;
  fillSel($("#aCat"),CATS); fillSel($("#aNat"),NATURES); fillSel($("#aInc"),INCIDENCES);
  wireResetButton("#resetBtn","#resetProg");
  wireResetButton("#gateResetBtn","#gateResetProg");
  wireResetButton("#lobbyResetBtn","#lobbyResetProg");
  setInterval(()=>{ if(S.tab==="ano") refreshAnoForm(); }, 1000);
}
