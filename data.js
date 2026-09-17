/* data.js — Contenu et paramètres du dossier : équipes, catégories/natures/incidences d'audit, documents et leurs lignes, barème de points, table des anomalies réelles (hashées). C'est ce fichier qu'on modifie pour changer le contenu du cas ou l'équilibrage des points. */

const CAPITAL = 400;        // dotation de départ de chaque équipe
const COUT_DECL = 5;        // coût de dépôt d'un relevé d'anomalie
const MALUS_FAUX = 15;      // malus supplémentaire si la ligne est saine
const MALUS_DEVINE = 50;    // malus si l'on se trompe de détenteur
const COUT_MSG = 5;         // coût d'un message envoyé
const COOLDOWN = 30000;     // délai minimum entre deux relevés (ms)
const MIN_JUSTIF = 60;      // caractères minimum de justification

/* Dégâts infligés à chaque autre équipe par une anomalie confirmée :
   un socle selon la gravité, majoré par chaque qualificatif exact
   (assertion, nature, incidence), le tout plafonné.                       */
const DMG_SOCLE = {majeure:10, significative:8, mineure:6};
const DMG_QUALIF = 5;
const DMG_PLAFOND = 25;

const TEAMS = [
  {id:"A", nom:"Équipe Alpha",   c:"#D85604"},
  {id:"B", nom:"Équipe Bravo",   c:"#A32020"},
  {id:"C", nom:"Équipe Charlie", c:"#C98A00"},
  {id:"D", nom:"Équipe Delta",   c:"#B23A5B"}
];

const CATS = [
  "Existence / Réalité",
  "Exhaustivité",
  "Séparation des exercices (cut-off)",
  "Évaluation / Valorisation",
  "Droits et obligations",
  "Présentation / Annexe",
  "Contrôle interne",
  "Fraude potentielle"
];

const NATURES = [
  "Absence de pièce justificative",
  "Rattachement au mauvais exercice",
  "Erreur ou absence d'évaluation",
  "Absence d'autorisation ou de délibération",
  "Information absente de l'annexe",
  "Classement ou présentation incorrects",
  "Défaillance du dispositif de contrôle",
  "Opération non comptabilisée",
  "Indice de fraude ou opération fictive"
];

const INCIDENCES = [
  "Actif surévalué",
  "Actif sous-évalué",
  "Passif sous-évalué",
  "Passif surévalué",
  "Résultat surévalué",
  "Résultat sous-évalué",
  "Aucune incidence chiffrée — information seulement"
];

