# Fabrique les fichiers légers de Kalimati à partir des dépôts libres clonés dans _vendor/ (jamais suivi par git).
# Usage (depuis le dossier kalimati) :  python scripts/build_assets.py
# Produit : assets/fonts/*.woff2, assets/mulberry/*.svg + index.json, assets/emoji/*.svg + index.json,
#           modules/ui-icons.js (icônes Lucide en ligne), assets/manifest.json (liste pour le cache hors ligne).
# Les dépôts sont clonés sans fichiers (« --filter=blob:none --no-checkout ») : on lit chaque fichier avec « git show ».
import json, re, subprocess, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / '_vendor'
ASSETS = ROOT / 'assets'


def git_bytes(repo, path):
    return subprocess.run(['git', '-C', str(VENDOR / repo), 'show', f'HEAD:{path}'], capture_output=True, check=True).stdout


def git_names(repo, folder):
    out = subprocess.run(['git', '-C', str(VENDOR / repo), 'ls-tree', '-r', '--name-only', 'HEAD', folder], capture_output=True, check=True, text=True).stdout
    return set(out.split('\n'))


# Même règle que slugKey() dans modules/visuals.js.
def slug(text):
    text = ''.join(c for c in unicodedata.normalize('NFD', str(text)) if not 0x300 <= ord(c) <= 0x36F).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', text))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes): path.write_bytes(data)
    else: path.write_text(data, encoding='utf-8', newline='\n')


# ---------- 1. Police Atkinson Hyperlegible Next (SIL OFL 1.1) ----------
def fonts():
    for weight in ('Regular', 'Bold'):
        name = f'AtkinsonHyperlegibleNext-{weight}.woff2'
        write(ASSETS / 'fonts' / name, git_bytes('atkinson-hyperlegible-next', f'fonts/webfonts/{name}'))
    write(ASSETS / 'fonts' / 'OFL.txt', git_bytes('atkinson-hyperlegible-next', 'OFL.txt'))


