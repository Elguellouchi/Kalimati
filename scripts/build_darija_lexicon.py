# Fabrique assets/darija-lexicon.json à partir du Darija Open Dataset (DODa), cloné dans _vendor/dataset.
# DODa : https://github.com/darija-open-dataset/dataset, licence CC BY-NC 4.0 (usage non commercial, citer les auteurs).
# Usage (depuis le dossier kalimati) :  python scripts/build_darija_lexicon.py
#
# Méthode prudente : DODa traduit la darija en ANGLAIS. Chaque mot français ci-dessous a un équivalent anglais
# choisi à la main ; on ne garde un mot que si DODa contient exactement ce mot anglais, dans le bon fichier.
# Aucun mot n'est inventé : la darija vient toujours de DODa. Relecture par un locuteur natif conseillée.
import csv, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DODA = ROOT / '_vendor' / 'dataset'

# français | anglais (tel qu'écrit dans DODa) | catégorie Kalimati | fichiers DODa où chercher
FILES = {
    'food': ['semantic categories/food.csv', 'syntactic categories/nouns.csv'],
    'family': ['semantic categories/family.csv', 'syntactic categories/nouns.csv'],
    'house': ['syntactic categories/nouns.csv', 'semantic categories/places.csv'],
    'school': ['semantic categories/education.csv', 'syntactic categories/nouns.csv'],
    'emotions': ['semantic categories/emotions.csv', 'syntactic categories/adjectives.csv'],
    'body': ['semantic categories/humanbody.csv', 'semantic categories/health.csv'],
    'animals': ['semantic categories/animals.csv'],
    'clothes': ['semantic categories/clothes.csv', 'syntactic categories/nouns.csv'],
    'colors': ['semantic categories/colors.csv'],
    'places': ['semantic categories/places.csv', 'syntactic categories/nouns.csv'],
    'time': ['semantic categories/time.csv'],
    'nature': ['semantic categories/environment.csv', 'semantic categories/plants.csv', 'syntactic categories/nouns.csv'],
    'adj': ['syntactic categories/adjectives.csv'],
    'verbs': ['syntactic categories/verbs.csv'],
}
# Retirés après relecture (sens trop éloigné dans DODa) : eau (« ma », arabe classique), fruits (« dissir »),
# pâtes (« ch3ria » = vermicelles), soupe (« harira »), bébé (« trebia »), maîtresse (« oustad », masculin),
# content (« nachT »), calme, honte, lampe (« bola » = ampoule), chapeau (« tarbouch »), plage, jour (« yawm »),
# vouloir (« ba »), frère (« akh »), poisson en double.
CONCEPTS = """
pain|bread|food
lait|milk|food
jus|juice|food
thé|tea|food
café|coffee|food
pomme|apple|food
banane|banana|food
orange|orange|food
fraise|strawberry|food
raisin|grapes|food
poire|pear|food
pastèque|watermelon|food
melon|melon|food
pêche|peach|food
citron|lemon|food
datte|dates|food
figue|figs|food
carotte|carrot|food
tomate|tomato|food
pomme de terre|potato|food
oignon|onion|food
concombre|cucumber|food
olive|olives|food
légumes|vegetables|food
riz|rice|food
couscous|couscous|food
viande|meat|food
poulet|chicken|food
poisson|fish|food
œuf|egg|food
fromage|cheese|food
beurre|butter|food
miel|honey|food
sucre|sugar|food
sel|salt|food
gâteau|cake|food
biscuit|biscuit|food
chocolat|chocolate|food
yaourt|yogurt|food
confiture|jam|food
glace|ice cream|food
maman|mom|family
papa|dad|family
mère|mother|family
père|father|family
sœur|sister|family
grand-mère|grandmother|family
grand-père|grandfather|family
oncle (côté père)|paternal uncle|family
tante (côté père)|paternal aunt|family
oncle (côté mère)|maternal uncle|family
tante (côté mère)|maternal aunt|family
famille|family|family
enfant|child|family
maison|house|house
chambre|room|house
cuisine|kitchen|house
porte|door|house
fenêtre|window|house
lit|bed|house
table|table|house
chaise|chair|house
verre|glass|house
assiette|plate|house
cuillère|spoon|house
fourchette|fork|house
couteau|knife|house
clé|key|house
miroir|mirror|house
savon|soap|house
serviette|towel|house
téléphone|phone|house
télévision|television|house
école|school|school
élève|student|school
livre|book|school
cahier|notebook|school
stylo|pen|school
crayon|pencil|school
classe|classroom|school
triste|sad|emotions
en colère|angry|emotions
peur|fear|emotions
fatigué|tired|emotions
amour|love|emotions
joie|joy|emotions
tête|head|body
yeux|eyes|body
œil|eye|body
oreille|ear|body
nez|nose|body
bouche|mouth|body
dents|teeth|body
langue|tongue|body
main|hand|body
pied|foot|body
ventre|belly|body
dos|back|body
bras|arm|body
jambe|leg|body
cheveux|hair|body
doigt|finger|body
chat|cat|animals
chien|dog|animals
âne|donkey|animals
cheval|horse|animals
vache|cow|animals
mouton|sheep|animals
chèvre|goat|animals
poule|hen|animals
coq|rooster|animals
oiseau|bird|animals
lapin|rabbit|animals
lion|lion|animals
éléphant|elephant|animals
singe|monkey|animals
chameau|camel|animals
souris|mouse|animals
serpent|snake|animals
tortue|turtle|animals
papillon|butterfly|animals
abeille|bee|animals
fourmi|ant|animals
vêtements|clothes|clothes
chaussures|shoes|clothes
chaussettes|socks|clothes
pantalon|pants|clothes
robe|dress|clothes
chemise|shirt|clothes
manteau|coat|clothes
rouge|red|colors
vert|green|colors
bleu|blue|colors
jaune|yellow|colors
blanc|white|colors
noir|black|colors
orange (couleur)|orange|colors
rose|pink|colors
marron|brown|colors
gris|grey|colors
violet|purple|colors
parc|park|places
mosquée|mosque|places
hôpital|hospital|places
mer|sea|places
marché|market|places
magasin|shop|places
rue|street|places
ville|city|places
aujourd'hui|today|time
demain|tomorrow|time
hier|yesterday|time
matin|morning|time
soir|evening|time
nuit|night|time
semaine|week|time
heure|hour|time
soleil|sun|nature
lune|moon|nature
étoile|star|nature
pluie|rain|nature
arbre|tree|nature
fleur|flower|nature
grand|big|adj
petit|small|adj
chaud|hot|adj
froid|cold|adj
beau|beautiful|adj
bon|good|adj
nouveau|new|adj
propre|clean|adj
sale|dirty|adj
lourd|heavy|adj
long|long|adj
court|short|adj
rapide|fast|adj
lent|slow|adj
plein|full|adj
vide|empty|adj
manger|eat|verbs
boire|drink|verbs
dormir|sleep|verbs
jouer|play|verbs
courir|run|verbs
marcher|walk|verbs
sauter|jump|verbs
s'asseoir|sit|verbs
venir|come|verbs
aller|go|verbs
entrer|enter|verbs
sortir|go out|verbs
ouvrir|open|verbs
fermer|close|verbs
laver|wash|verbs
donner|give|verbs
prendre|take|verbs
regarder|look|verbs
voir|see|verbs
écouter|listen|verbs
parler|speak|verbs
lire|read|verbs
écrire|write|verbs
dessiner|draw|verbs
chanter|sing|verbs
danser|dance|verbs
pleurer|cry|verbs
rire|laugh|verbs
aider|help|verbs
attendre|wait|verbs
aimer|love|verbs
couper|cut|verbs
cuisiner|cook|verbs
nager|swim|verbs
""".strip()


