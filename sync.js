/* sync.js — Connexion à Firestore (via firebase-config.js), abonnement en temps réel aux collections partagées et au document de phase (salle d'attente / partie en cours), suivi de fraîcheur de la synchro, réconciliation de la détention d'équipe à la reconnexion, et démarrage de l'application. Chargé en dernier : c'est lui qui lance start(). */

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
  const saved = loadLS("helios_team");
  if(saved && team(saved)){ S.me=saved; }
  let db=null;
  try{ db = connectDb(); }catch(e){ db=null; }
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
      el_.textContent="Session partagée active — synchronisé il y a "+age+" s.";
    }
  }, 1000);
  ["ledger","decls","access","chat","guesses","found","claims"].forEach(c=>sub(c,c));
  subDoc("meta/phase", data=>{ S.phase = (data && data.phase) ? data.phase : "lobby"; });
  if(S.me){
    try{
      const ref = S.db.doc("claims/"+S.me);
      const snap = await ref.get();
      if(!snap.exists){
        await ref.set({holder:clientId(), ts:Date.now()});
      } else if(!snap.data().holder || snap.data().holder===clientId()){
        await ref.update({holder:clientId(), ts:Date.now()});
      } else {
        // quelqu'un d'autre a pris cette équipe entre-temps : on ne l'écrase pas
        S.me = null; store("helios_team", undefined);
      }
    }catch(e){ /* session hors ligne ou erreur réseau : on garde l'équipe locale telle quelle */ }
  }
  renderAll();
}
start();
