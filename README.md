# OrthoVision

Visionneuse pédagogique de radiographies, en TypeScript sans framework. Les fichiers image importés sont traités dans le navigateur. Le prototype est destiné à l’enseignement et à la recherche et ne doit pas être utilisé pour une décision médicale.

## Démarrer

Avec Node.js 22.18 ou ultérieur :

```bash
npm ci
npm run dev
```

Ouvrir l’adresse affichée dans le terminal. Pour un premier essai, cliquer sur **Ouvrir les exemples**. Deux radiographies JPEG de la même colonne avant et après intervention sont conservées dans [public/examples](public/examples) et servies avec l’application. Voir les [sources et droits de réutilisation](public/examples/sources.txt).

## Utiliser la visionneuse

- Ouvrir un PNG ou un JPEG, puis poser quatre points pour tracer deux plateaux vertébraux. Les points restent dans le repère de l’image et peuvent être déplacés après un zoom. Le logiciel affiche le plus petit angle entre les deux droites, de 0 à 90°.
- Exporter le PNG annoté ou les repères JSON. Pour rouvrir des repères, ouvrir d’abord le même fichier image, puis importer le JSON.
- Ouvrir un deuxième examen pour comparer les angles et exporter un rapport via la boîte d’impression du navigateur. L’écart affiché est descriptif : projection, positionnement, cadrage et choix des vertèbres influencent les mesures.


## Vérifier et héberger

```bash
npm run build
npm run preview
```

Le dossier `dist/` est autonome pour les outils manuels. Sur Vercel, importer le dépôt, choisir **Vite**, utiliser `npm run build` et le dossier de sortie `dist`. Servir l’application en HTTPS en dehors de localhost.