/* ====================== DOSSIER GROUPE HÉLIOS ====================== */
const DOCS = [
{ id:"D00", code:"PERM-25", titre:"Dossier permanent et note de synthèse", fam:"Contexte",
  owner:null, prix:0,
  intro:"Note de prise de connaissance établie par l'équipe d'audit. Remise à toutes les équipes.",
  cols:["Réf.","Élément"],
  lignes:[
    {ref:"L01", c:["Groupe Hélios SA, ETI industrielle : fabrication de modules photovoltaïques et de systèmes de stockage. Chiffre d'affaires 2025 : 47,3 M€ (42,1 M€ en 2024). Effectif : 214 salariés."]},
    {ref:"L02", c:["Capital détenu à 68 % par M. Édouard Vasseur, président-directeur général, 22 % par le fonds Ardence Capital, 10 % par les salariés."]},
    {ref:"L03", c:["Filiale unique : Hélios Maroc SARL (Casablanca), détenue à 100 %. Usine d'assemblage mise en service en 2024."]},
    {ref:"L04", c:["Exercice clos le 31 décembre 2025. Référentiel : règles françaises (PCG). Premier exercice audité par le cabinet."]},
    {ref:"L05", c:["Faits marquants 2025 : arrêt de la ligne de production SOLARIS en mars, ouverture d'un entrepôt à Anvers, renégociation de la dette bancaire en novembre."]},
    {ref:"L06", c:["La direction indique avoir procédé en 2025 à une révision des durées d'utilité des matériels industriels. Aucun impact chiffré ni mention en annexe n'a été communiqué à ce stade."]},
    {ref:"L07", c:["Le contrôle de gestion compte trois personnes. La direction comptable a enregistré deux départs en 2025 : responsable consolidation et comptable fournisseurs, non remplacés."]},
    {ref:"L08", c:["La balance a été arrêtée le 12/02/2026. Les écritures d'inventaire ont été saisies, contrôlées et validées par le directeur administratif et financier lui-même."]}
  ],
  note:"Les montants sont exprimés en euros. Les documents détenus par une seule équipe se rachètent au marché."
},

{ id:"D01", code:"BAL-2025", titre:"Balance générale simplifiée", fam:"Comptabilité générale",
  owner:null, prix:0,
  intro:"Extrait de la balance générale au 31/12/2025, comparée à l'exercice précédent. Remise à toutes les équipes.",
  cols:["Réf.","Compte","Libellé","31/12/2025","31/12/2024"],
  lignes:[
    {ref:"L01", c:["101000","Capital social","4 000 000","4 000 000"], n:[2,3]},
    {ref:"L02", c:["106000","Réserves","2 145 000","1 870 000"], n:[2,3]},
    {ref:"L03", c:["120000","Résultat de l'exercice","1 482 000","275 000"], n:[2,3]},
    {ref:"L04", c:["164000","Emprunts auprès des établissements de crédit","7 200 000","6 950 000"], n:[2,3]},
    {ref:"L05", c:["205000","Concessions, brevets, logiciels","620 000","640 000"], n:[2,3]},
    {ref:"L06", c:["215000","Installations techniques et matériel industriel","12 480 000","13 900 000"], n:[2,3]},
    {ref:"L07", c:["281500","Amortissements des installations techniques","(5 310 000)","(6 940 000)"], n:[2,3]},
    {ref:"L08", c:["310000","Stocks de matières premières","3 120 000","2 980 000"], n:[2,3]},
    {ref:"L09", c:["355000","Stocks de produits finis et en-cours","5 438 000","2 240 000"], n:[2,3]},
    {ref:"L10", c:["411000","Clients et comptes rattachés","9 741 000","7 120 000"], n:[2,3]},
    {ref:"L11", c:["491000","Dépréciations des comptes clients","(185 000)","(410 000)"], n:[2,3]},
    {ref:"L12", c:["471000","Compte d'attente","412 000","18 000"], n:[2,3]},
    {ref:"L13", c:["512000","Banques","1 265 000","2 480 000"], n:[2,3]},
    {ref:"L14", c:["401000","Fournisseurs et comptes rattachés","5 830 000","5 610 000"], n:[2,3]},
    {ref:"L15", c:["421000","Personnel — rémunérations dues","745 000","690 000"], n:[2,3]},
    {ref:"L16", c:["431000","Sécurité sociale et organismes sociaux","312 000","578 000"], n:[2,3]},
    {ref:"L17", c:["701000","Ventes de produits finis","(47 310 000)","(42 060 000)"], n:[2,3]},
    {ref:"L18", c:["601000","Achats de matières premières","21 450 000","20 880 000"], n:[2,3]}
  ],
  note:"Les soldes créditeurs sont présentés entre parenthèses."
},

{ id:"D02", code:"GL-VTE-12", titre:"Grand livre des ventes — décembre 2025", fam:"Cycle ventes / clients",
  owner:"A", prix:70,
  intro:"Détail des factures et avoirs enregistrés sur le journal des ventes du mois de décembre 2025.",
  cols:["Réf.","Pièce","Date","Client","Libellé","Montant HT"],
  lignes:[
    {ref:"L01", c:["FA-2512-0121","03/12/2025","SOLARTECH SAS","Modules HX-400 — 1 200 unités","384 000"], n:[5]},
    {ref:"L02", c:["FA-2512-0134","08/12/2025","GREENWATT SA","Systèmes de stockage — 90 unités","156 500"], n:[5]},
    {ref:"L03", c:["FA-2512-0149","12/12/2025","BATIMEX SARL","Modules HX-250 — 800 unités","212 000"], n:[5]},
    {ref:"L04", c:["FA-2512-0157","16/12/2025","ENERGIE PLUS","Prestation d'installation","89 400"], n:[5]},
    {ref:"L05", c:["FA-2512-0166","19/12/2025","SOLARTECH SAS","Modules HX-400 — 900 unités","288 000"], n:[5]},
    {ref:"L06", c:["FA-2512-0172","22/12/2025","VOLTALIA NORD","Modules et onduleurs","341 200"], n:[5]},
    {ref:"L07", c:["FA-2512-0181","29/12/2025","GREENWATT SA","Complément de commande","97 800"], n:[5]},
    {ref:"L08", c:["FA-2512-0188","31/12/2025","SOLARTECH SAS","Modules HX-400 — 2 400 unités","768 000"], n:[5],
      cmt:"Bon de livraison n° BL-26-0007 daté du 08/01/2026. Transfert des risques à la livraison."},
    {ref:"L09", c:["FA-2512-0189","31/12/2025","OMEGA TRADING LTD","Lot de modules, incoterm EXW Limassol","1 250 000"], n:[5],
      cmt:"Compte client créé le 18/12/2025. Aucun contrat ni bon de commande au dossier. Règlement à 180 jours."},
    {ref:"L10", c:["FA-2512-0190","31/12/2025","ENERGIE PLUS","Régularisation de fin d'année","42 300"], n:[5]},
    {ref:"L11", c:["AV-2601-0004","04/01/2026","VOLTALIA NORD","Avoir sur facture FA-2512-0172","(240 000)"], n:[5],
      cmt:"Non-conformité constatée et notifiée par le client le 27/12/2025. Avoir non provisionné au 31/12/2025."},
    {ref:"L12", c:["—","31/12/2025","—","Total du journal des ventes de décembre","3 389 200"], n:[5]}
  ],
  note:"Sept pièces émises entre le 29 et le 31 décembre représentent 2 158 100 €, soit 64 % du mois."
},

{ id:"D03", code:"CLI-AGE", titre:"Balance âgée clients et dépréciations", fam:"Cycle ventes / clients",
  owner:"A", prix:65,
  intro:"Analyse de l'antériorité des créances clients au 31/12/2025 et dépréciations retenues par la direction.",
  cols:["Réf.","Client","Solde","Non échu","1 à 90 j","91 à 360 j","&gt; 360 j","Dépréciation"],
  lignes:[
    {ref:"L01", c:["SOLARTECH SAS","2 880 000","1 440 000","1 440 000","—","—","—"], n:[2,3,4,5,6,7]},
    {ref:"L02", c:["GREENWATT SA","(95 000)","—","—","—","—","—"], n:[2,3,4,5,6,7],
      cmt:"Solde créditeur résultant d'un acompte, maintenu à l'actif du bilan dans le poste clients."},
    {ref:"L03", c:["VOLTALIA NORD","618 000","341 200","276 800","—","—","—"], n:[2,3,4,5,6,7]},
    {ref:"L04", c:["BATIMEX SARL","680 000","—","—","—","680 000","0"], n:[2,3,4,5,6,7],
      cmt:"Procédure de sauvegarde ouverte par le tribunal de commerce le 14/10/2025."},
    {ref:"L05", c:["ENERGIE PLUS","431 700","131 700","300 000","—","—","—"], n:[2,3,4,5,6,7]},
    {ref:"L06", c:["MUNICIPALITÉ DE SAINT-JORY","212 000","—","212 000","—","—","—"], n:[2,3,4,5,6,7]},
    {ref:"L07", c:["HÉLIOS MAROC SARL","1 340 000","—","420 000","920 000","—","—"], n:[2,3,4,5,6,7],
      cmt:"Avances de trésorerie à la filiale, enregistrées dans le compte 411000 avec les clients tiers."},
    {ref:"L08", c:["DIVERS CLIENTS (74 comptes)","2 425 300","1 118 000","902 300","405 000","—","185 000"], n:[2,3,4,5,6,7]},
    {ref:"L09", c:["OMEGA TRADING LTD","1 250 000","1 250 000","—","—","—","0"], n:[2,3,4,5,6,7],
      cmt:"Aucune information de solvabilité au dossier. Adresse de facturation identique à celle d'un cabinet domiciliataire."},
    {ref:"L10", c:["TOTAL","9 742 000","4 280 900","3 231 100","1 325 000","680 000","185 000"], n:[2,3,4,5,6,7]}
  ],
  note:"Le poste clients progresse de 37 % sur l'exercice."
},

{ id:"D04", code:"RAP-BQ", titre:"Rapprochement bancaire au 31/12/2025", fam:"Trésorerie",
  owner:"B", prix:60,
  intro:"Rapprochement du compte BNP n° 3021 avec le compte 512000 de la comptabilité.",
  cols:["Réf.","Pièce","Date","Libellé","Débit","Crédit"],
  lignes:[
    {ref:"L01", c:["—","31/12/2025","Solde du relevé bancaire BNP — compte 3021","1 042 500","—"], n:[4,5]},
    {ref:"L02", c:["CH-4380","18/12/2025","Chèque émis non présenté — fournisseur ALUTECH","—","128 400"], n:[4,5]},
    {ref:"L03", c:["CH-4391","22/12/2025","Chèque émis non présenté — fournisseur COPRALUX","—","64 200"], n:[4,5]},
    {ref:"L04", c:["VIR-2212","27/12/2025","Virement fournisseur en attente de compensation","—","92 000"], n:[4,5]},
    {ref:"L05", c:["REM-1229","29/12/2025","Remise de chèques clients non créditée","310 600","—"], n:[4,5]},
    {ref:"L06", c:["CH-4412","02/11/2024","Chèque émis non présenté","—","310 000"], n:[4,5],
      cmt:"Bénéficiaire non identifié dans le grand livre fournisseurs. Chèque en suspens depuis quatorze mois."},
    {ref:"L07", c:["VIR-0201","02/01/2026","Virement reçu de SOLARTECH","520 000","—"], n:[4,5],
      cmt:"Encaissement de janvier 2026, enregistré en produit et en trésorerie au 31/12/2025."},
    {ref:"L08", c:["AGIO-12","31/12/2025","Agios et commissions du 4e trimestre","—","18 300"], n:[4,5]},
    {ref:"L09", c:["ECA-99","31/12/2025","Écart de rapprochement","47 200","—"], n:[4,5],
      cmt:"Écart non justifié, soldé par une écriture au compte 471000 sans pièce justificative."},
    {ref:"L10", c:["—","31/12/2025","Solde comptable du compte 512000","1 265 000","—"], n:[4,5]},
    {ref:"L11", c:["—","—","Organisation : le rapprochement est préparé, contrôlé et validé par le seul comptable trésorerie, qui dispose également du pouvoir de signature bancaire.","—","—"], n:[4,5]}
  ],
  note:"Aucune lettre de circularisation bancaire n'a été adressée à ce jour."
},

{ id:"D05", code:"IMMO-25", titre:"Tableau des immobilisations et amortissements", fam:"Actif immobilisé",
  owner:"B", prix:75,
  intro:"État des immobilisations corporelles et incorporelles, durées retenues et dotations de l'exercice 2025.",
  cols:["Réf.","Immobilisation","Valeur brute","Durée retenue","Dotation 2025","VNC 31/12/2025"],
  lignes:[
    {ref:"L01", c:["Ligne d'assemblage AXIA 1","6 400 000","12 ans","533 000","3 730 000"], n:[2,4,5]},
    {ref:"L02", c:["Ligne d'assemblage AXIA 2","4 200 000","12 ans","350 000","2 940 000"], n:[2,4,5],
      cmt:"Durée d'utilité portée de 5 à 12 ans au 01/01/2025. Aucune analyse technique ni note de la direction au dossier."},
    {ref:"L03", c:["Ligne SOLARIS","2 180 000","5 ans","109 000","872 000"], n:[2,4,5],
      cmt:"Production arrêtée en mars 2025. Amortissement calculé sur trois mois seulement. Aucun test de dépréciation réalisé."},
    {ref:"L04", c:["Matériel de laboratoire","890 000","5 ans","178 000","356 000"], n:[2,4,5]},
    {ref:"L05", c:["Entrepôt d'Anvers — agencements","1 240 000","10 ans","124 000","1 116 000"], n:[2,4,5]},
    {ref:"L06", c:["Matériel informatique","465 000","3 ans","155 000","155 000"], n:[2,4,5]},
    {ref:"L07", c:["Frais de réorganisation du siège","380 000","5 ans","76 000","304 000"], n:[2,4,5],
      cmt:"Honoraires d'un cabinet de conseil en organisation, inscrits à l'actif en 2025."},
    {ref:"L08", c:["Logiciel de gestion de production","620 000","5 ans","124 000","372 000"], n:[2,4,5]},
    {ref:"L09", c:["Véhicules de direction","310 000","5 ans","62 000","186 000"], n:[2,4,5]},
    {ref:"L10", c:["Sortie — machine de découpe CNC-800","780 000","—","—","0"], n:[2,4,5],
      cmt:"Cédée le 30/09/2025 pour 450 000 € à la SCI VASSEUR IMMO, société contrôlée par le président-directeur général. VNC à la date de cession : 780 000 €."}
  ],
  note:"Dotation totale 2025 : 1 711 000 € contre 2 890 000 € en 2024, à périmètre d'actifs comparable."
},

{ id:"D06", code:"STK-25", titre:"Inventaire et valorisation des stocks", fam:"Stocks et en-cours",
  owner:"C", prix:70,
  intro:"État des stocks au 31/12/2025 et méthodes de valorisation retenues par la direction.",
  cols:["Réf.","Article ou famille","Quantité","Méthode de valorisation","Valeur 31/12/2025"],
  lignes:[
    {ref:"L01", c:["Cellules photovoltaïques (matières premières)","412 000 u.","Coût unitaire moyen pondéré","2 060 000"], n:[4]},
    {ref:"L02", c:["Aluminium profilé (matières premières)","186 t","Coût unitaire moyen pondéré","640 000"], n:[4]},
    {ref:"L03", c:["Composants électroniques (matières premières)","—","Premier entré, premier sorti","420 000"], n:[4]},
    {ref:"L04", c:["Modules HX-250 (produits finis)","9 400 u.","Coût de production","1 128 000"], n:[4]},
    {ref:"L05", c:["Modules HX-400 (produits finis)","11 200 u.","Prix de vente catalogue","2 632 000"], n:[4],
      cmt:"Coût de production unitaire relevé en comptabilité analytique : 178 €. Prix catalogue appliqué : 235 €."},
    {ref:"L06", c:["Systèmes de stockage (produits finis)","340 u.","Coût de production","578 000"], n:[4]},
    {ref:"L07", c:["En-cours de production — ligne SOLARIS","—","Coût de production","1 100 000"], n:[4],
      cmt:"Ligne arrêtée en mars 2025. En-cours inchangé depuis le 31/03/2025. Aucune dépréciation constituée."},
    {ref:"L08", c:["Pièces détachées et service après-vente","—","Coût unitaire moyen pondéré","522 000"], n:[4]},
    {ref:"L09", c:["Stock en dépôt chez ANVERS LOGISTICS","—","Coût d'achat","380 000"], n:[4],
      cmt:"Stock détenu par un tiers. Aucune confirmation externe ni comptage contradictoire au dossier."},
    {ref:"L10", c:["TOTAL","—","—","9 460 000"], n:[4]},
    {ref:"L11", c:["Modalités de comptage : inventaire physique annuel réalisé le 15/11/2025.","—","—","—"], n:[4],
      cmt:"Aucun état des mouvements d'entrée et de sortie entre le 15/11/2025 et le 31/12/2025 n'a été produit."}
  ],
  note:"Le stock de produits finis et d'en-cours progresse de 143 % tandis que le chiffre d'affaires progresse de 12 %."
},

{ id:"D07", code:"PAIE-12", titre:"État de paie de décembre et charges sociales", fam:"Cycle personnel",
  owner:"C", prix:60,
  intro:"Synthèse de la paie de décembre 2025 et des comptes de charges sociales à la clôture.",
  cols:["Réf.","Rubrique","Effectif concerné","Montant"],
  lignes:[
    {ref:"L01", c:["Salaires bruts — personnel de production","148","1 042 000"], n:[3]},
    {ref:"L02", c:["Salaires bruts — fonctions support","54","486 000"], n:[3]},
    {ref:"L03", c:["Salaires bruts — direction","12","218 000"], n:[3]},
    {ref:"L04", c:["Personnel présenté comme intérimaire, réglé directement","12","96 400"], n:[3],
      cmt:"Aucune facture d'agence d'intérim. Ces personnes ne figurent ni dans la DSN ni au registre du personnel."},
    {ref:"L05", c:["Heures supplémentaires","88","74 200"], n:[3]},
    {ref:"L06", c:["Prime exceptionnelle versée au président-directeur général","1","180 000"], n:[3],
      cmt:"Versée le 22/12/2025. Aucune décision du conseil d'administration au dossier."},
    {ref:"L07", c:["Indemnités de rupture conventionnelle","2","64 000"], n:[3]},
    {ref:"L08", c:["Charges patronales comptabilisées sur l'exercice","—","612 000"], n:[3]},
    {ref:"L09", c:["Charges sociales du 4e trimestre restant dues au 31/12/2025","—","0"], n:[3],
      cmt:"L'appel de cotisations URSSAF reçu le 05/01/2026 au titre du 4e trimestre s'élève à 260 400 €."},
    {ref:"L10", c:["Provision pour congés payés au 31/12/2025","—","318 000"], n:[3],
      cmt:"Provision 2024 : 492 000 €, à effectif et à politique de congés inchangés."}
  ],
  note:"Le solde du compte 431000 passe de 578 000 € au 31/12/2024 à 312 000 € au 31/12/2025."
},

{ id:"D08", code:"FIN-EMP", titre:"Tableau des emprunts et covenants bancaires", fam:"Financement",
  owner:"D", prix:80,
  intro:"État de l'endettement financier au 31/12/2025, engagements et ratios contractuels.",
  cols:["Réf.","Contrat","Capital restant dû","Échéance","Part à moins d'un an"],
  lignes:[
    {ref:"L01", c:["BNP — prêt d'équipement 2021","3 420 000","09/2029","685 000"], n:[2,4]},
    {ref:"L02", c:["Crédit Agricole — prêt immobilier 2020","2 180 000","06/2032","218 000"], n:[2,4]},
    {ref:"L03", c:["Société Générale — prêt d'équipement 2023","1 600 000","12/2028","400 000"], n:[2,4]},
    {ref:"L04", c:["BPI — prêt d'amorçage industriel","2 400 000","11/2032","240 000"], n:[2,4],
      cmt:"Souscrit le 14/11/2025, fonds reçus le 21/11/2025. Aucune écriture correspondante au 31/12/2025."},
    {ref:"L05", c:["Crédit-bail ligne AXIA 2 (retraité hors bilan)","1 000 000","03/2027","—"], n:[2,4]},
    {ref:"L06", c:["TOTAL des emprunts bancaires hors crédit-bail","9 600 000","—","1 543 000"], n:[2,4]},
    {ref:"L07", c:["Covenant BNP — dette nette / EBITDA inférieur ou égal à 3,0","—","31/12/2025","—"], n:[2,4],
      cmt:"Ratio calculé au 31/12/2025 : 3,8. Covenant rompu, aucune renonciation obtenue de la banque. Aucun reclassement de l'encours en dettes à moins d'un an n'a été opéré."},
    {ref:"L08", c:["Covenant Crédit Agricole — gearing inférieur ou égal à 1,2","—","31/12/2025","—"], n:[2,4],
      cmt:"Ratio au 31/12/2025 : 1,05. Covenant respecté."},
    {ref:"L09", c:["Garantie — nantissement du fonds de commerce au profit de la BNP","—","03/12/2025","—"], n:[2,4],
      cmt:"Inscription prise le 03/12/2025. Aucune mention dans le projet d'annexe."},
    {ref:"L10", c:["Renégociation de novembre 2025","—","14/11/2025","—"], n:[2,4],
      cmt:"Documentation signée par le seul directeur administratif et financier. Le procès-verbal du conseil d'administration correspondant n'a pas été communiqué."}
  ],
  note:"L'EBITDA 2025 retenu par la direction s'élève à 2,4 M€."
},

{ id:"D09", code:"GOV-PV", titre:"Procès-verbaux du conseil et conventions réglementées", fam:"Gouvernance",
  owner:"D", prix:90,
  intro:"Extraits des procès-verbaux du conseil d'administration de l'exercice 2025 et registre des conventions.",
  cols:["Réf.","Extrait"],
  lignes:[
    {ref:"L01", c:["Conseil du 12/03/2025 — arrêt de la ligne de production SOLARIS. Le conseil demande à la direction financière d'évaluer avant la clôture la dépréciation des actifs correspondants."]},
    {ref:"L02", c:["Conseil du 12/03/2025 — approbation des comptes de l'exercice 2024 et affectation du résultat."]},
    {ref:"L03", c:["Assemblée générale du 24/06/2025 — le mandat du commissaire aux comptes titulaire arrive à échéance à l'issue de cette assemblée. Le procès-verbal ne comporte aucune délibération relative à son renouvellement."]},
    {ref:"L04", c:["Conseil du 18/09/2025 — autorisation donnée au président de négocier une nouvelle ligne de financement, dans la limite d'un montant de 1 500 000 €."]},
    {ref:"L05", c:["Conseil du 18/09/2025 — point d'avancement sur l'entrepôt d'Anvers et sur le recrutement d'un responsable consolidation."]},
    {ref:"L06", c:["Registre des conventions — cession de la machine de découpe CNC-800 à la SCI VASSEUR IMMO, société contrôlée par le président-directeur général. Aucune autorisation préalable du conseil. Convention non inscrite au registre et non communiquée au commissaire aux comptes."]},
    {ref:"L07", c:["Conseil du 09/12/2025 — examen du budget 2026 et du plan d'investissement."]},
    {ref:"L08", c:["Engagements hors bilan — caution solidaire donnée le 21/07/2025 au profit de la filiale Hélios Maroc SARL, à hauteur de 1 500 000 €, en garantie d'un crédit local. Aucune mention dans le projet d'annexe."]},
    {ref:"L09", c:["Rémunérations — le procès-verbal du conseil du 09/12/2025 ne comporte aucune délibération relative à une prime exceptionnelle au bénéfice du président."]},
    {ref:"L10", c:["Formalisme — les procès-verbaux des séances du 24/06/2025 et du 09/12/2025 ne sont pas signés et ne sont pas reportés sur le registre coté et paraphé."]}
  ],
  note:"Le registre des conventions réglementées n'a pas été mis à jour depuis le 31/12/2024."
}
];

