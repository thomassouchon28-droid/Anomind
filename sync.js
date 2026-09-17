/* sync.js — Connexion à Firestore (via firebase-config.js), abonnement temps réel aux collections et à la phase de partie, suivi de fraîcheur, réconciliation atomique de l'équipe à la reconnexion, démarrage. Chargé en dernier : c'est lui qui lance start(). */

/* Sept collections écoutées : une déclaration en fait bouger trois d'un coup.
   On regroupe donc les rendus dans une seule frame au lieu d'en déclencher
   un par snapshot reçu. */
let _raf = null;
function scheduleRender(){
  if(_raf) return;
  _raf = requestAnimationFrame(()=>{ _raf=null; renderAll(); });
}
function sub(col, into){
  return S.db.collection(col).onSnapshot(snap=>{
    S[into] = snap.docs.map(d=>({...d.data(), _id:d.id}));
    _ptsCache = null;
    S.lastSync = Date.now();
    scheduleRender();
  }, e=>{
    $("#status").className="statusline off";
    $("#status").textContent="La session partagée n'est plus accessible ("+e.code+"). Rechargez la page.";
  });
}
function subDoc(path, apply){
  return S.db.doc(path).onSnapshot(snap=>{
    apply(snap.exists ? snap.data() : null);
    S.lastSync = Date.now();
    scheduleRender();
  }, e=>{
    $("#status").className="statusline off";
    $("#status").textContent="La session partagée n'est plus accessible ("+e.code+"). Rechargez la page.";
  });
}
async function start(){
  wire(); buildGate();
  const saved = loadTeam();
  if(saved && team(saved)){ S.me=saved; }
  let db=null;
  try{ db = await connectDb(); }catch(e){ db=null; }
  if(!db){
    $("#status").className="statusline off";
    $("#status").textContent="Mode hors ligne : la session partagée est indisponible. Rien ne sera partagé entre les équipes.";
    renderAll();
    return;
  }
  S.db=db; S.ready=true; S.lastSync=Date.now();
  $("#status").className="statusline";
  setInterval(()=>{
    if(!S.ready || !S.lastSync) return;
    const age = Math.round((Date.now()-S.lastSync)/1000);
    const el_ = $("#status");
    if(age > 45){
      el_.className="statusline off";
      el_.textContent="Dernière synchronisation il y a "+age+" s. Le flux temps réel semble indisponible : "
        + "la session bascule alors sur un rafraîchissement périodique d'environ 30 secondes. "
        + "Un rechargement de la page rétablit en général le flux.";
    } else {
      el_.className="statusline";
      el_.textContent="Session partagée active — synchronisé il y a "+age+" s."
        + (stockageDispo() ? "" : " Attention : ce navigateur n'autorise pas la mémorisation locale — "
            + "recharger la page vous fera quitter votre équipe.");
    }
  }, 1000);
  ["ledger","decls","access","chat","guesses","found","claims"].forEach(c=>sub(c,c));
  subDoc("meta/roster", data=>{
    S.roster = (data && data.teams) ? data : null;
    _ptsCache = null;   // le classement dépend de la composition
  });
  subDoc("meta/phase", data=>{
    S.phase = (data && data.phase) ? data.phase : "lobby";
    // Éjection immédiate, sans attendre le prochain rendu : pendant ce court
    // intervalle, un joueur pourrait sinon encore agir alors que la
    // réinitialisation a déjà commencé.
    if(S.phase==="resetting" && S.me){ S.me=null; saveTeam(undefined); }
  });
  if(S.me){
    // Réservation atomique, comme à la sélection : un simple lire-puis-écrire
    // laisserait deux onglets qui redémarrent en même temps se croire tous
    // deux propriétaires de la même équipe.
    const lease = await claimSlot(S.db.doc("claims/"+S.me), clientId());
    if(!lease.acquired){ S.me = null; saveTeam(undefined); }
  }
  renderAll();
}
start();
