<!--
  Présentation du projet et étapes pour le lancer et l’essayer.
-->

# OrthoVision

Visionneuse pédagogique de radiographies, en TypeScript sans framework. Les fichiers image importés sont traités dans le navigateur. Le prototype est destiné à l’enseignement et à la recherche et ne doit pas être utilisé pour une décision médicale.

## Démarrer

Avec Node.js 22.18 ou ultérieur :

```bash
npm ci
npm run dev
```

Sur l’accueil, choisir **Ouvrir l’outil**, puis **Essayer la radio d’exemple**. La radiographie des deux jambes et ses six points pédagogiques sont disponibles localement. [Source de la radio](public/examples/sources.txt).

## Mesurer les jambes

Utiliser une radio de face prise debout, avec les deux hanches, les genoux et les chevilles visibles sur un même cliché. Importer un PNG ou un JPEG. Identifier le côté du patient à partir du marqueur de la radio.

Pour chaque jambe, placer le centre de la tête fémorale, du genou et de la cheville, en commençant par la gauche de l’image. L’outil mesure le changement de direction entre la cuisse et la jambe. Trois centres alignés donnent 0°. Le résultat indique si le genou est décalé vers l’intérieur ou vers l’extérieur. Le positionnement lors de la prise de vue et le choix des points influencent la mesure.

**Proposer les six repères** télécharge FleXray (203 Mo au premier usage). OrthoVision estime les centres à partir des masques des fémurs et des tibias. Vérifier les points sur la radio et les déplacer au besoin. La précision de cette méthode sur une population de patients reste à évaluer. [Intégration de FleXray](docs/flexray.md).

Les commandes permettent de comparer la même jambe entre deux examens, de rouvrir des repères JSON sur la même image, d’exporter un PNG annoté ou d’imprimer les résultats. L’exemple et la mesure manuelle fonctionnent indépendamment du téléchargement du modèle.

## Vérifier et héberger

```bash
npm test
npm run build
npm run preview
```

Le dossier `dist/` est autonome pour les outils manuels. Sur Vercel, importer le dépôt, choisir **Vite**, utiliser `npm run build` et le dossier de sortie `dist`. Servir l’application en HTTPS en dehors de localhost.
