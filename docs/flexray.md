<!--
  Détails sur le modèle FleXray et la façon dont OrthoVision l’utilise.
-->

# FleXray

[Code officiel](https://github.com/VictorButoi/FleXray) · [fiche du modèle](https://huggingface.co/VictorButoi/flexray) · [démonstration et manifeste](https://flexray.csail.mit.edu/demo/demo_manifest.json)

OrthoVision utilise le modèle préentraîné `flux0375` de Butoi et al., à la révision `b3d892015a51848f675739107f697c8e7ea709f4`. Le code officiel est sous licence MIT et les poids publics sous [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Les poids ne sont pas redistribués dans ce dépôt.

Le navigateur charge l’export ONNX FP16 (opset 18, environ 203 Mo) à la demande, puis vérifie son SHA-256. L’inférence utilise ONNX Runtime Web, avec WebGPU en priorité et WebAssembly en repli. Aucune partie de la radiographie n’est envoyée à un serveur.

Le prétraitement suit la [démo officielle](https://flexray.csail.mit.edu/demo/imaging.js) pour les images PNG et JPEG décodées par le navigateur : niveaux de gris, bordures noires centrales, filtre bilinéaire vers 256 × 256 puis normalisation par les percentiles 0,5 et 99,5. L’entrée `input` a la forme `[1,1,256,256]` et la sortie `probabilities` la forme `[1,61,256,256]`. Le seuil de 0,5 est appliqué par canal, dans l’ordre de `label_schema.json`, puis les bordures sont retirées pour afficher le masque sur l’image originale.

OrthoVision utilise les masques des fémurs et des tibias. Le programme sépare les deux os de chaque type et estime les centres articulaires dans des bandes proches de leurs extrémités. Il calcule ensuite l’écart à l’alignement droit. Le haut des os du pied, lorsqu’il est reconnu près du tibia, aide à situer la cheville. Les centres restent des estimations, en particulier si la tête du fémur est mal délimitée ou que les deux jambes se superposent.
