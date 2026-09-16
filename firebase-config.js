/* firebase-config.js — LE SEUL FICHIER À MODIFIER pour brancher votre propre
   projet Firebase. Voir DEPLOIEMENT.md pour la marche à suivre complète.

   1. https://console.firebase.google.com -> créer un projet (gratuit, plan Spark)
   2. Build > Firestore Database -> créer une base (mode test pour commencer)
   3. Paramètres du projet -> icône "</>" -> ajouter une application Web
      Firebase génère l'objet ci-dessous : copiez-collez-le à la place de celui-ci.
*/
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCcQtQQ9MHE-pJwcUWqDG5GlZuuiS7mez4",
  authDomain: "anomind-2e455.firebaseapp.com",
  projectId: "anomind-2e455",
  storageBucket: "anomind-2e455.firebasestorage.app",
  messagingSenderId: "560438198422",
  appId: "1:560438198422:web:e5df6305eab88a579c02b7"
};

firebase.initializeApp(FIREBASE_CONFIG);
const FIRESTORE = firebase.firestore();

/* Retourne l'instance Firestore déjà connectée — appelée depuis sync.js */
function connectDb(){ return FIRESTORE; }

/* ------------------------------------------------------------------------
   Réservation d'un "créneau" (utilisée pour la sélection d'équipe, afin que
   deux joueurs ne puissent pas prendre la même équipe). Firestore n'a pas
   d'équivalent natif du acquire({holder, ttlMs}) utilisé côté Claude ; on
   obtient le même résultat ("prendre le document seulement s'il est encore
   libre") avec une transaction Firestore classique.
   ------------------------------------------------------------------------ */
async function claimSlot(ref, holder){
  try{
    let acquired = false;
    await FIRESTORE.runTransaction(async tx=>{
      const snap = await tx.get(ref);
      if(snap.exists && snap.data().holder && snap.data().holder!==holder){
        acquired = false; return;
      }
      tx.set(ref, {holder, ts: Date.now()}, {merge:true});
      acquired = true;
    });
    return {acquired};
  }catch(e){
    return {acquired:false};
  }
}
