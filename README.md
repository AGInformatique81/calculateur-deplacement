# Calculateur de déplacement – AG Informatique 81

Petite page statique destinée à GitHub Pages.

## Fonctionnement

Le client saisit l'adresse de l'intervention. La page :

1. recherche l'adresse avec Nominatim / OpenStreetMap ;
2. calcule la distance routière avec OSRM ;
3. applique le barème suivant :
   - jusqu'à 10 km : gratuit ;
   - plus de 10 à 20 km : 15 € ;
   - plus de 20 à 30 km : 30 € ;
   - plus de 30 km : sur devis.

Le point de départ configuré dans `script.js` est :

`9 Square Léopold Fabre, 81250 Curvalle, France`

## Publication sur GitHub Pages

1. Créer un dépôt GitHub public, par exemple `calculateur-deplacement`.
2. Ajouter `index.html`, `style.css` et `script.js` à la racine du dépôt.
3. Dans GitHub : **Settings > Pages**.
4. Dans **Build and deployment**, choisir **Deploy from a branch**.
5. Choisir la branche `main` et le dossier `/ (root)`.
6. Enregistrer.

La page sera ensuite disponible à une adresse du type :

`https://VOTRE-UTILISATEUR.github.io/calculateur-deplacement/`

## Domaine personnalisé

Quand le domaine AG Informatique 81 sera configuré, la page pourra par exemple être reliée à :

`deplacement.aginformatique81.fr`

## Important

L'adresse saisie par le visiteur est envoyée à des services cartographiques tiers afin d'effectuer le calcul.
La page n'enregistre pas elle-même l'adresse.

Les services publics Nominatim et OSRM ont des limites d'utilisation. Pour un trafic professionnel important,
il faudra passer à un fournisseur disposant d'un service et de garanties adaptés.