# ---------- 2. Pictogrammes Mulberry (CC BY-SA 4.0) ----------
# Mot français (tel qu'il est écrit dans l'app) -> symbole Mulberry. Choisis à la main, un par un.
WORDS = {
    # Cartes de départ
    'Je veux': 'want_,_to', 'Encore': 'more', 'Fini': 'finish', 'Aide-moi': 'help_,_to', 'Attends': 'wait_,_to',
    'Bonjour': 'hello', 'Pain': 'bread', 'Pomme': 'apple', 'Banane': 'banana', 'Gâteau': 'cake', 'Riz': 'rice',
    'Biscuit': 'biscuit_chocolate_chip', 'Œuf': 'egg', 'Eau': 'water', 'Lait': 'milk', 'Jus': 'orange_juice',
    'Ballon': 'ball', 'Poupée': 'doll', 'Musique': 'music', 'Balançoire': 'swing',
    'Manger': 'eat_,_to', 'Boire': 'drink_,_to', 'Jouer': 'play_,_to', 'Courir': 'run_,_to', 'Donner': 'give_,_to',
    'Couper': 'cut_,_to', 'Sauter': 'jump_,_to', 'Laver': 'wash_hands_,_to', 'Dessiner': 'draw_,_to', 'Ouvrir': 'open_,_to',
    'Toilettes': 'toilet', 'Dormir': 'sleep_female_,_to', 'Câlin': 'hug_,_to', 'Bain': 'bath', 'Changer': 'change_clothes_,_to',
    'Petit': 'little', 'Chaud': 'hot', 'Dehors': 'go_outside_,_to', 'Maison': 'house', 'Voiture': 'car', 'École': 'school',
    'Chips': 'crisps', 'Fromage': 'cheese', 'Pancake': 'pancakes', 'Mcdo': 'hamburger_carton', 'Coca-cola': 'drink_cold',
    'Trampoline': 'trampoline', "C'est quoi ?": 'what', 'Où est ?': 'where', 'Lire': 'read_book_,_to', 'Écrire': 'write_,_to', 'Regarder': 'look_,_to',
    'Dans': 'in', 'Sur': 'on', 'Sous': 'under_1',
    # Catalogue des exercices : aliments
    'fraise': 'strawberry', 'raisin': 'grapes', 'poire': 'pear', 'pastèque': 'watermelon', 'melon': 'melon',
    'pêche': 'peach', 'citron': 'lemon', 'ananas': 'pineapple', 'mangue': 'mango', 'datte': 'dates', 'carotte': 'carrot',
    'tomate': 'tomato', 'pomme de terre': 'potato', 'brocoli': 'broccoli', 'concombre': 'cucumber', 'oignon': 'onion',
    'olive': 'olives', 'fromage': 'cheese', 'poulet': 'chicken', 'poisson': 'fish', 'viande': 'meat', 'pâtes': 'pasta',
    'soupe': 'soup', 'chocolat': 'chocolate', 'miel': 'honey', 'beurre': 'butter', 'crêpe': 'pancakes', 'glace': 'ice_cream',
    'confiture': 'jam',
    # Animaux
    'chat': 'cat', 'chien': 'dog', 'lapin': 'rabbit', 'cheval': 'horse', 'vache': 'cow', 'mouton': 'sheep', 'poule': 'chicken_live',
    'poussin': 'chick', 'canard': 'duck', 'âne': 'donkey', 'dinde': 'turkey', 'oie': 'goose', 'tortue': 'turtle', 'oiseau': 'bird',
    'hamster': 'hamster', 'perroquet': 'parrot', 'lion': 'lion', 'éléphant': 'elephant', 'girafe': 'giraffe', 'zèbre': 'zebra',
    'tigre': 'tiger', 'ours': 'bear', 'loup': 'wolf', 'renard': 'fox', 'crocodile': 'crocodile', 'hippopotame': 'hippopotamus',
    'rhinocéros': 'rhinoceros', 'kangourou': 'kangaroo', 'panda': 'panda', 'chameau': 'camel', 'dauphin': 'dolphin', 'crabe': 'crab',
    'grenouille': 'frog', 'papillon': 'butterfly', 'abeille': 'bee_honey', 'fourmi': 'ant', 'escargot': 'snail', 'araignée': 'spider',
    # Nature, vêtements, corps
    'arbre': 'tree', 'fleur': 'flower', 'soleil': 'sun', 'lune': 'Moon', 'étoile': 'star', 'pluie': 'rain',
    'tee-shirt': 't-shirt', 'pantalon': 'trousers', 'robe': 'dress', 'pull': 'jumper', 'manteau': 'coat', 'pyjama': 'pyjamas',
    'casquette': 'cap', 'écharpe': 'scarf', 'gants': 'gloves', 'lunettes': 'glasses', 'parapluie': 'umbrella',
    'tête': 'head', 'yeux': 'eyes', 'bouche': 'mouth', 'dents': 'teeth', 'langue': 'tongue', 'bras': 'arm', 'pied': 'foot', 'oreilles': 'ear',
    # Maison, toilette, école, transports, jeux, lieux
    'lampe': 'lamp', 'table': 'table', 'chaise': 'chair', 'porte': 'door', 'fenêtre': 'window', 'horloge': 'clock', 'miroir': 'mirror',
    'assiette': 'plate', 'bol': 'bowl', 'cuillère': 'spoon', 'fourchette': 'fork', 'couteau': 'knife', 'éponge': 'sponge', 'balai': 'broom',
    'savon': 'soap', 'brosse à dents': 'toothbrush', 'dentifrice': 'toothpaste', 'peigne': 'comb', 'papier toilette': 'toilet_roll',
    'douche': 'shower', 'baignoire': 'bath', 'serviette de bain': 'towel',
    'crayon': 'pencil', 'stylo': 'pen', 'ciseaux': 'scissors', 'colle': 'glue', 'peinture': 'paint', 'cahier': 'notebook',
    'bus': 'bus', 'vélo': 'bicycle', 'moto': 'motorcycle', 'train': 'train', 'avion': 'aeroplane', 'hélicoptère': 'helicopter',
    'bateau': 'boat', 'ambulance': 'ambulance', 'camion de pompiers': 'fire_engine', 'tracteur': 'tractor', 'fusée': 'rocket',
    'balle': 'ball', 'peluche': 'teddy_bear', 'toboggan': 'slide', 'tambour': 'drum', 'guitare': 'guitar', 'flûte': 'flute',
    'bulles de savon': 'bubble_mixture', 'plage': 'beach', 'supermarché': 'shop',
}
# Émojis sans mot connu (étapes de routines, toilettes) -> symbole Mulberry.
EMOJI_WORDS = {
    '🚽': 'toilet', '🪥': 'brush_teeth_,_to', '🧼': 'wash_hands_,_to', '🛁': 'bath', '🚿': 'shower', '😴': 'sleep_female_,_to',
    '🍽️': 'eat_,_to', '🥤': 'drink_,_to', '🏫': 'school', '🏠': 'house', '🚗': 'car', '🎒': 'school_bag', '🧸': 'teddy_bear',
}


def mulberry():
    names = {n[3:-4] for n in git_names('mulberry-symbols', 'EN') if n.endswith('.svg')}
    words, emoji, missing, files = {}, {}, [], set()
    for table, target, key in ((WORDS, words, slug), (EMOJI_WORDS, emoji, lambda e: e)):
        for word, name in table.items():
            if name not in names:
                missing.append(name)
                continue
            file = re.sub(r'[^A-Za-z0-9_-]+', '_', name).strip('_').lower() + '.svg'
            target[key(word)] = file
            if file not in files:
                write(ASSETS / 'mulberry' / file, git_bytes('mulberry-symbols', f'EN/{name}.svg'))
                files.add(file)
    write(ASSETS / 'mulberry' / 'index.json', json.dumps({'words': words, 'emoji': emoji}, ensure_ascii=False, indent=0))
    write(ASSETS / 'mulberry' / 'LICENSE.txt', git_bytes('mulberry-symbols', 'LICENSE.txt'))
    print(f'Mulberry : {len(files)} symboles ({len(words)} mots, {len(emoji)} émojis). Introuvables : {missing}')
    return sorted(files)


