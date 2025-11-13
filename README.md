Unstable Unicorn online game
- 

Project overview
- 
- Simple Flask-based web project that implements a card-game-like demo. The app serves a small browser UI from `templates/` and `static/` and contains game logic in Python modules.

Main features
- 
- Web UI served by `app.py` (Flask)
- Game logic in `jeu_logique.py`, `moteur_effets.py`, and `cartes.py`
- Card metadata in `cartes.json`
- Static assets under `static/` including JS, CSS, and images
- Dockerfile included for containerized runs

Prerequisites
- Python 3.8+ (recommended)
- PowerShell (Windows instructions below)
- (Optional) Docker if you want to run the containerized app

Install (development)
1. Create and activate a virtual environment (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

Run (development)
- Start the Flask app (PowerShell):

```powershell
# from project root
.\.venv\Scripts\Activate.ps1
python app.py
```

- Open your browser at http://127.0.0.1:5000 (or the printed address)

Run with Docker
- Build the image and run a container (PowerShell):

```powershell
docker build -t unstable_unicorn:local .
docker run -p 5000:5000 unstable_unicorn:local
```

Project structure (key files)
- 
- `app.py` — Flask entrypoint and routes
- `cartes.json` — card data used by the game
- `cartes.py` — helpers for card loading / parsing
- `jeu_logique.py` — core game rules and turn logic
- `moteur_effets.py` — effect engine for card interactions
- `templates/` — HTML templates (includes `index.html`)
- `static/` — JS (`jeu.js`), CSS (`style.css`), and images (`Images_cartes/`)
- `Dockerfile` — containerization
- `requirements.txt` — Python dependencies

Development notes
- 
- The current branch is `features_alex` in this workspace.
- If you change Python code, restart the Flask app to pick up changes.
- Static assets are served from `static/`; use browser dev tools to debug client-side behavior.

Contributing
- 
- Fork or branch from `features_alex`, implement changes, and open a pull request describing the change.
- Keep changes focused and include tests or manual test steps where applicable.

License & credits
- 
-No license file included. Add `LICENSE` if you intend to open-source this project.
- Icons and images likely come from local assets in `static/Images_cartes/`.

Contact / Next steps
- 
An app by Zawnia & Carlos Echenique
