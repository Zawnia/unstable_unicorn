import json
import random

class Carte:
    def __init__(self, id, nom, type_carte, texte_effet, image_url, trigger, effet):
        self.id = id
        self.nom = nom
        self.type_carte = type_carte
        self.texte_effet = texte_effet
        self.image_url = image_url
        self.trigger = trigger 
        self.effet = effet 

    def to_dict(self):
        return {
            "id": self.id,
            "nom": self.nom,
            "type_carte": self.type_carte,
            "texte_effet": self.texte_effet,
            "image_url": self.image_url
        }

# --- Variables Globales ---
CATALOGUE_CARTES = {} 
PIOCHE_DE_BASE_IDS = [] 
BEBE_LICORNE_ID = None
CATALOGUE_CARTES_JSON = {} 

def charger_catalogue_cartes():
    """Charge les définitions de cartes depuis cartes.json."""
    global BEBE_LICORNE_ID, CATALOGUE_CARTES_JSON # <-- AJOUTÉ

    CATALOGUE_CARTES.clear()
    PIOCHE_DE_BASE_IDS.clear()
    
    try:
        with open('cartes.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            CATALOGUE_CARTES_JSON = data['catalogue'] 
            
            for carte_data in data['catalogue']:
                carte_obj = Carte(
                    id=carte_data.get('id'),
                    nom=carte_data.get('nom'),
                    type_carte=carte_data.get('type_carte'),
                    texte_effet=carte_data.get('texte_effet'),
                    image_url=carte_data.get('image_url'),
                    trigger=carte_data.get('trigger'),
                    effet=carte_data.get('effet')
                )
                
                CATALOGUE_CARTES[carte_obj.id] = carte_obj
                
                if carte_obj.type_carte != "BEBE":
                    PIOCHE_DE_BASE_IDS.extend([carte_obj.id] * 5)
                else:
                    BEBE_LICORNE_ID = carte_obj.id
            
            print(f"Catalogue chargé: {len(CATALOGUE_CARTES)} cartes uniques.")
            print(f"Pioche de base créée avec {len(PIOCHE_DE_BASE_IDS)} cartes.")

    except FileNotFoundError:
        print("ERREUR: Fichier 'cartes.json' non trouvé.")
    except Exception as e:
        print(f"ERREUR lors du chargement de 'cartes.json': {e}")

def creer_pioche_depart():
    pioche = list(PIOCHE_DE_BASE_IDS)
    random.shuffle(pioche)
    return pioche

def get_carte_bebe():
    return BEBE_LICORNE_ID