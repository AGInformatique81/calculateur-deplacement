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


## Important

L'adresse saisie par le visiteur est envoyée à des services cartographiques tiers afin d'effectuer le calcul.
La page n'enregistre pas elle-même l'adresse.

Les services publics Nominatim et OSRM ont des limites d'utilisation. Pour un trafic professionnel important,
il faudra passer à un fournisseur disposant d'un service et de garanties adaptés.
