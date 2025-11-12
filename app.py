import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room 

import cartes
from jeu_logique import EtatJeu
import moteur_effets # Importe le nouveau moteur
import time

# --- Configuration ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'votre_cle_secrete_ici'
parties_actives = {} 
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
TEMPS_REPONSE_HUUUU = 5 

# --- Chargement initial ---
cartes.charger_catalogue_cartes()
print("Serveur prêt et catalogue de cartes chargé.")

# --- Fonctions Utilitaires (MODIFIÉES) ---

def diffuser_etat_partie(id_salle):
    partie = parties_actives.get(id_salle)
    if partie:
        # CORRECTION: On utilise socketio.emit
        socketio.emit('mise_a_jour_etat', partie.to_dict_public(), to=id_salle)
    else:
        print(f"Erreur: Impossible de diffuser l'état pour la salle {id_salle}")

def envoyer_mains_privees(partie):
    for joueur in partie.joueurs:
        main_ids = joueur.main
        main_objets = [cartes.CATALOGUE_CARTES[id_carte].to_dict() 
                       for id_carte in main_ids if id_carte in cartes.CATALOGUE_CARTES]
        # CORRECTION: On utilise socketio.emit
        socketio.emit('mise_a_jour_main', main_objets, to=joueur.id_session)

# (La fonction resoudre_carte_jouee est inchangée, elle n'émet rien)
def resoudre_carte_jouee(partie, joueur_source, carte_modele):
    """Rejoue la logique initiale de résolution d'une carte quand le timer expire."""
    if not joueur_source or not carte_modele:
        partie.log_action("ERREUR: Impossible de résoudre la carte (source inconnue).")
        return

    # Vérifie si la carte est toujours en main (elle n'a pas été contrée)
    if carte_modele.id not in joueur_source.main:
        partie.log_action(f"ERREUR: {joueur_source.nom} n'a plus {carte_modele.nom} en main (probablement contré).")
        return

    partie.log_action(f"La carte {carte_modele.nom} est résolue.")

    if carte_modele.type_carte == "MAGIE":
        partie.move_carte(joueur_source.main, partie.defausse, carte_modele.id)
    elif carte_modele.type_carte in ["MAGIQUE", "BASIQUE", "AMELIORATION"]:
        partie.move_carte(joueur_source.main, joueur_source.ecurie, carte_modele.id)
    else:
        partie.move_carte(joueur_source.main, partie.defausse, carte_modele.id)

    if carte_modele.effet and carte_modele.trigger == "ON_PLAY":
        moteur_effets.resoudre_effet(partie, joueur_source, carte_modele, carte_modele.effet)

    if carte_modele.type_carte in ["MAGIQUE", "BASIQUE", "AMELIORATION"]:
        if carte_modele.effet and carte_modele.trigger == "ON_ENTER_STABLE":
            moteur_effets.resoudre_effet(partie, joueur_source, carte_modele, carte_modele.effet)

    if partie.phase == "ACTION":
        if not partie.verifier_victoire():
            partie.passer_phase_fin_tour()
        else:
            partie.log_action(f"🏆🏆🏆 {joueur_source.nom} A GAGNÉ ! 🏆🏆🏆")
            partie.phase = "FIN_PARTIE"

def verifier_timer_resolution(id_salle):
    """Thread léger qui vérifie si la fenêtre de Huuuuu est écoulée."""
    partie = parties_actives.get(id_salle)
    if not partie:
        return

    action_a_resoudre = partie.action_en_attente
    if not action_a_resoudre or partie.phase != "ACTION_EN_ATTENTE":
        return
        
    # On capture le timer au début
    timer_fin = partie.timer_resolution or 0

    while time.time() < timer_fin:
        # Si la phase a changé (ex: un Huuuu a été joué), le timer est annulé
        if partie.phase != "ACTION_EN_ATTENTE" or partie.action_en_attente != action_a_resoudre:
            print("Timer annulé, un Huuuuu a été joué ou l'action a changé.")
            return
        socketio.sleep(0.1)

    # --- LE TIMER A EXPIRÉ ---
    
    # Double vérification finale (au cas où quelque chose se soit passé pendant le sleep)
    if partie.phase != "ACTION_EN_ATTENTE" or partie.action_en_attente != action_a_resoudre:
        print("Timer annulé au dernier moment.")
        return

    print("Timer expiré. Résolution de l'effet.")

    joueur_source = partie.get_joueur(action_a_resoudre.get("joueur_source_id"))
    carte_modele = cartes.CATALOGUE_CARTES.get(action_a_resoudre.get("carte_jouee_id"))

    partie.phase = "ACTION"
    partie.action_en_attente = None
    partie.timer_resolution = None

    resoudre_carte_jouee(partie, joueur_source, carte_modele)
    
    # CORRECTION: Ces fonctions vont maintenant utiliser socketio.emit et fonctionner
    diffuser_etat_partie(id_salle)
    envoyer_mains_privees(partie)

