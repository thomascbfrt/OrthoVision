# OrthoVision

Prototype web pour explorer des images radiographiques. Cette première version permet d'ouvrir et d'afficher une image PNG ou JPEG dans le navigateur.

**Projet expérimental : ne pas utiliser pour un diagnostic ou une décision médicale.**

## Lancer le projet

Il faut installer Node.js sur son ordinateur, puis ouvrir un terminal dans le dossier du projet :

```bash
npm install
npm run dev
```

Ouvrir ensuite l'adresse indiquée dans le terminal. Pour vérifier et construire le projet : `npm run build`.

## Ce qui fonctionne

- Import d'un fichier PNG ou JPEG et affichage sans déformation.
- Affichage du nom du fichier et des dimensions de l'image.
- Le fichier reste dans le navigateur : cette version ne l'envoie à aucun serveur.

Aucune radiographie n'est incluse : utiliser une image que vous êtes autorisé à employer, de préférence sans données personnelles.

## Prochaines étapes

Ajouter progressivement les annotations et les mesures manuelles, puis étudier l'intégration facultative du modèle FleXray. Il n'y a pas encore de mesure, de segmentation, de stockage ni d'intelligence artificielle dans ce prototype.

## Organisation

- `index.html` : contenu de la page.
- `src/style.css` : apparence.
- `src/main.ts` : connexion entre l'interface et les actions.
- `src/viewer.ts` : ouverture et vérification de l'image.
- `docs/flexray.md` : premières vérifications sur le modèle.

Ce code est distinct du projet FleXray : aucun de ses poids ou de ses fichiers n'est inclus.