def read_rows(rel):
    path = DODA / rel
    if not path.exists():
        return []
    with path.open(encoding='utf-8') as f:
        return list(csv.DictReader(f))


def present_je(root):
    # Forme « je » au présent depuis conjug_present.csv (« kanakl » -> « nakl »).
    for row in read_rows('syntactic categories/conjug_present.csv'):
        if row.get('root') == root and row.get('ana'):
            return re.sub(r'^ka', '', row['ana'])
    return ''


def latin(row):
    return next((row[k] for k in ('n1', 'n2', 'n3') if row.get(k)), '')


def main():
    if not DODA.exists():
        sys.exit('Dossier _vendor/dataset absent : clonez https://github.com/darija-open-dataset/dataset dedans.')
    entries, missing = [], []
    for line in CONCEPTS.splitlines():
        fr, en, cat = line.split('|')
        hit = None
        for rel in FILES[cat]:
            hit = next((r for r in read_rows(rel) if (r.get('eng') or '').strip().lower() == en and latin(r) and r.get('darija_ar')), None)
            if hit:
                break
        if not hit:
            missing.append(fr)
            continue
        entry = {'fr': fr, 'dr_lat': latin(hit), 'dr_ar': hit['darija_ar'].strip(), 'cat': cat}
        if cat == 'verbs':
            je = present_je(latin(hit))
            if je:
                entry['dr_je'] = je
        entries.append(entry)
    out = {
        'source': 'Darija Open Dataset (DODa), https://github.com/darija-open-dataset/dataset',
        'licence': 'CC BY-NC 4.0 : usage non commercial, auteurs Aissam Outchakoucht et Hamza Es-Samaali',
        'note': 'Mots choisis via la traduction anglaise de DODa. À faire relire par un locuteur natif.',
        'words': entries,
    }
    target = ROOT / 'assets' / 'darija-lexicon.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8', newline='\n')
    print(f'{len(entries)} mots gardés, {len(missing)} absents de DODa : {", ".join(missing)}')


if __name__ == '__main__':
    main()