# --- Routes et Connexion ---

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def on_connect():
    print(f"Client connecté: {request.sid}")
    # CORRECTION: On utilise socketio.emit
    socketio.emit('catalogue_cartes', cartes.CATALOGUE_CARTES_JSON, to=request.sid)

@socketio.on('disconnect')
def on_disconnect():
    print(f"Client déconnecté: {request.sid}")
    # TODO: Gérer la déconnexion

@socketio.on('rejoindre_partie')
def on_rejoindre_partie(data):
    nom_joueur = data.get('nom', 'Joueur Anonyme')
    id_salle = data.get('salle', 'default_room')
    join_room(id_salle)
    partie = parties_actives.get(id_salle)
    if not partie:
        partie = EtatJeu(id_salle)
        parties_actives[id_salle] = partie
        print(f"Création d'une nouvelle partie: {id_salle}")
    joueur = partie.ajouter_joueur(request.sid, nom_joueur)
    if not joueur:
        # CORRECTION: On utilise socketio.emit
        socketio.emit('erreur', {"message": "La partie a déjà commencé."}, to=request.sid)
        leave_room(id_salle)
        return
    diffuser_etat_partie(id_salle)
    main_ids = joueur.main
    main_objets = [cartes.CATALOGUE_CARTES[id_carte].to_dict() 
                   for id_carte in main_ids if id_carte in cartes.CATALOGUE_CARTES]
    # CORRECTION: On utilise socketio.emit
    socketio.emit('mise_a_jour_main', main_objets, to=request.sid)

@socketio.on('lancer_partie')
def on_lancer_partie(data):
    id_salle = data.get('salle', 'default_room')
    partie = parties_actives.get(id_salle)
    if not partie:
        # CORRECTION: On utilise socketio.emit
        return socketio.emit('erreur', {"message": "Partie non trouvée."}, to=request.sid)
        
    if len(partie.joueurs) < 2:
        # CORRECTION: On utilise socketio.emit
        return socketio.emit('erreur', {"message": "Il faut être au moins 2 joueurs pour lancer."}, to=request.sid)

    partie_demarree = partie.demarrer_partie()
    
    if partie_demarree:
        diffuser_etat_partie(id_salle)
        envoyer_mains_privees(partie)
    else:
        # CORRECTION: On utilise socketio.emit
        socketio.emit('erreur', {"message": "Impossible de démarrer la partie."}, to=request.sid)

# --- ÉVÉNEMENTS DE JEU (Règles) ---

@socketio.on('action_piocher')
def on_action_piocher(data):
    id_salle = data.get('salle', 'default_room')
    partie = parties_actives.get(id_salle)
    if not partie: return
    joueur_id = request.sid 
    joueur = partie.get_joueur(joueur_id)
    if not joueur: return
    succes = partie.action_piocher_carte(joueur_id)
    if succes:
        diffuser_etat_partie(id_salle)
        main_ids = joueur.main
        main_objets = [cartes.CATALOGUE_CARTES[id_carte].to_dict() 
                       for id_carte in main_ids if id_carte in cartes.CATALOGUE_CARTES]
        # CORRECTION: On utilise socketio.emit
        socketio.emit('mise_a_jour_main', main_objets, to=joueur.id_session)

# --- ÉVÉNEMENTS DE JEU (Effets de Cartes) ---

@socketio.on('proposer_jeu_carte')
def on_proposer_jeu_carte(data):
    id_salle = data.get('salle', 'default_room')
    carte_id = data.get('carte_id')
    
    partie = parties_actives.get(id_salle)
    joueur = partie.get_joueur(request.sid) if partie else None
    carte_modele = cartes.CATALOGUE_CARTES.get(carte_id)
    
    if not all([partie, joueur, carte_modele]):
        return socketio.emit('erreur', {"message": "Données de jeu invalides."}, to=request.sid)
    if partie.get_joueur_actuel() != joueur or partie.phase != "ACTION":
        return socketio.emit('erreur', {"message": "Ce n'est pas votre tour ou pas la bonne phase."}, to=request.sid)
    if carte_id not in joueur.main:
        return socketio.emit('erreur', {"message": "Vous n'avez pas cette carte."}, to=request.sid)
    if partie.action_en_attente:
        return socketio.emit('erreur', {"message": "Une action est déjà en attente."}, to=request.sid)
        
    partie.phase = "ACTION_EN_ATTENTE"
    partie.action_en_attente = {
        "type": "ACTION_EN_ATTENTE",
        "joueur_source_id": joueur.id_session,
        "carte_jouee_id": carte_id,
        "trigger": carte_modele.trigger,
        "effet_json": carte_modele.effet
    }
    partie.timer_resolution = time.time() + TEMPS_REPONSE_HUUUU
    partie.log_action(f"{joueur.nom} veut jouer {carte_modele.nom}. Huuuuu ?")

    diffuser_etat_partie(id_salle)
    socketio.start_background_task(target=verifier_timer_resolution, id_salle=id_salle)

