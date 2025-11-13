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
    
    // --- Éléments du DOM (Zone Jeu - Nouvelle Arène) ---
    const zoneJeu = document.getElementById('zone-jeu');
    const divPlateau = document.getElementById('plateau');
    const divMaMain = document.getElementById('ma-main');
    const vortexCentral = document.getElementById('vortex-central');
    
    // UI Latérale
    const divInfosPartie = document.getElementById('infos-partie');
    const btnPiocher = document.getElementById('btn-piocher');
    const logsToggle = document.getElementById('logs-toggle');
    const logsContainer = document.getElementById('logs-container');
    const divLogs = document.getElementById('logs');
    
    // Éléments "cachés" (utilisés pour la logique)
    const btnLancerPartie = document.getElementById('btn-lancer-partie');
    const spanNomSalle = document.getElementById('nom-salle');
    
    // Overlays
    const overlayAction = document.getElementById('overlay-action');
    const overlayMessage = document.getElementById('overlay-message');
    const overlayCountdown = document.getElementById('overlay-countdown');
    const overlayButtons = document.getElementById('overlay-buttons');
    let overlayTimerInterval = null;

    // Overlay Zoom
    const overlayZoom = document.getElementById('overlay-zoom');
    const overlayZoomBg = document.querySelector('.overlay-zoom-close-bg');
    const imageZoomCible = document.getElementById('image-zoom-cible');
    const zoomNomCarte = document.getElementById('zoom-nom-carte');
    const zoomTexteEffet = document.getElementById('zoom-texte-effet');
    const zoomTypeCarte = document.getElementById('zoom-type-carte');

    // === GESTIONNAIRES D'ÉVÉNEMENTS (INPUTS UTILISATEUR) ===

    // 1. Connexion
    btnRejoindre.addEventListener('click', () => {
        nomJoueur = inputNom.value;
        idSalle = inputSalle.value;
        if (nomJoueur && idSalle) {
            socket.emit('rejoindre_partie', { nom: nomJoueur, salle: idSalle });
            zoneConnexion.style.display = 'none';
            zoneJeu.style.display = 'flex'; // Afficher l'arène
            spanNomSalle.textContent = idSalle; // (Même si caché, on stocke)
        } else {
            alert("Veuillez entrer un nom et un nom de salle.");
        }
    });

    // 2. Actions de jeu
    btnLancerPartie.addEventListener('click', () => {
        socket.emit('lancer_partie', { salle: idSalle });
    });
    
    btnPiocher.addEventListener('click', () => {
        socket.emit('action_piocher', { salle: idSalle });
    });

    // 3. Toggle des Logs
    logsToggle.addEventListener('click', () => {
        logsContainer.classList.toggle('hidden');
    });

    // 4. Fonctions d'action (appelées par les clics ou le D&D)
    // CES FONCTIONS SONT VOTRE LOGIQUE BACKEND : ELLES NE CHANGENT PAS
    function onJouerCarte(carteId) {
        console.log(`Tentative de jeu (via D&D): ${carteId}`);
        socket.emit('proposer_jeu_carte', { 
            salle: idSalle, 
            carte_id: carteId 
        });
    }
    
    function onChoisirCible(choixId) {
        console.log(`Cible choisie (via Clic): ${choixId}`);
        socket.emit('reponse_ciblage', {
            salle: idSalle,
            choix: choixId
        });
    }

    function jouerHuuuu(carteId) {
        if (!carteId || !idSalle) return;
        console.log(`Tentative de contre Huuuuu (via Clic): ${carteId}`);
        socket.emit('jouer_huuuu', {
            salle: idSalle,
            carte_id: carteId
        });
    }

    // 5. Logique de Zoom (de la réponse précédente)
    function openZoomModal(carte) {
        const imageUrl = getCarteImageUrl(carte);
        imageZoomCible.src = imageUrl;
        zoomNomCarte.textContent = carte?.nom || "Carte mystère";
        zoomTexteEffet.textContent = carte?.texte_effet || "Aucun texte d'effet disponible.";
        zoomTypeCarte.textContent = carte?.type_carte ? carte.type_carte : "";
        overlayZoom.classList.remove('hidden');
    }

    function closeZoomModal() {
        overlayZoom.classList.add('hidden');
        imageZoomCible.src = ""; // Vider la source
        zoomNomCarte.textContent = "";
        zoomTexteEffet.textContent = "";
        zoomTypeCarte.textContent = "";
    }
    overlayZoomBg.addEventListener('click', closeZoomModal);
    imageZoomCible.addEventListener('click', closeZoomModal);

    // 6. Logique de Glisser-Déposer (Drag-and-Drop)
    function setupDropZones() {
        // Cible 1 : Le Vortex Central (pour Magie, etc.)
        vortexCentral.addEventListener('dragover', (e) => {
            e.preventDefault();
            vortexCentral.classList.add('cible-valide');
        });
        vortexCentral.addEventListener('dragleave', () => {
            vortexCentral.classList.remove('cible-valide');
        });
        vortexCentral.addEventListener('drop', (e) => {
            e.preventDefault();
            vortexCentral.classList.remove('cible-valide');
            const carteId = e.dataTransfer.getData('text/plain');
            if (carteId) onJouerCarte(carteId);
        });

        // Cible 2 : Notre propre poste (pour Licornes, Améliorations)
        // Cet écouteur est ajouté dans renderJeu()
    }
    setupDropZones(); // Appeler au démarrage

    // === RÉCEPTION DES ÉVÉNEMENTS SERVEUR ===
    // (Cette section est identique à votre original, elle pilote les 'render')

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
        renderJeu(); // Appel du NOUVEAU moteur de rendu
    });

    socket.on('mise_a_jour_main', (main) => {
        console.log("Mise à jour de la main:", main);
        mainActuelle = main;
        renderMain(); // Appel du NOUVEAU moteur de rendu
    });

    socket.on('erreur', (data) => {
        console.error("Erreur du serveur:", data.message);
        alert(`Erreur: ${data.message}`);
    });

    // === MOTEUR DE RENDU (Refonte pour l'Arène) ===

    // --- Fonctions Aides (inchangées) ---
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
    
    function getCarteImageUrl(carte) {
        const defaultImage = '/static/images/cartes/default.png';
        if (!carte || !carte.image_url) {
            return defaultImage;
        }

        let chemin = carte.image_url.trim();

        // Allow remote URLs (ex: CDN) to pass through untouched
        if (/^https?:\/\//i.test(chemin)) {
            return chemin;
        }

        chemin = chemin.replace(/\\/g, '/');

        if (chemin.startsWith('/static/')) {
            chemin = chemin.substring('/static/'.length);
        } else if (chemin.startsWith('static/')) {
            chemin = chemin.substring('static/'.length);
        }

        // Harmoniser les deux graphies possibles du dossier des images.
        chemin = chemin.replace('Images-cartes', 'Images_cartes');

        return `/static/${chemin}`;
    }

    // --- NOUVEAU RENDER JEU (Arène Circulaire) ---
    function renderJeu() {
        if (!etatActuel) return;
        
        // 1. Récupérer les états (logique inchangée)
        const estMonTour = etatActuel.id_joueur_actuel === monIdSocket;
        const phaseCiblage = (etatActuel.phase === 'CIBLAGE_REQUIS' && etatActuel.action_en_attente.joueur_concerne_id === monIdSocket);
        const actionEnAttente = etatActuel.action_en_attente;

        // 2. Rendu des infos et boutons (logique inchangée, cibles changées)
        divInfosPartie.textContent = `Phase: ${etatActuel.phase} | Licornes: ${etatActuel.licornes_pour_gagner} | Pioche: ${etatActuel.nb_cartes_pioche}`;
        btnLancerPartie.style.display = (etatActuel.phase === 'ATTENTE') ? 'inline-block' : 'none';
        btnPiocher.style.display = (estMonTour && (etatActuel.phase === 'PIOCHE' || etatActuel.phase === 'ACTION') && !phaseCiblage) ? 'inline-block' : 'none';

        // 3. Rendu du Plateau Circulaire (NOUVELLE LOGIQUE)
        divPlateau.innerHTML = "";
        const monIndexJoueur = etatActuel.joueurs.findIndex(j => j.id === monIdSocket);
        if (monIndexJoueur === -1) return; // Pas encore dans le jeu

        let indexAdversaire = 1; // 0 est pour nous

        etatActuel.joueurs.forEach((joueur, i) => {
            const divPoste = document.createElement('div');
            divPoste.className = 'poste-joueur';
            divPoste.dataset.joueurId = joueur.id; // Pour le ciblage

            // A. Placer le joueur sur l'arène
            if (joueur.id === monIdSocket) {
                divPoste.dataset.index = 0; // C'est NOUS
                
                // Ajouter la drop-zone sur notre propre poste
                divPoste.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    divPoste.classList.add('cible-valide');
                });
                divPoste.addEventListener('dragleave', () => {
                    divPoste.classList.remove('cible-valide');
                });
                divPoste.addEventListener('drop', (e) => {
                    e.preventDefault();
                    divPoste.classList.remove('cible-valide');
                    const carteId = e.dataTransfer.getData('text/plain');
                    if (carteId) onJouerCarte(carteId);
                });

            } else {
                divPoste.dataset.index = indexAdversaire;
                indexAdversaire++;
            }

            // B. Mettre en surbrillance le joueur actif
            if (joueur.id === etatActuel.id_joueur_actuel) {
                divPoste.classList.add('est-mon-tour');
            }

            // C. Remplir le poste du joueur (Titre + Écurie)
            divPoste.innerHTML = `<h4>${joueur.nom} (${joueur.nb_cartes_main} cartes)</h4>`;
            const divCartesEcurie = document.createElement('div');
            divCartesEcurie.className = 'ecurie-cartes';

            joueur.ecurie.forEach(carteId => {
                const carteInfo = catalogueCartes[carteId];
                const divCarte = document.createElement('div');
                divCarte.className = 'carte-ecurie';
                
                if (carteInfo) {
                    divCarte.title = `${carteInfo.nom}\n${carteInfo.texte_effet}`;
                    divCarte.classList.add(getClasseCouleurCarte(carteInfo.type_carte));

                    // Créer l'image (logique de zoom)
                    const img = document.createElement('img');
                    img.src = getCarteImageUrl(carteInfo);
                    img.alt = carteInfo.nom;
                    img.addEventListener('click', (event) => {
                        event.stopPropagation(); // Ne pas déclencher le ciblage
                        openZoomModal(carteInfo);
                    });
                    
                    const spanNom = document.createElement('span');
                    spanNom.className = 'nom-sur-carte';
                    spanNom.textContent = carteInfo.nom;
                    
                    divCarte.appendChild(img);
                    divCarte.appendChild(spanNom);

                    // D. Gérer le CIBLAGE (logique inchangée)
                    if (phaseCiblage && actionEnAttente.details_operation.source.zone === 'ECURIE') {
                        if (estCibleValide(carteInfo, actionEnAttente.details_operation.filter)) {
                            divCarte.classList.add('ciblage-possible');
                            divCarte.onclick = () => onChoisirCible(carteId);
                        }
                    }
                } else {
                    divCarte.textContent = "Erreur";
                }
                divCartesEcurie.appendChild(divCarte);
            });
            
            divPoste.appendChild(divCartesEcurie);
            divPlateau.appendChild(divPoste);
        });
        
        // 4. Rendu des Logs (logique inchangée)
        divLogs.innerHTML = "";
        etatActuel.logs.forEach(logMsg => {
            const divLog = document.createElement('div');
            divLog.textContent = logMsg;
            divLogs.prepend(divLog);
        });

        // 5. Rendu de la main et overlay
        renderMain();
        renderActionOverlay();
    }

    // --- NOUVEAU RENDER MAIN (Main en Éventail) ---
    function renderMain() {
        if (!etatActuel) return; 
        
        divMaMain.innerHTML = "";
        
        // 1. Récupérer les états (logique inchangée)
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

        // 2. Bouton Passer (logique inchangée)
        if (phaseCiblageMain && actionEnAttente.details_operation.optional) {
            const btnPasser = document.createElement('button');
            btnPasser.textContent = "Passer (ne pas cibler)";
            btnPasser.onclick = () => onChoisirCible('passer');
            divMaMain.appendChild(btnPasser);
        }

        // 3. Rendu des cartes (NOUVELLE LOGIQUE)
        const nbCartes = mainActuelle.length;
        const angleMax = 40; // Max 40 degrés d'éventail
        const angleParCarte = Math.min(angleMax / nbCartes, 5);
        const angleDebut = - (nbCartes - 1) * angleParCarte / 2;

        mainActuelle.forEach((carte, i) => {
            const btnCarte = document.createElement('button');
            btnCarte.className = 'carte-main';
            btnCarte.title = `${carte.nom}\n${carte.texte_effet}`;
            btnCarte.classList.add(getClasseCouleurCarte(carte.type_carte));

            // A. Créer l'image (logique de zoom)
            const img = document.createElement('img');
            img.src = getCarteImageUrl(carte);
            img.alt = carte.nom;
            img.addEventListener('click', (event) => {
                event.stopPropagation(); // Ne pas déclencher le 'onclick' du bouton
                openZoomModal(carte);
            });
            
            const spanNom = document.createElement('span');
            spanNom.className = 'nom-sur-carte';
            spanNom.textContent = carte.nom;

            btnCarte.appendChild(img);
            btnCarte.appendChild(spanNom);

            // B. Appliquer la rotation pour l'éventail
            const rotation = angleDebut + (i * angleParCarte);
            btnCarte.style.setProperty('--rotation', `${rotation}deg`);

            // C. Gérer les interactions (CLIC vs D&D)
            let peutJouer = false;
            let peutCibler = false;
            let peutHennir = false;

            if (phaseCiblageMain) {
                // Phase de ciblage : Le CLIC sert à CIBLER
                if (estCibleValide(carte, filtreCiblage)) {
                    btnCarte.classList.add('ciblage-possible');
                    btnCarte.onclick = () => onChoisirCible(carte.id);
                    peutCibler = true;
                }
            } else if (carte.type_carte === 'INSTANTANE' && peutRepondreInstant) {
                // Phase de réponse : Le CLIC sert à JOUER HUUUU
                btnCarte.classList.add('ciblage-possible'); // (Réutilise le style)
                btnCarte.onclick = () => jouerHuuuu(carte.id);
                peutHennir = true;
            } else if (estMonTour && phaseAction) {
                // Phase d'action : Le D&D sert à JOUER
                peutJouer = true;
            }

            // D. Activer le D&D
            if (peutJouer) {
                btnCarte.draggable = true;
                btnCarte.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', carte.id);
                    e.dataTransfer.setDragImage(btnCarte, btnCarte.offsetWidth / 2, btnCarte.offsetHeight / 2);
                    btnCarte.classList.add('is-dragging');
                    
                    // (Bonus) Afficher les zones de drop valides
                    vortexCentral.classList.add('drop-active');
                    document.querySelector('.poste-joueur[data-index="0"]').classList.add('drop-active');
                });
                btnCarte.addEventListener('dragend', () => {
                    btnCarte.classList.remove('is-dragging');
                    vortexCentral.classList.remove('drop-active');
                    document.querySelector('.poste-joueur[data-index="0"]').classList.remove('drop-active');
                });
            }

            // E. Désactiver la carte si elle ne fait rien
            btnCarte.disabled = !peutJouer && !peutCibler && !peutHennir;

            divMaMain.appendChild(btnCarte);
        });
    }

    // --- OVERLAYS (Logique inchangée) ---
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
            return;
        }

        const actionEnAttente = etatActuel.action_en_attente;
        const actionPending = etatActuel.phase === 'ACTION_EN_ATTENTE' && actionEnAttente;

        if (!actionPending) {
            overlayAction.classList.add('hidden');
            stopOverlayTimer();
            return;
        }

        // Afficher l'overlay
        overlayAction.classList.remove('hidden');
        const joueurSource = etatActuel.joueurs.find(j => j.id === actionEnAttente.joueur_source_id);
        const carteInfo = catalogueCartes[actionEnAttente.carte_jouee_id];
        const nomJoueur = joueurSource ? joueurSource.nom : "Un joueur";
        const nomCarte = carteInfo ? `'${carteInfo.nom}'` : "une carte";
        overlayMessage.textContent = `${nomJoueur} veut jouer ${nomCarte} !`;

        // Gérer le timer
        const deadlineMs = (etatActuel.timer_resolution || 0) * 1000;
        if (deadlineMs) {
            startOverlayTimer(deadlineMs);
        } else {
            overlayCountdown.textContent = "";
            stopOverlayTimer();
        }

        // Gérer les boutons
        overlayButtons.innerHTML = "";
        if (monIdSocket === actionEnAttente.joueur_source_id) {
            const info = document.createElement('p');
            info.textContent = "En attente d'une réponse...";
            overlayButtons.appendChild(info);
            return;
        }

        // Chercher une carte "Hennir" (Instantane)
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
