# Ce fichier gère la lecture des instructions JSON des cartes

def resoudre_effet(partie, joueur_source, carte_jouee, effet_json_liste):
    """
    Exécute une liste d'instructions d'effet JSON.
    Met la partie en pause si un 'CHOOSE' est rencontré.
    Appelle 'gerer_loop' si un 'LOOP' est rencontré.
    """
    print(f"MOTEUR: Résolution de l'effet pour la carte '{carte_jouee.nom}'...")
    
    for operation_data in effet_json_liste:
        op_type = operation_data.get('operation')
        
        if op_type == "LOOP":
            # NOUVEAU: On ne fait pas une boucle simple, on appelle le gestionnaire
            print(f"  -> Opération: LOOP (Cible: {operation_data.get('cible')})")
            cibles = []
            cible_type = operation_data.get('cible')
            
            if cible_type == "ALL_PLAYERS": cibles = partie.joueurs
            elif cible_type == "OTHER_PLAYERS": cibles = [j for j in partie.joueurs if j.id_session != joueur_source.id_session]
            elif cible_type == "SELF": cibles = [joueur_source]
            
            cibles_ids = [j.id_session for j in cibles]
            action_imbriquee = operation_data.get('action')

            # On démarre le loop à l'index 0
            gerer_loop(partie, carte_jouee, cibles_ids, action_imbriquee, 0)
            
            # Si le loop s'est mis en pause, on arrête tout
            if partie.phase == "CIBLAGE_REQUIS":
                return # La résolution est en pause

        elif op_type == "MOVE":
            # (Logique inchangée)
            print(f"  -> Opération: MOVE")
            source_zone_nom = operation_data.get('source', {}).get('zone')
            dest_zone_nom = operation_data.get('destination', {}).get('zone')
            count = operation_data.get('count', 1)
            source_zone = partie.get_zone_par_nom(source_zone_nom, joueur_source)
            dest_zone = partie.get_zone_par_nom(dest_zone_nom, joueur_source)
            if source_zone is None or dest_zone is None:
                partie.log_action(f"ERREUR MOTEUR: Zone invalide")
                continue
            for _ in range(count):
                if not source_zone:
                    partie.log_action(f"Zone source '{source_zone_nom}' est vide.")
                    break
                partie.move_carte(source_zone, dest_zone)
            partie.log_action(f"Déplacement de {count} carte(s) de {source_zone_nom} à {dest_zone_nom} pour {joueur_source.nom}")

        elif op_type == "CHOOSE_THEN_MOVE":
            print(f"  -> Opération: CHOOSE_THEN_MOVE (PAUSE)")
            partie.phase = "CIBLAGE_REQUIS"
            partie.action_en_attente = {
                "type": "CHOOSE_THEN_MOVE",
                "carte_source_effet": carte_jouee.id,
                "joueur_concerne_id": joueur_source.id_session,
                "details_operation": operation_data,
                "contexte_parent": None # Par défaut, pas de parent
            }
            partie.log_action(f"{joueur_source.nom} doit choisir une cible...")
            return # PAUSE

        else:
            print(f"ERREUR MOTEUR: Opération inconnue '{op_type}'")

def gerer_loop(partie, carte_jouee, cibles_ids, action_imbriquee, index_depart):
    """
    Exécute une action sur une liste de joueurs, en gérant les pauses.
    C'est la nouvelle fonction clé pour "Bombe Paillettes".
    """
    print(f"MOTEUR: Démarrage/Reprise du LOOP à l'index {index_depart}")
    
    for i in range(index_depart, len(cibles_ids)):
        joueur_id = cibles_ids[i]
        joueur_cible = partie.get_joueur(joueur_id)
        
        # On appelle resoudre_effet sur l'action IMBRIQUÉE (ex: le 'CHOOSE_THEN_MOVE')
        # Le 'joueur_source' de cet effet est le 'joueur_cible' de la boucle
        resoudre_effet(partie, joueur_cible, carte_jouee, action_imbriquee)
        
        # VÉRIFICATION : L'effet a-t-il causé une pause (CIBLAGE_REQUIS) ?
        if partie.phase == "CIBLAGE_REQUIS":
            # OUI. L'effet est en pause.
            # On doit "enrichir" l'action_en_attente avec le contexte du LOOP.
            partie.action_en_attente["contexte_parent"] = {
                "type": "LOOP",
                "index_reprise": i + 1, # L'index du PROCHAIN joueur
                "cibles_ids": cibles_ids,
                "action_imbriquee": action_imbriquee,
                "carte_source_effet_id": carte_jouee.id
            }
            print(f"MOTEUR: PAUSE dans LOOP pour {joueur_cible.nom}. Reprise à l'index {i+1}.")
            return # Le loop s'arrête, en attente de la réponse client
    
    print("MOTEUR: LOOP terminé.")


def reprendre_effet(partie, action_en_pause, choix_du_joueur):
    """
    Reprend un effet 'CHOOSE_THEN_MOVE' après que le client ait fait un choix.
    """
    print(f"MOTEUR: Reprise de l'effet avec le choix: {choix_du_joueur}")
    
    details_op = action_en_pause.get('details_operation')
    joueur_concerne = partie.get_joueur(action_en_pause.get('joueur_concerne_id'))
    
    if choix_du_joueur == 'passer':
        if details_op.get('optional') == True:
            partie.log_action(f"{joueur_concerne.nom} choisit de ne pas cibler.")
            return # L'effet est terminé sans rien faire
        else:
            partie.log_action(f"ERREUR: {joueur_concerne.nom} a tenté de passer un effet obligatoire.")
            return

    try:
        source_data = details_op.get('source')
        dest_data = details_op.get('destination')
        carte_id_ciblee = choix_du_joueur
        
        joueur_proprietaire_cible = None
        zone_source = None
        
        # C'est ici que nous gérons les différentes zones sources
        source_zone_nom = source_data.get('zone')
        
        if source_zone_nom == "ECURIE":
            for j in partie.joueurs:
                if carte_id_ciblee in j.ecurie:
                    zone_source = j.ecurie
                    joueur_proprietaire_cible = j
                    break
        elif source_zone_nom == "MAIN":
             # L'action LOOP a déjà défini le bon 'joueur_concerne'
             zone_source = joueur_concerne.main
             joueur_proprietaire_cible = joueur_concerne
        
        if zone_source is None:
            partie.log_action(f"ERREUR: Cible {carte_id_ciblee} non trouvée.")
            return

        zone_dest = partie.get_zone_par_nom(dest_data.get('zone'), joueur_concerne)

        succes = partie.move_carte(zone_source, zone_dest, carte_id=carte_id_ciblee)
        if succes:
            partie.log_action(f"{joueur_concerne.nom} a déplacé {carte_id_ciblee} de {source_zone_nom} de {joueur_proprietaire_cible.nom} vers {dest_data.get('zone')}.")
    
    except Exception as e:
        print(f"ERREUR MOTEUR lors de la reprise: {e}")
        partie.log_action("Une erreur est survenue lors du ciblage.")