@socketio.on('jouer_huuuu')
def on_jouer_huuuu(data):
    id_salle = data.get('salle', 'default_room')
    carte_id = data.get('carte_id', 'huuuuu') # On devrait récupérer l'ID de la carte Huuuu
    partie = parties_actives.get(id_salle)
    action_en_attente = partie.action_en_attente if partie else None
    joueur_contrant = partie.get_joueur(request.sid) if partie else None

    if not partie or partie.phase != "ACTION_EN_ATTENTE" or not action_en_attente:
        return socketio.emit('erreur', {"message": "Aucune action en attente."}, to=request.sid)
    if not joueur_contrant:
        return socketio.emit('erreur', {"message": "Joueur inconnu."}, to=request.sid)
    if action_en_attente.get('joueur_source_id') == joueur_contrant.id_session:
        # Note: Certaines règles autorisent à contrer ses propres cartes, mais gardons simple
        return socketio.emit('erreur', {"message": "Vous ne pouvez pas contrer votre propre carte."}, to=request.sid)
    if carte_id not in joueur_contrant.main:
        return socketio.emit('erreur', {"message": "Vous n'avez pas cette carte instantanée."}, to=request.sid)

    joueur_source = partie.get_joueur(action_en_attente.get('joueur_source_id'))
    carte_cible = cartes.CATALOGUE_CARTES.get(action_en_attente.get('carte_jouee_id'))

    # Défausser la carte Huuuu
    partie.move_carte(joueur_contrant.main, partie.defausse, carte_id)
    # Défausser la carte contrée (qui est toujours dans la main du joueur source)
    if joueur_source and action_en_attente.get('carte_jouee_id') in joueur_source.main:
        partie.move_carte(joueur_source.main, partie.defausse, action_en_attente.get('carte_jouee_id'))

    nom_carte = carte_cible.nom if carte_cible else "la carte adverse"
    partie.log_action(f"{joueur_contrant.nom} crie 'Huuuuu !' et annule {nom_carte}.")

    # L'action est contrée, le tour du joueur source continue
    partie.phase = "ACTION" 
    partie.action_en_attente = None
    partie.timer_resolution = None

    # NOTE: On ne finit PAS le tour du joueur. Son action a été contrée,
    # mais son tour continue. Il peut jouer une autre carte.
    # (Si on voulait que ça termine son tour, on appellerait passer_phase_fin_tour)

    diffuser_etat_partie(id_salle)
    envoyer_mains_privees(partie) # Les deux mains ont changé

@socketio.on('reponse_ciblage')
def on_reponse_ciblage(data):
    id_salle = data.get('salle', 'default_room')
    partie = parties_actives.get(id_salle)
    joueur = partie.get_joueur(request.sid)
    
    if not partie or not joueur or partie.phase != "CIBLAG_REQUIS":
        return socketio.emit('erreur', {"message": "Pas en phase de ciblage."}, to=request.sid)
        
    action_en_pause = partie.action_en_attente
    
    if action_en_pause.get('joueur_concerne_id') != joueur.id_session:
        return socketio.emit('erreur', {"message": "Vous n'êtes pas le joueur qui doit cibler."}, to=request.sid)
        
    partie.log_action(f"{joueur.nom} a choisi sa cible.")
    choix_client = data.get('choix')
    
    partie.phase = "ACTION"
    partie.action_en_attente = None
    
    moteur_effets.reprendre_effet(partie, action_en_pause, choix_client)
    
    contexte_parent = action_en_pause.get("contexte_parent")
    
    if contexte_parent and contexte_parent.get("type") == "LOOP":
        print("APP: Reprise d'un LOOP...")
        carte_modele = cartes.CATALOGUE_CARTES.get(contexte_parent.get('carte_source_effet_id'))
        
        moteur_effets.gerer_loop(partie, 
                                 carte_modele, 
                                 contexte_parent.get("cibles_ids"), 
                                 contexte_parent.get("action_imbriquee"), 
                                 contexte_parent.get("index_reprise"))
        
        if partie.phase == "CIBLAGE_REQUIS":
            diffuser_etat_partie(id_salle)
            envoyer_mains_privees(partie)
            return 
            
    if partie.phase == "ACTION":
        if not partie.verifier_victoire():
            partie.passer_phase_fin_tour()
        else:
            partie.log_action(f"🏆🏆🏆 {joueur.nom} A GAGNÉ ! 🏆🏆🏆")
            partie.phase = "FIN_PARTIE"

    diffuser_etat_partie(id_salle)
    envoyer_mains_privees(partie)

# --- Démarrage ---
if __name__ == '__main__':
    print("Démarrage du serveur Unstable Unicorns (MODE DATA-DRIVEN)...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)