# ---------- 3. Émojis OpenMoji (CC BY-SA 4.0) : ceux des écrans d'Abir ----------
EMOJI_SOURCES = ['data.js', 'modules/ex-schedule.js', 'modules/content.js', 'modules/ex-emotions.js', 'modules/stories.js',
                 'modules/calm.js', 'modules/catalog.js']
EMOJI_RE = re.compile('(?:[\U0001F000-\U0001FAFF☀-➿⌀-⏿⬀-⯿■-◿]'
                      '(?:️|[\U0001F3FB-\U0001F3FF])?(?:‍[\U0001F000-\U0001FAFF☀-➿](?:️)?)*)')


def openmoji():
    known = {e['hexcode'] for e in json.loads(git_bytes('openmoji', 'data/openmoji.json'))}
    used = set()
    for name in EMOJI_SOURCES:
        used.update(EMOJI_RE.findall((ROOT / name).read_text(encoding='utf-8')))
    index = {}
    for emo in sorted(used):
        for variant in (emo, emo.replace('️', '')):
            hexcode = '-'.join(f'{ord(c):X}' for c in variant)
            if hexcode in known:
                if not (ASSETS / 'emoji' / f'{hexcode}.svg').exists():
                    write(ASSETS / 'emoji' / f'{hexcode}.svg', git_bytes('openmoji', f'color/svg/{hexcode}.svg'))
                index[emo] = f'{hexcode}.svg'
                index[emo.replace('️', '')] = f'{hexcode}.svg'
                break
    write(ASSETS / 'emoji' / 'index.json', json.dumps(index, ensure_ascii=False, indent=0))
    write(ASSETS / 'emoji' / 'LICENSE.txt', git_bytes('openmoji', 'LICENSE.txt'))
    files = sorted(set(index.values()))
    print(f'OpenMoji : {len(files)} émojis sur {len(used)} trouvés dans les écrans d’Abir.')
    return files


# ---------- 4. Icônes Lucide (ISC) pour l'espace adulte ----------
ICONS = {  # nom utilisé dans l'app -> fichier Lucide (certains noms ont changé chez Lucide)
    'activity': 'activity', 'clock': 'clock', 'timer': 'timer', 'mic': 'mic', 'play': 'play', 'square': 'square',
    'download': 'download', 'file-down': 'file-down', 'printer': 'printer', 'filter': 'funnel', 'trash-2': 'trash',
    'check-circle-2': 'circle-check', 'alert-triangle': 'triangle-exclamation-point', 'bar-chart-3': 'chart-column',
    'lock': 'lock', 'unlock': 'lock-open', 'info': 'info',
}


def lucide():
    lines = []
    for name, file in ICONS.items():
        svg = git_bytes('lucide', f'icons/{file}.svg').decode('utf-8')
        inner = re.sub(r'\s+', ' ', re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)).strip().replace("'", "\\'")
        lines.append(f"  '{name}': '{inner}',")
    copyright_line = next(l for l in git_bytes('lucide', 'LICENSE').decode('utf-8').splitlines() if l.startswith('Copyright'))
    write(ROOT / 'modules' / 'ui-icons.js', f"""// Icônes sobres de l'espace adulte, tirées de Lucide (https://lucide.dev, licence ISC).
// {copyright_line}
// Fichier fabriqué par scripts/build_assets.py : ne pas modifier à la main.
const PATHS = {{
{chr(10).join(lines)}
}};

// Renvoie le code d'une icône (trait de la couleur du texte, cachée aux lecteurs d'écran).
export function uiIcon(name, size = 18) {{
  const inner = PATHS[name];
  if (!inner) return '';
  return `<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="${{size}}" height="${{size}}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${{inner}}</svg>`;
}}

// Contenu d'un bouton : icône + texte (à passer à btn() ou h()).
export function iconLabel(name, text, size = 18) {{
  const icon = document.createElement('span');
  icon.className = 'ui-icon-wrap';
  icon.innerHTML = uiIcon(name, size);
  return [icon, text];
}}

export const UI_ICON_NAMES = Object.keys(PATHS);
""")
    write(ASSETS / 'LICENSE-lucide.txt', git_bytes('lucide', 'LICENSE'))
    print(f'Lucide : {len(ICONS)} icônes dans modules/ui-icons.js')


if __name__ == '__main__':
    if not VENDOR.exists():
        sys.exit('Dossier _vendor/ absent : clonez d’abord les dépôts (voir le début de scripts/build_assets.py).')
    fonts()
    mul = mulberry()
    emo = openmoji()
    lucide()
    write(ASSETS / 'manifest.json', json.dumps({
        'fonts': ['fonts/AtkinsonHyperlegibleNext-Regular.woff2', 'fonts/AtkinsonHyperlegibleNext-Bold.woff2'],
        'mulberry': [f'mulberry/{f}' for f in mul], 'emoji': [f'emoji/{f}' for f in emo],
    }, indent=0))
    print('Liste pour le cache hors ligne : assets/manifest.json')
