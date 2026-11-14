# Voix livrées des cartes de départ qui n'en ont pas encore (voix/fr|dr/<id>.mp3 + voix/index.json).
# Usage (depuis le dossier kalimati) :
#   node tools/export-cards.mjs > _vendor/cards.json
#   python scripts/gen_piper_voices.py _vendor/cards.json              -> voix manquantes, mêmes voix qu'avant (edge-tts)
#   python scripts/gen_piper_voices.py _vendor/cards.json --piper      -> essai Piper hors ligne (écoute seulement)
#
# Choix : toutes les cartes gardent UNE seule voix par langue (Éloïse en français, Mouna en darija), pour qu'Abir
# entende toujours la même voix. Seuls les fichiers manquants sont créés ; rien d'existant n'est remplacé, et une voix
# enregistrée par le parent passe toujours avant (speech.js).
# Piper (https://github.com/OHF-Voice/piper1-gpl) marche sans internet, mais n'a pas de voix darija : ar_JO est de l'arabe
# jordanien. Avec --piper, le script fabrique des essais .wav en français dans _vendor/piper/essais/ pour comparer à l'oreille.
import asyncio, json, shutil, subprocess, sys, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOIX = ROOT / 'voix'
EDGE = {'fr': ('fr-FR-EloiseNeural', '-10%'), 'dr': ('ar-MA-MounaNeural', '-15%')}
PIPER_MODEL = ROOT / '_vendor' / 'piper' / 'fr_FR-siwis-medium.onnx'


def spoken(card, lang):  # même règle que spokenText() dans speech.js
    return (card.get('sayAr') or card.get('ar')) if lang == 'dr' else (card.get('sayFr') or card.get('fr'))


async def edge_save(text, voice, rate, target):
    import edge_tts
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(target))
            if target.stat().st_size > 1000:
                return True
        except Exception as error:  # réseau capricieux : on réessaie
            print('  nouvel essai', target.name, error, file=sys.stderr)
        await asyncio.sleep(1 + attempt)
    return False


async def make_missing(cards):
    index = json.loads((VOIX / 'index.json').read_text(encoding='utf-8'))
    made, failed = [], []
    for lang, (voice, rate) in EDGE.items():
        (VOIX / lang).mkdir(parents=True, exist_ok=True)
        for card in cards:
            text = spoken(card, lang)
            if not text or index.get(lang, {}).get(card['id']) == text:
                continue
            target = VOIX / lang / f"{card['id']}.mp3"
            if target.exists() and card['id'] in index.get(lang, {}):
                continue  # le texte a changé : on ne remplace pas sans le demander
            if await edge_save(text, voice, rate, target):
                index.setdefault(lang, {})[card['id']] = text
                made.append(f'{lang}:{card["id"]}')
            else:
                failed.append(f'{lang}:{card["id"]}')
    (VOIX / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8', newline='\n')
    print(f'{len(made)} voix créées, {len(failed)} échecs : {failed}')


def piper_trials(cards):
    if not PIPER_MODEL.exists():
        sys.exit('Modèle absent : python -m piper.download_voices --data-dir _vendor/piper fr_FR-siwis-medium')
    from piper import PiperVoice
    voice = PiperVoice.load(str(PIPER_MODEL))
    out = ROOT / '_vendor' / 'piper' / 'essais'
    out.mkdir(parents=True, exist_ok=True)
    for card in cards[:12]:
        with wave.open(str(out / f"{card['id']}.wav"), 'wb') as wav:
            voice.synthesize_wav(spoken(card, 'fr'), wav)
    if shutil.which('ffmpeg') is None:
        print('Essais .wav créés. ffmpeg absent : pas de conversion en .mp3 (non nécessaire pour écouter).')
    print(f'Essais Piper dans {out}')


if __name__ == '__main__':
    cards = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    if '--piper' in sys.argv:
        piper_trials(cards)
    else:
        asyncio.run(make_missing(cards))