const SALT = "helios-usure-31122025";
const KEY_LINE = [{"h": "011d68493278b32f", "p": 35}, {"h": "0cfa74a7aaf8a287", "p": 35}, {"h": "0ebcb8734c539f49", "p": 25}, {"h": "17c6f128dafa6bed", "p": 45}, {"h": "2086ef535a39d0a7", "p": 45}, {"h": "25170f6f28062848", "p": 35}, {"h": "25d88702fbfd80d7", "p": 45}, {"h": "276ec9915edcc180", "p": 35}, {"h": "2aa4648114f1f732", "p": 35}, {"h": "315d89e3aae01014", "p": 40}, {"h": "33104e17b83ffad9", "p": 35}, {"h": "38f2226454d0bb71", "p": 40}, {"h": "4226e044aab479be", "p": 25}, {"h": "4cd508ebd852902b", "p": 25}, {"h": "515b30bc4d17195d", "p": 30}, {"h": "57cf49ec00e2afaa", "p": 40}, {"h": "5d7e99af84b760f3", "p": 45}, {"h": "5e5c9e117bce8a0b", "p": 30}, {"h": "64efb28b8f61b634", "p": 40}, {"h": "65b8086a2793d27a", "p": 30}, {"h": "68cf6eb4435970f0", "p": 45}, {"h": "6aaca00e733c224a", "p": 40}, {"h": "6fb41e041b5182d9", "p": 40}, {"h": "745023c57e5d13d6", "p": 35}, {"h": "7606300dfc65ffe4", "p": 35}, {"h": "774e82efb1052c3c", "p": 45}, {"h": "7aae397b5be3059a", "p": 40}, {"h": "7bc4f885e59ca0a0", "p": 35}, {"h": "7d8d4b7acf9d517d", "p": 30}, {"h": "7ef02b192210f9a6", "p": 30}, {"h": "85e1ad95306df00f", "p": 45}, {"h": "8cee5777a7e053e7", "p": 35}, {"h": "a756eb81fa918c11", "p": 35}, {"h": "b1801ce8a857780c", "p": 35}, {"h": "d9424432554d85e3", "p": 30}, {"h": "dc9359c0a779bbc9", "p": 25}, {"h": "f0a0388f41e10d1e", "p": 45}, {"h": "fa26f2efdbb7518c", "p": 35}, {"h": "fd910a9d201510a7", "p": 45}];
const KEY_CAT = [{"h": "01fdf9bc73463ccf"}, {"h": "1534967cdb7d275d"}, {"h": "16a1992b82d020e7"}, {"h": "239695688d55010b"}, {"h": "2e1520973e7cedcf"}, {"h": "394ff0dfab0c9162"}, {"h": "3b8a5d2282f8d6bf"}, {"h": "42d1a4d641150bf3"}, {"h": "4395d7f40a0fe602"}, {"h": "449b0b7c2bf2a39f"}, {"h": "4598e223c9cf8cd3"}, {"h": "461915140db5329c"}, {"h": "563e123b9af91aea"}, {"h": "57d0da698fd489bf"}, {"h": "63ddab7e278d60c7"}, {"h": "7983272b3b5b3ddf"}, {"h": "81b70330d353d7cd"}, {"h": "87aab6cb56607954"}, {"h": "87fabefc1c6fe264"}, {"h": "8c9461394a7748ba"}, {"h": "902d0667773ab141"}, {"h": "94604d27f4c38c38"}, {"h": "9b8bd3b0290c23c1"}, {"h": "acce9de4b2e41de9"}, {"h": "ade93c53cb4170ea"}, {"h": "b4eb86d44abfb05b"}, {"h": "ba787ea3a8a95f2d"}, {"h": "be02fe85d76b078b"}, {"h": "bf423d0deaa47617"}, {"h": "c8d360143dafb465"}, {"h": "d169ccc4500da56b"}, {"h": "d5fa7fd67bb605d3"}, {"h": "da05a1e8ea4191aa"}, {"h": "e165040832188132"}, {"h": "e3911335d30b1de7"}, {"h": "ec39e999b6b93e3e"}, {"h": "f4ec1483d229bbdd"}, {"h": "f58cc70d813db65b"}, {"h": "fb53a3308bbaea87"}];
const KEY_NAT = [{"h": "01064bc78cfb4812"}, {"h": "01d4bfb2719d7428"}, {"h": "0b9789327f20e59c"}, {"h": "1874d2416cd9dfd7"}, {"h": "1e4333e89c7f1131"}, {"h": "1fc96ef53a4699bd"}, {"h": "30a64cd9d93b1c1c"}, {"h": "431d3cd627bcffe0"}, {"h": "47f918f697b7508e"}, {"h": "484b16f6ff32b093"}, {"h": "4d161982c55172e0"}, {"h": "4ea548df5574fbee"}, {"h": "53bd59e9474431a2"}, {"h": "5fab2a78b3706ad2"}, {"h": "619157977cbdc0b4"}, {"h": "63ee36628689c1b2"}, {"h": "64512707579e64d9"}, {"h": "64d3ccba7d01a13d"}, {"h": "679e0124bc5420d1"}, {"h": "6fcc587e43f48be2"}, {"h": "706dbe3d9fa66bf5"}, {"h": "71fe27f7b58533fc"}, {"h": "7a75d45dc5fb824b"}, {"h": "7aba59315b679962"}, {"h": "814e037e14d6f806"}, {"h": "81e7bd05d101854f"}, {"h": "82b004d0607134b9"}, {"h": "8706edcf11f45d75"}, {"h": "87d05ac175d0d388"}, {"h": "8b24d68100828f64"}, {"h": "91a3ba91845f22f6"}, {"h": "9de316ed0c6aac76"}, {"h": "a3ee2ce64e793cb1"}, {"h": "a79b0e405f45be61"}, {"h": "b397f83b8a58ed19"}, {"h": "babb5908f1ee2f60"}, {"h": "be400eef7f76ffb6"}, {"h": "c3495b174461bfc7"}, {"h": "cc06f2cac7490aa7"}, {"h": "ce477a62a49dd751"}, {"h": "d4cfe92703674fdf"}, {"h": "e742dd81d1cbbd2f"}, {"h": "e8f9755e3d4ae71c"}, {"h": "ec6510202b92d97c"}, {"h": "ececabfb380ff332"}, {"h": "ed3f3b65312318f5"}];
const KEY_INC = [{"h": "080adbaf7338fe0c"}, {"h": "0de8b97779e769e1"}, {"h": "1057f271b2cde19f"}, {"h": "1f731e9b184b2e0a"}, {"h": "296f5fb967dc87f7"}, {"h": "2be72f23494f586a"}, {"h": "38ecde6f21708046"}, {"h": "3b5d44623e032f04"}, {"h": "3f6439ac1f504b50"}, {"h": "3f6b694a1b6750df"}, {"h": "400aefae57ac0563"}, {"h": "41fd5697cde4e6d7"}, {"h": "456dfda94f1e475e"}, {"h": "487902b86fc395b3"}, {"h": "49a7bfa9559b7a17"}, {"h": "4a65829204450bfb"}, {"h": "505fd3763bbd99fd"}, {"h": "559ce1d227fd114a"}, {"h": "56cb82ad024c3954"}, {"h": "59eb6452a3e0ede7"}, {"h": "615331d82b729bdd"}, {"h": "64731cb1d6b0232f"}, {"h": "64952bcf67ec1cec"}, {"h": "66c38b47dbd976cb"}, {"h": "70943626c85cb30e"}, {"h": "73682003e1aa1411"}, {"h": "7bb04fbae8e9edfd"}, {"h": "81d6949c719493cc"}, {"h": "9964cc9a7659adc9"}, {"h": "a9ae0af7e633fa6e"}, {"h": "ab2064be7fa43eee"}, {"h": "af8c8619d9aed34d"}, {"h": "b18074a6432183ec"}, {"h": "b435403c270286e7"}, {"h": "b953075a6e840002"}, {"h": "c743c63c156a20e1"}, {"h": "c8052ca0851cf701"}, {"h": "c943712e0ee00229"}, {"h": "c9dbe8064ea3673b"}, {"h": "cc26bc1421788868"}, {"h": "cd42c781330048be"}, {"h": "d9bf8ea7336c94ac"}, {"h": "dc45a093ce9e3124"}, {"h": "e71587524ac63ff9"}, {"h": "ead517b8830ce53a"}, {"h": "ebb36df75ce636f4"}, {"h": "f1089818912f5eb7"}, {"h": "f16500827e5ab804"}, {"h": "fcb69206da3f4d9c"}, {"h": "fd0cac63b6fa63d6"}, {"h": "fd3e116dda4128f9"}, {"h": "fef9b1e1edf4aea9"}];

/* ====================== ÉTAT ====================== */
const NUMCOLS = {D00:[],D01:[2,3],D02:[4],D03:[1,2,3,4,5,6],D04:[3,4],D05:[1,3,4],D06:[3],D07:[1,2],D08:[1,3],D09:[]};
