# Étape 1 : Partir d'une base Linux + Python propre
FROM python:3.11-slim

# Étape 2 : Définir un dossier de travail DANS le conteneur
WORKDIR /app

# Étape 3 : Installation des dépendancesf
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Étape 4 : Copier TOUT le reste de votre projet dans la "boîte"
COPY . .

# Étape 5 : Dire à Docker quel port votre serveur utilise
EXPOSE 8080

# Étape 6 : La commande pour lancer le jeu
# C'est la même commande que vous tapez, mais pour le Linux de la "boîte"
CMD ["python", "app.py"]