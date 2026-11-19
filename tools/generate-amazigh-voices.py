#!/usr/bin/env python3
"""
Packs vocaux amazighs pour Kalimati (v10.7) : outil à lancer sur le PC, jamais dans le téléphone.
Fabrique un MP3 par carte (24 kbit/s mono, silences coupés) pour une variété : shi (tachelhit),
tzm (tamazight du centre), rif (tarifit) ou zgh (tamazight standard IRCAM).

À lancer SEULEMENT après la relecture des mots par des locuteurs natifs (grille de relecture du Drive).

Ordre des sources pour chaque carte :
  1. un enregistrement humain (--human-dir) nommé <id de la carte>.mp3 ou .wav (préférable) ;
  2. sinon la voix de synthèse Meta MMS-TTS (facebook/mms-tts-shi, facebook/mms-tts-rif-script_latin).
     ATTENTION : licence CC-BY-NC 4.0 (usage non commercial seulement). Pour tzm et zgh, il n'existe pas
     de modèle MMS : le modèle tachelhit est utilisé et l'accent sera faux. Faire écouter par un natif.

Les identifiants viennent de tools/amazigh-cards.json (fabriqué par : node tools/export-amazigh-cards.mjs).
Ce sont les vrais identifiants des cartes : sinon l'appli ne retrouve pas les sons.

Usage :
  node tools/export-amazigh-cards.mjs
  python3 tools/generate-amazigh-voices.py --lang shi --out ./voix/shi --dry-run
  python3 tools/generate-amazigh-voices.py --lang shi --out ./voix/shi --human-dir ./enregistrements/shi
Résultat : voix/<variété>/<id>.mp3 et voix/amz-<variété>-index.json (lu par le bouton « Télécharger » de Progrès).
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

VARIETIES = ("shi", "tzm", "rif", "zgh")
CARD_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,119}$", re.IGNORECASE)
PRIVATE_CARD_RE = re.compile(r"^c-personnes-(?!papa$|maman$|papi$|mamie$|maitresse$)")
MMS_MODELS = {
    "shi": "facebook/mms-tts-shi",
    "rif": "facebook/mms-tts-rif-script_latin",
    "tzm": "facebook/mms-tts-shi",  # pas de modèle tzm : repli tachelhit, à faire écouter par un natif
    "zgh": "facebook/mms-tts-shi",  # pas de modèle zgh : repli tachelhit, à faire écouter par un natif
}


def load_cards(cards_path: Path, lang: str) -> dict:
    """Renvoie {id de carte: mot en lettres latines} pour la variété demandée."""
    if not cards_path.exists():
        raise SystemExit(f"Fichier introuvable : {cards_path}. Lancez d'abord : node tools/export-amazigh-cards.mjs")
    data = json.loads(cards_path.read_text(encoding="utf-8"))
    texts = {}
    for card in data.get("cards", []):
        card_id = str(card.get("id", ""))
        word = (card.get(lang) or {}).get("lat", "").strip()
        if not word or not CARD_ID_RE.match(card_id) or PRIVATE_CARD_RE.match(card_id):
            continue
        texts[card_id] = word
    return texts


def encode_mp3_24k(src: Path, dst_mp3: Path) -> None:
    dst_mp3.parent.mkdir(parents=True, exist_ok=True)
    trim = "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
        "-af", f"{trim},areverse,{trim},areverse",
        "-ac", "1", "-ar", "22050", "-b:a", "24k",
        str(dst_mp3),
    ]
    subprocess.run(cmd, check=True)


def synthesize_with_mms(texts: dict, lang: str, work_dir: Path) -> dict:
    try:
        from transformers import VitsModel, AutoTokenizer
        import torch
        import scipy.io.wavfile as wavfile
    except ImportError as exc:
        raise RuntimeError("Outils manquants sur le PC : pip install torch transformers scipy") from exc

    model_id = MMS_MODELS[lang]
    print(f"Voix de synthèse : {model_id} (licence CC-BY-NC 4.0, usage non commercial).")
    if lang in ("tzm", "zgh"):
        print("Attention : pas de modèle pour cette variété, l'accent tachelhit sera utilisé.")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = VitsModel.from_pretrained(model_id)
    generated = {}
    for card_id, phrase in texts.items():
        # Le modèle lit des minuscules ; les lettres qu'il ne connaît pas sont ignorées (faire écouter le résultat).
        inputs = tokenizer(phrase.lower(), return_tensors="pt")
        if inputs["input_ids"].shape[-1] == 0:
            print(f"  ignoré (lettres inconnues du modèle) : {card_id} « {phrase} »")
            continue
        with torch.no_grad():
            waveform = model(**inputs).waveform[0].cpu().numpy()
        wav_path = work_dir / f"{card_id}.wav"
        wavfile.write(str(wav_path), rate=model.config.sampling_rate, data=waveform)
        generated[card_id] = wav_path
    return generated


def main() -> int:
    parser = argparse.ArgumentParser(description="Packs vocaux amazighs de Kalimati (outil PC)")
    parser.add_argument("--lang", required=True, choices=VARIETIES)
    parser.add_argument("--cards", default="tools/amazigh-cards.json", help="Liste des cartes (node tools/export-amazigh-cards.mjs)")
    parser.add_argument("--human-dir", default=None, help="Enregistrements humains : <id de la carte>.mp3 ou .wav")
    parser.add_argument("--out", required=True, help="Dossier de sortie, par exemple ./voix/shi")
    parser.add_argument("--no-tts", action="store_true", help="Seulement les enregistrements humains (pas de synthèse)")
    parser.add_argument("--dry-run", action="store_true", help="Montre la liste sans rien fabriquer")
    args = parser.parse_args()

    texts = load_cards(Path(args.cards), args.lang)
    out_dir = Path(args.out)

    if args.dry_run:
        print(json.dumps({"lang": args.lang, "count": len(texts), "exemples": list(texts.items())[:5]}, ensure_ascii=False, indent=2))
        return 0

    if not shutil.which("ffmpeg"):
        print("Erreur : ffmpeg est nécessaire sur le PC (couper les silences, encoder en MP3).", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    work_dir = out_dir / "_wav_tmp"
    work_dir.mkdir(parents=True, exist_ok=True)
    human_dir = Path(args.human_dir) if args.human_dir else None

    remaining = {}
    final_entries = {}
    for card_id, phrase in texts.items():
        dst_mp3 = out_dir / f"{card_id}.mp3"
        human = None
        if human_dir:
            human = next((p for p in (human_dir / f"{card_id}.mp3", human_dir / f"{card_id}.wav") if p.exists()), None)
        if human:
            encode_mp3_24k(human, dst_mp3)
            final_entries[card_id] = phrase
        else:
            remaining[card_id] = phrase

    if remaining and not args.no_tts:
        wavs = synthesize_with_mms(remaining, args.lang, work_dir)
        for card_id, wav_path in wavs.items():
            encode_mp3_24k(wav_path, out_dir / f"{card_id}.mp3")
            final_entries[card_id] = remaining[card_id]

    shutil.rmtree(work_dir, ignore_errors=True)
    total_bytes = sum((out_dir / f"{card_id}.mp3").stat().st_size for card_id in final_entries)
    index_path = out_dir.parent / f"amz-{args.lang}-index.json"
    index_data = {
        "lang": args.lang,
        "version": 1,
        "count": len(final_entries),
        "totalBytes": total_bytes,
        "entries": final_entries,
    }
    index_path.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pack {args.lang} prêt : {len(final_entries)} MP3 ({total_bytes / 1024:.1f} Ko) -> {index_path}")
    missing = sorted(set(texts) - set(final_entries))
    if missing:
        print(f"Sans voix : {len(missing)} cartes (ex. {', '.join(missing[:5])}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
