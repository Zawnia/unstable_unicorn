import random
# On importe le catalogue pour vérifier le type des cartes
from cartes import creer_pioche_depart, get_carte_bebe, CATALOGUE_CARTES

class Joueur:
    """Représente un joueur (conteneur de zones)."""
    def __init__(self, id_session, nom):
        self.id_session = id_session
        self.nom = nom
        self.main = [] 
        self.ecurie = [] 

class EtatJeu:
    """Représente l'état complet d'une partie (un conteneur de zones)."""
    
    def __init__(self, id_salle):
        self.id_salle = id_salle
        self.pioche = []
        self.defausse = []
        self.nurserie = []
        
        self.joueurs = []
        self.joueur_actuel_index = 0
        
        # Phases: ATTENTE, DEBUT_TOUR, PIOCHE, ACTION, ACTION_EN_ATTENTE, CIBLAGE_REQUIS, FIN_TOUR, FIN_PARTIE
        self.phase = "ATTENTE" 
        self.action_en_attente = None 
        self.timer_resolution = None
        self.logs_partie = []
        
        # NOUVEAU: La condition de victoire est définie au lancement
        self.licornes_pour_gagner = 7

    def log_action(self, message):
        print(f"LOG: {message}")
        self.logs_partie.append(message)
        if len(self.logs_partie) > 10:
            self.logs_partie.pop(0)

    # --- Gestion des Zones ---

    def get_zone_par_nom(self, nom_zone, joueur_concerne):
        if nom_zone == "PIOCHE": return self.pioche
        if nom_zone == "DEFAUSSE": return self.defausse
        if nom_zone == "NURSERIE": return self.nurserie
        if nom_zone == "MAIN": return joueur_concerne.main
        if nom_zone == "ECURIE": return joueur_concerne.ecurie
        return None

    def move_carte(self, zone_source, zone_destination, carte_id=None):
        carte_a_deplacer = None
        
        if carte_id:
            if carte_id in zone_source:
                carte_a_deplacer = carte_id
                zone_source.remove(carte_id)
            else:
                print(f"ERREUR: Carte {carte_id} non trouvée dans la zone source {zone_source}.")
                return False
        elif zone_source:
            carte_a_deplacer = zone_source.pop(0)
        else:
            print("ERREUR: Zone source vide.")
            return False
            
        if carte_a_deplacer:
            zone_destination.append(carte_a_deplacer)
            return True
        return False

    # --- Gestion des Joueurs ---

    def ajouter_joueur(self, id_session, nom):
        if self.phase != "ATTENTE": return None
        for j in self.joueurs:
            if j.id_session == id_session:
                j.nom = nom
                return j 
        nouveau_joueur = Joueur(id_session, nom)
        self.joueurs.append(nouveau_joueur)
        return nouveau_joueur

    def get_joueur_actuel(self):
        if not self.joueurs: return None
        return self.joueurs[self.joueur_actuel_index]

    def get_joueur(self, id_session):
        for j in self.joueurs:
            if j.id_session == id_session:
                return j
        return None

    # --- Machine à États (Règles de Jeu) ---

    def demarrer_partie(self):
        if self.phase != "ATTENTE" or len(self.joueurs) < 2:
            self.log_action("Impossible de lancer : au moins 2 joueurs requis.")
            return False 
        
        # --- MISE À JOUR LOGIQUE VICTOIRE ---
        # Règle: 6-8 joueurs = 6 licornes. Sinon 7.
        if len(self.joueurs) >= 6:
            self.licornes_pour_gagner = 6
        else:
            self.licornes_pour_gagner = 7
        
        self.log_action(f"Partie lancée ! {self.licornes_pour_gagner} licornes pour gagner.")
        
        self.pioche = creer_pioche_depart()
        id_bebe = get_carte_bebe()
        
        if not id_bebe:
            self.log_action("ERREUR: ID de bébé licorne non trouvé.")
            return False
            
        self.nurserie = [id_bebe] * (13 - len(self.joueurs))
            
        for joueur in self.joueurs:
            joueur.ecurie = [id_bebe] 
            joueur.main = []
            for _ in range(5):
                if self.pioche:
                    joueur.main.append(self.pioche.pop(0)) 
                    
        self.joueur_actuel_index = random.randint(0, len(self.joueurs) - 1)
        self.passer_au_tour_suivant(demarrage=True) 
        return True

    def passer_au_tour_suivant(self, demarrage=False):
        if not demarrage:
            self.joueur_actuel_index = (self.joueur_actuel_index + 1) % len(self.joueurs)
            
        self.phase = "DEBUT_TOUR"
        joueur = self.get_joueur_actuel()
        self.log_action(f"Début du tour de {joueur.nom}.")
        
        # TODO: Phase 1: Exécuter effets 'BEGIN_TURN'
        
        self.phase = "PIOCHE"
        self.log_action(f"{joueur.nom} doit piocher.")

    def action_piocher_carte(self, joueur_id):
        """(Règle de jeu) Piocher."""
        joueur = self.get_joueur_actuel()
        if not joueur or joueur.id_session != joueur_id:
            self.log_action(f"ERREUR: Mauvais joueur a tenté de piocher.")
            return False

        if self.phase == "PIOCHE":
            self.move_carte(self.pioche, joueur.main)
            self.phase = "ACTION"
            self.log_action(f"{joueur.nom} a pioché. Phase d'action.")
            return True
        
        elif self.phase == "ACTION":
            self.move_carte(self.pioche, joueur.main)
            self.log_action(f"{joueur.nom} a pioché (action). Fin du tour.")
            self.passer_phase_fin_tour()
            return True
            
        self.log_action(f"ERREUR: {joueur.nom} a tenté de piocher hors phase.")
        return False

    def passer_phase_fin_tour(self):
        """(Règle de jeu) Fin de tour."""
        joueur = self.get_joueur_actuel()
        self.phase = "FIN_TOUR"
        
        # TODO: Gérer la défausse si > 7 cartes (nécessite un CIBLAGE)
        
        self.passer_au_tour_suivant()
        
    # --- MISE À JOUR LOGIQUE VICTOIRE ---
    
    def verifier_victoire(self):
        """
        (Règle de jeu) Vérifie si un joueur a atteint le nombre de licornes requis.
        Cette fonction est appelée après chaque action.
        """
        
        # On vérifie tous les joueurs
        for joueur in self.joueurs:
            count = 0
            for carte_id in joueur.ecurie:
                # On récupère le modèle de la carte depuis le catalogue
                carte = CATALOGUE_CARTES.get(carte_id)
                
                # On vérifie si la carte est bien une licorne
                if carte and carte.type_carte in ["BEBE", "BASIQUE", "MAGIQUE"]:
                    count += 1
            
            # Si le joueur a assez de licornes...
            if count >= self.licornes_pour_gagner:
                # Victoire !
                self.phase = "FIN_PARTIE" # Bloque le jeu
                self.log_action(f"🏆🏆🏆 {joueur.nom} a {count} licornes et gagne la partie ! 🏆🏆🏆")
                return True # Signale au serveur qu'il y a un gagnant
                
        return False # Personne n'a gagné pour l'instant

    # --- Formatage pour le Client ---
    
    def to_dict_public(self):
        """Ce que TOUS les joueurs voient."""
        return {
            "id_salle": self.id_salle,
            "phase": self.phase,
            "id_joueur_actuel": self.get_joueur_actuel().id_session if self.joueurs else None,
            "nb_cartes_pioche": len(self.pioche),
            "nb_cartes_defausse": len(self.defausse),
            "nb_cartes_nurserie": len(self.nurserie),
            "licornes_pour_gagner": self.licornes_pour_gagner, # Envoie l'info au client
            "joueurs": [
                {
                    "id": j.id_session,
                    "nom": j.nom,
                    "ecurie": j.ecurie,
                    "nb_cartes_main": len(j.main)
                } for j in self.joueurs
            ],
            "action_en_attente": self.action_en_attente,
            "timer_resolution": self.timer_resolution,
            "logs": self.logs_partie
        }
    
    def get_main_joueur(self, id_session):
        joueur = self.get_joueur(id_session)
        if joueur:
            return joueur.main
        return []
