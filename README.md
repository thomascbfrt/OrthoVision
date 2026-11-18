# OrthoVision

Visionneuse pédagogique de radiographies, en TypeScript sans framework. Les fichiers image importés sont traités dans le navigateur. Le prototype est destiné à l’enseignement et à la recherche et ne doit pas être utilisé pour une décision médicale.

## Démarrer

Avec Node.js 22.18 ou ultérieur :

```bash
npm ci
npm run dev
```

Ouvrir l’adresse affichée dans le terminal. L’accueil explique l’angle de Cobb à l’aide d’un schéma. Cliquer sur **Ouvrir l’outil**, puis sur **Ouvrir les exemples** pour voir deux radiographies JPEG de la même colonne avant et après intervention. Les images sont dans [public/examples](public/examples). Voir les [sources et droits de réutilisation](public/examples/sources.txt).

## Utiliser la visionneuse

- Ouvrir un PNG ou un JPEG, puis poser quatre points pour tracer deux plateaux vertébraux. Les points restent dans le repère de l’image et peuvent être déplacés après un zoom. Les traits sont orientés de gauche à droite pour calculer leur écart sans ramener les angles obtus sous 90°.
- Exporter le PNG annoté ou les repères JSON. Pour rouvrir des repères, ouvrir d’abord le même fichier image, puis importer le JSON.
- Ouvrir un deuxième examen pour comparer les angles et exporter un rapport via la boîte d’impression du navigateur. L’écart affiché est descriptif : projection, positionnement, cadrage et choix des vertèbres influencent les mesures.
- **Proposer une mesure** estime deux vertèbres limites à partir des centres des masques FleXray, puis cherche les bords correspondants dans la radiographie. Les quatre points proposés restent modifiables. La suggestion peut échouer si la radio est recadrée, si des vertèbres manquent ou si les bords sont peu lisibles.
- **Afficher les masques FleXray** permet de choisir une structure et de régler son opacité. Au premier usage de l’un des deux boutons, le navigateur charge environ 203 Mo de poids depuis Hugging Face.

Les exemples et les outils manuels ne nécessitent aucun accès à Hugging Face. L’IRM et le format DICOM ne sont pas pris en charge. FleXray a été entraîné pour des radiographies conventionnelles. Voir sa [fiche d’intégration](docs/flexray.md).

## Vérifier et héberger

```bash
npm test
npm run build
npm run preview
```

Le dossier `dist/` est autonome pour les outils manuels. Sur Vercel, importer le dépôt, choisir **Vite**, utiliser `npm run build` et le dossier de sortie `dist`. Servir l’application en HTTPS en dehors de localhost.
