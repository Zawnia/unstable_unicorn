document.addEventListener('DOMContentLoaded', () => {

    // --- Connexion Socket.IO ---
    const socket = io(); 

    // --- Variables d'état Globales ---
    let monIdSocket = "";
    let nomJoueur = "";
    let idSalle = "";
    
    let etatActuel = null;
    let mainActuelle = [];
    let catalogueCartes = {}; // Dictionnaire ID -> objet carte

    // --- Éléments du DOM (Zone Connexion) ---
    const zoneConnexion = document.getElementById('zone-connexion');
    const inputNom = document.getElementById('input-nom');
    const inputSalle = document.getElementById('input-salle');
    const btnRejoindre = document.getElementById('btn-rejoindre');
    
    // --- Éléments du DOM (Zone Jeu) ---
    const zoneJeu = document.getElementById('zone-jeu');
    const spanNomSalle = document.getElementById('nom-salle');
    const divInfosPartie = document.getElementById('infos-partie');
    const listeJoueurs = document.getElementById('liste-joueurs');
    const btnLancerPartie = document.getElementById('btn-lancer-partie');
    const btnPiocher = document.getElementById('btn-piocher');
    const divMaMain = document.getElementById('ma-main');
    const divPlateau = document.getElementById('plateau');
    const divLogs = document.getElementById('logs');
    const overlayAction = document.getElementById('overlay-action');
    const overlayMessage = document.getElementById('overlay-message');
    const overlayCountdown = document.getElementById('overlay-countdown');
    const overlayButtons = document.getElementById('overlay-buttons');
    let overlayTimerInterval = null;

    // === GESTIONNAIRES D'ÉVÉNEMENTS (INPUTS UTILISATEUR) ===

    btnRejoindre.addEventListener('click', () => {
        nomJoueur = inputNom.value;
        idSalle = inputSalle.value;
        if (nomJoueur && idSalle) {
            socket.emit('rejoindre_partie', { nom: nomJoueur, salle: idSalle });
            zoneConnexion.style.display = 'none';
            zoneJeu.style.display = 'flex'; // Changé en flex
            spanNomSalle.textContent = idSalle;
        } else {
            alert("Veuillez entrer un nom et un nom de salle.");
        }
    });

    btnLancerPartie.addEventListener('click', () => {
        socket.emit('lancer_partie', { salle: idSalle });
    });
    
    btnPiocher.addEventListener('click', () => {
        socket.emit('action_piocher', { salle: idSalle });
    });
    
    function onJouerCarte(carteId) {
        console.log(`Tentative de jeu: ${carteId}`);
        socket.emit('proposer_jeu_carte', { 
            salle: idSalle, 
            carte_id: carteId 
        });
    }
    
    function onChoisirCible(choixId) {
        console.log(`Cible choisie: ${choixId}`);
        socket.emit('reponse_ciblage', {
            salle: idSalle,
            choix: choixId
        });
    }

    function jouerHuuuu(carteId) {
        if (!carteId || !idSalle) return;
        console.log(`Tentative de contre Huuuuu avec ${carteId}`);
        socket.emit('jouer_huuuu', {
            salle: idSalle,
            carte_id: carteId
        });
    }

    // === RÉCEPTION DES ÉVÉNEMENTS SERVEUR ===

    socket.on('connect', () => {
        monIdSocket = socket.id;
        console.log(`Connecté au serveur avec l'ID: ${monIdSocket}`);
    });

    socket.on('catalogue_cartes', (catalogue) => {
        console.log("Catalogue de cartes reçu.");
        catalogue.forEach(carte => {
            catalogueCartes[carte.id] = carte;
        });
    });

    socket.on('mise_a_jour_etat', (etatJeu) => {
        console.log("Nouvel état reçu:", etatJeu);
        etatActuel = etatJeu;
        renderJeu(); 
    });

    socket.on('mise_a_jour_main', (main) => {
        console.log("Mise à jour de la main:", main);
        mainActuelle = main;
        renderMain(); 
    });

    socket.on('erreur', (data) => {
        console.error("Erreur du serveur:", data.message);
        alert(`Erreur: ${data.message}`);
    });

    // === MOTEUR DE RENDU ===

    function getClasseCouleurCarte(type) {
        switch(type) {
            case 'MAGIE': return 'carte-type-magie';
            case 'MAGIQUE':
            case 'BASIQUE':
            case 'BEBE': return 'carte-type-licorne';
            case 'AMELIORATION': return 'carte-type-amelioration';
            case 'DECLASSEMENT': return 'carte-type-declassement';
            case 'INSTANTANE': return 'carte-type-instantane';
            default: return 'carte-type-default';
        }
    }
    
    function estCibleValide(carteInfo, filtre) {
        if (!carteInfo || !filtre || !filtre.type) return false;
        if (filtre.type.includes("ALL")) return true;
        return filtre.type.includes(carteInfo.type_carte);
    }

    function renderJeu() {
        if (!etatActuel) return;
        
        const estMonTour = etatActuel.id_joueur_actuel === monIdSocket;
        const phaseCiblage = (etatActuel.phase === 'CIBLAGE_REQUIS' && etatActuel.action_en_attente.joueur_concerne_id === monIdSocket);
        const actionEnAttente = etatActuel.action_en_attente;

        // 1. Rendu des infos générales
        divInfosPartie.textContent = `Phase: ${etatActuel.phase} | Licornes: ${etatActuel.licornes_pour_gagner} | Pioche: ${etatActuel.nb_cartes_pioche}`;
        
        // 2. Rendu des boutons d'action
        btnLancerPartie.style.display = (etatActuel.phase === 'ATTENTE') ? 'inline-block' : 'none';
        btnPiocher.style.display = (estMonTour && (etatActuel.phase === 'PIOCHE' || etatActuel.phase === 'ACTION') && !phaseCiblage) ? 'inline-block' : 'none';

        // 3. Rendu des joueurs
        listeJoueurs.innerHTML = ""; 
        etatActuel.joueurs.forEach(joueur => {
            const li = document.createElement('li');
            li.textContent = `${joueur.nom} (${joueur.nb_cartes_main} cartes)`;
            if (joueur.id === monIdSocket) li.style.fontWeight = 'bold';
            if (joueur.id === etatActuel.id_joueur_actuel) {
                li.classList.add('est-mon-tour');
            }
            listeJoueurs.appendChild(li);
        });
        
        // 4. Rendu du Plateau (Layout horizontal)
        divPlateau.innerHTML = "";
        
        // Ajout du bouton "Passer" (pour ciblage ÉCURIE)
        if (phaseCiblage && actionEnAttente.details_operation.optional && actionEnAttente.details_operation.source.zone === 'ECURIE') {
            const btnPasser = document.createElement('button');
            btnPasser.textContent = "Passer (ne pas cibler)";
            btnPasser.onclick = () => onChoisirCible('passer');
            divPlateau.appendChild(btnPasser);
        }
        
        etatActuel.joueurs.forEach(joueur => {
            const divEcurie = document.createElement('div');
            divEcurie.className = 'ecurie';
            divEcurie.innerHTML = `<h4>Écurie de ${joueur.nom}</h4>`;
            
            const divCartesEcurie = document.createElement('div');
            divCartesEcurie.className = 'ecurie-cartes';
            
            joueur.ecurie.forEach(carteId => {
                const carteInfo = catalogueCartes[carteId];
                const divCarte = document.createElement('div');
                divCarte.className = 'carte-ecurie';
                divCarte.textContent = carteInfo ? carteInfo.nom : "Erreur";
                
                if (carteInfo) {
                    divCarte.title = carteInfo.texte_effet;
                    divCarte.classList.add(getClasseCouleurCarte(carteInfo.type_carte));
                }
                
                // Logique de Ciblage (pour écurie)
                if (phaseCiblage && actionEnAttente.details_operation.source.zone === 'ECURIE') {
                    if (estCibleValide(carteInfo, actionEnAttente.details_operation.filter)) {
                        divCarte.classList.add('ciblage-possible');
                        divCarte.onclick = () => onChoisirCible(carteId);
                    }
                }
                divCartesEcurie.appendChild(divCarte);
            });
            
            divEcurie.appendChild(divCartesEcurie);
            divPlateau.appendChild(divEcurie);
        });
        
        // 5. Rendu des Logs
        divLogs.innerHTML = "";
        etatActuel.logs.forEach(logMsg => {
            const divLog = document.createElement('div');
            divLog.textContent = logMsg;
            divLogs.prepend(divLog);
        });

        // 6. On redessine la main (au cas où les états de ciblage/action ont changé)
        renderMain();
        renderActionOverlay();
    }

    function renderMain() {
        if (!etatActuel) return; 
        
        divMaMain.innerHTML = "";
        const estMonTour = etatActuel.id_joueur_actuel === monIdSocket;
        const phaseAction = etatActuel.phase === 'ACTION';
        const actionEnAttente = etatActuel.action_en_attente || null;
        
        const phaseCiblageMain = (etatActuel.phase === 'CIBLAGE_REQUIS' &&
                                actionEnAttente &&
                                actionEnAttente.joueur_concerne_id === monIdSocket &&
                                actionEnAttente.details_operation.source.zone === 'MAIN');
        const peutRepondreInstant = (etatActuel.phase === 'ACTION_EN_ATTENTE' &&
                                    actionEnAttente &&
                                    actionEnAttente.joueur_source_id !== monIdSocket);
        
        const filtreCiblage = phaseCiblageMain ? actionEnAttente.details_operation.filter : null;

        // Ajout du bouton "Passer" (pour ciblage MAIN, si optionnel)
        if (phaseCiblageMain && actionEnAttente.details_operation.optional) {
            const btnPasser = document.createElement('button');
            btnPasser.textContent = "Passer (ne pas cibler)";
            btnPasser.onclick = () => onChoisirCible('passer');
            divMaMain.appendChild(btnPasser);
        }

        mainActuelle.forEach(carte => {
            const btnCarte = document.createElement('button');
            btnCarte.className = 'carte-main';
            btnCarte.textContent = carte.nom;
            btnCarte.title = carte.texte_effet;
            btnCarte.classList.add(getClasseCouleurCarte(carte.type_carte));

            if (phaseCiblageMain) {
                // Tour de ciblage (ex: Bombe Paillettes)
                if (estCibleValide(carte, filtreCiblage)) {
                    btnCarte.classList.add('ciblage-possible');
                    btnCarte.onclick = () => onChoisirCible(carte.id);
                    btnCarte.disabled = false;
                } else {
                    btnCarte.disabled = true; // Non ciblable
                }
            } else {
                const peutJouerCarte = estMonTour && phaseAction;
                if (carte.type_carte === 'INSTANTANE' && peutRepondreInstant) {
                    btnCarte.disabled = false;
                    btnCarte.classList.add('ciblage-possible');
                    btnCarte.onclick = () => jouerHuuuu(carte.id);
                } else {
                    btnCarte.disabled = !peutJouerCarte;
                    if (peutJouerCarte) {
                        btnCarte.onclick = () => onJouerCarte(carte.id);
                    }
                }
            }
            divMaMain.appendChild(btnCarte);
        });
    }

    function stopOverlayTimer() {
        if (overlayTimerInterval) {
            clearInterval(overlayTimerInterval);
            overlayTimerInterval = null;
        }
    }

    function startOverlayTimer(deadlineMs) {
        stopOverlayTimer();
        if (!deadlineMs) {
            overlayCountdown.textContent = "";
            return;
        }
        const updateCountdown = () => {
            const restantMs = deadlineMs - Date.now();
            const secondes = Math.max(0, Math.ceil(restantMs / 1000));
            overlayCountdown.textContent = `Résolution dans ${secondes}s`;
            if (restantMs <= 0) {
                stopOverlayTimer();
            }
        };
        updateCountdown();
        overlayTimerInterval = setInterval(updateCountdown, 300);
    }

    function renderActionOverlay() {
        if (!etatActuel) {
            overlayAction.classList.add('hidden');
            overlayButtons.innerHTML = "";
            overlayMessage.textContent = "";
            overlayCountdown.textContent = "";
            stopOverlayTimer();
            return;
        }

        const actionEnAttente = etatActuel.action_en_attente;
        const actionPending = etatActuel.phase === 'ACTION_EN_ATTENTE' && actionEnAttente;

        if (!actionPending) {
            overlayAction.classList.add('hidden');
            overlayButtons.innerHTML = "";
            overlayMessage.textContent = "";
            overlayCountdown.textContent = "";
            stopOverlayTimer();
            return;
        }

        overlayAction.classList.remove('hidden');
        const joueurSource = etatActuel.joueurs.find(j => j.id === actionEnAttente.joueur_source_id);
        const carteInfo = catalogueCartes[actionEnAttente.carte_jouee_id];
        const nomJoueur = joueurSource ? joueurSource.nom : "Un joueur";
        const nomCarte = carteInfo ? `'${carteInfo.nom}'` : "une carte";
        overlayMessage.textContent = `${nomJoueur} veut jouer ${nomCarte} !`;

        const deadlineMs = (etatActuel.timer_resolution || 0) * 1000;
        if (deadlineMs) {
            startOverlayTimer(deadlineMs);
        } else {
            overlayCountdown.textContent = "";
            stopOverlayTimer();
        }

        overlayButtons.innerHTML = "";
        if (monIdSocket === actionEnAttente.joueur_source_id) {
            const info = document.createElement('p');
            info.textContent = "En attente d'une réponse...";
            overlayButtons.appendChild(info);
            return;
        }

        const carteInstant = mainActuelle.find(carte => carte.type_carte === 'INSTANTANE');
        if (carteInstant) {
            const btn = document.createElement('button');
            btn.textContent = `Jouer '${carteInstant.nom}'`;
            btn.onclick = () => jouerHuuuu(carteInstant.id);
            overlayButtons.appendChild(btn);
        } else {
            const info = document.createElement('p');
            info.textContent = "Vous n'avez pas de Huuuuu disponible.";
            overlayButtons.appendChild(info);
        }
    }


}); // Fin du DOMContentLoaded
