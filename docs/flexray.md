# FleXray : premières vérifications

Sources : [fiche officielle du modèle](https://huggingface.co/VictorButoi/flexray) et [code officiel](https://github.com/VictorButoi/FleXray). Vérifications effectuées le 17 novembre 2026.

- `members/flux0375` est le modèle principal préentraîné. Un export ONNX FP16 est annoncé dans `members/flux0375/onnx/` ; il est utilisé par la démonstration officielle dans le navigateur.
- Le modèle prend une image en niveaux de gris, avec un canal d'entrée, et produit 61 canaux (60 structures et le fond) à une résolution de 256 × 256. Il produit des probabilités indépendantes pour chaque structure, et non des points de mesure.
- Prétraitement documenté : passage en niveaux de gris, normalisation par les percentiles 0,5 et 99,5, ajout de bordures jusqu'à obtenir un carré, puis redimensionnement à 256 × 256. Les détails d'orientation et d'interpolation restent à vérifier dans l'implémentation officielle avant intégration.
- Les sorties correspondent à l'ordre de `label_schema.json`. Le seuil de masque par défaut est 0,5. Les sorties doivent être remises dans le repère de l'image d'origine en annulant le redimensionnement et les bordures.
- Les vertèbres C1 à C7, T1 à T12 et L1 à L5 possèdent des canaux individuels. Cela ne signifie pas que les plateaux vertébraux ou l'angle de Cobb sont fournis automatiquement.
- Code FleXray : licence MIT. Poids publics : CC BY-NC 4.0, à usage non commercial, avec attribution.

La démonstration officielle fonctionne dans un navigateur, mais nous n'avons pas encore testé l'export ONNX dans OrthoVision, les opérations WebGPU ou le repli WebAssembly. La taille du modèle, les droits d'hébergement, CORS et la qualité de la segmentation restent à vérifier avant une intégration. Aucun modèle n'est téléchargé dans cette version.
