#!/usr/bin/env python3
"""
Packs vocaux amazighs pour Kalimati (v10.7) : outil à lancer sur un ordinateur, jamais dans le téléphone.
Fabrique un MP3 par carte (24 kbit/s mono, silences coupés) pour une variété : shi (tachelhit),
tzm (tamazight du centre), rif (tarifit) ou zgh (tamazight standard IRCAM).

À faire écouter par des locuteurs natifs avant de présenter les voix aux familles.

Ordre des sources pour chaque carte :
  1. un enregistrement humain (--human-dir) nommé <id de la carte>.mp3 ou .wav (préférable) ;
  2. sinon la voix de synthèse Meta MMS-TTS (modèles facebook/mms-tts-*).
     ATTENTION : licence CC-BY-NC 4.0 (usage non commercial seulement).
     L'outil essaie d'abord un modèle de la variété ; s'il n'existe pas, il prend le modèle tachelhit
     (l'accent sera alors celui du Souss). Faire écouter par un natif.

Les lettres du mot sont adaptées à celles que le modèle connaît (ex. « ɣ » -> « gh » si besoin).
Chaque remplacement est noté dans le rapport voix/amz-<variété>-rapport.json.

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
import unicodedata
from pathlib import Path

VARIETIES = ("shi", "tzm", "rif", "zgh")
CARD_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,119}$", re.IGNORECASE)
PRIVATE_CARD_RE = re.compile(r"^c-personnes-(?!papa$|maman$|papi$|mamie$|maitresse$)")
# Modèles essayés dans l'ordre : d'abord la variété elle-même, puis le tachelhit (repli).
MMS_CANDIDATES = {
    "shi": ["facebook/mms-tts-shi", "facebook/mms-tts-shi-script_latin"],
    "rif": ["facebook/mms-tts-rif-script_latin", "facebook/mms-tts-rif"],
    "tzm": ["facebook/mms-tts-tzm", "facebook/mms-tts-tzm-script_latin", "facebook/mms-tts-shi", "facebook/mms-tts-shi-script_latin"],
    "zgh": ["facebook/mms-tts-zgh", "facebook/mms-tts-zgh-script_tifinagh", "facebook/mms-tts-shi", "facebook/mms-tts-shi-script_latin"],
}
# Lettre absente du modèle : équivalents essayés dans l'ordre ("" = lettre muette).
FALLBACKS = {
    "ɣ": ["ɣ", "ġ", "gh", "g"], "ḍ": ["ḍ", "d"], "ṭ": ["ṭ", "t"], "ṛ": ["ṛ", "r"], "ẓ": ["ẓ", "z"],
    "ṣ": ["ṣ", "s"], "ḥ": ["ḥ", "h"], "ɛ": ["ɛ", "ε", "ʕ", "ʿ", "3", ""], "č": ["č", "ch", "tc", "c"],
    "š": ["š", "ch", "sh", "c"], "ʷ": ["ʷ", "w", ""], "x": ["x", "kh"], "q": ["q", "k"], "e": ["e", "ə", ""],
    "o": ["o", "u"], "c": ["c", "ch", "sh"], "j": ["j", "dj", "ž"], "y": ["y", "i"], "w": ["w", "u"],
}
MIN_COVERAGE = 0.9  # part des lettres que le modèle doit connaître pour être choisi


def load_cards(cards_path: Path, lang: str) -> dict:
    """Renvoie {id de carte: {"lat": ..., "tif": ...}} pour la variété demandée."""
    if not cards_path.exists():
        raise SystemExit(f"Fichier introuvable : {cards_path}. Lancez d'abord : node tools/export-amazigh-cards.mjs")
    data = json.loads(cards_path.read_text(encoding="utf-8"))
    texts = {}
    for card in data.get("cards", []):
        card_id = str(card.get("id", ""))
        entry = card.get(lang) or {}
        word = str(entry.get("lat", "")).strip()
        if not word or not CARD_ID_RE.match(card_id) or PRIVATE_CARD_RE.match(card_id):
            continue
        texts[card_id] = {"lat": word, "tif": str(entry.get("tif", "")).strip()}
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


def mp3_seconds(path: Path) -> float:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                             check=True, capture_output=True, text=True).stdout.strip()
        return round(float(out), 2)
    except Exception:  # noqa: BLE001 - mesure seulement indicative
        return 0.0


def letters(text: str) -> list:
    return [ch for ch in unicodedata.normalize("NFC", text.lower()) if ch.isalpha() or ch == "ʷ"]


def adapt_to_vocab(text: str, vocab: set, replaced: dict) -> str:
    """Remplace chaque lettre inconnue du modèle par un équivalent connu. Note les remplacements."""
    out = []
    for ch in unicodedata.normalize("NFC", text.lower()):
        if ch in vocab or not (ch.isalpha() or ch == "ʷ"):
            out.append(" " if ch in "-’'" else ch)
            continue
        for option in FALLBACKS.get(ch, []):
            if option == "" or all(part in vocab for part in option):
                out.append(option)
                if option != ch:
                    replaced[ch] = option
                break
        else:
            replaced[ch] = "(ignorée)"
    return re.sub(r"\s+", " ", "".join(out)).strip()


def coverage(words: list, vocab: set) -> float:
    total = known = 0
    for word in words:
        for ch in letters(word):
            total += 1
            if ch in vocab or any(option and all(p in vocab for p in option) for option in FALLBACKS.get(ch, [])):
                known += 1
    return known / total if total else 0.0


def pick_model(lang: str, texts: dict):
    """Premier modèle qui existe et connaît assez de lettres (en latin, ou en tifinagh pour un modèle tifinagh)."""
    from transformers import AutoTokenizer
    tried = []
    for model_id in MMS_CANDIDATES[lang]:
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_id)
        except Exception as exc:  # noqa: BLE001 - modèle absent : on essaie le suivant
            tried.append({"modele": model_id, "erreur": str(exc).splitlines()[0][:160]})
            continue
        vocab = set(tokenizer.get_vocab().keys())
        lat_cov = coverage([t["lat"] for t in texts.values()], vocab)
        tif_cov = coverage([t["tif"] for t in texts.values() if t["tif"]], vocab)
        tried.append({"modele": model_id, "latin": round(lat_cov, 3), "tifinagh": round(tif_cov, 3)})
        script = "lat" if lat_cov >= tif_cov else "tif"
        if max(lat_cov, tif_cov) >= MIN_COVERAGE:
            return model_id, tokenizer, vocab, script, tried
    raise RuntimeError(f"Aucun modèle utilisable pour {lang} : {json.dumps(tried, ensure_ascii=False)}")


def synthesize_with_mms(texts: dict, lang: str, work_dir: Path, report: dict) -> dict:
    try:
        from transformers import VitsModel
        import torch
        import scipy.io.wavfile as wavfile
    except ImportError as exc:
        raise RuntimeError("Outils manquants : pip install torch transformers scipy") from exc

    model_id, tokenizer, vocab, script, tried = pick_model(lang, texts)
    report.update({"modele": model_id, "ecriture_lue": "latin" if script == "lat" else "tifinagh", "modeles_essayes": tried,
                   "repli_tachelhit": lang not in model_id, "licence": "CC-BY-NC 4.0 (Meta MMS-TTS), usage non commercial"})
    print(f"Voix de synthèse : {model_id} (licence CC-BY-NC 4.0, usage non commercial), lecture en {report['ecriture_lue']}.")
    if report["repli_tachelhit"]:
        print("Attention : pas de modèle pour cette variété, l'accent tachelhit est utilisé.")
    romanize = None
    if getattr(tokenizer, "is_uroman", False):
        # Ce modèle a appris sur des lettres latines simples (outil uroman) : on lui donne la même chose.
        try:
            import uroman as ur
            romanize = ur.Uroman().romanize_string
            report["uroman"] = True
            print("Ce modèle lit des lettres latines simples : passage par uroman.")
        except ImportError:
            print("Attention : ce modèle attend uroman (pip install uroman) ; lettres adaptées à la main.")
    model = VitsModel.from_pretrained(model_id)
    torch.manual_seed(1234)  # même voix à chaque lancement
    generated = {}
    replaced = {}
    for card_id, entry in texts.items():
        source = entry[script] or entry["lat"]
        phrase = adapt_to_vocab(romanize(source) if romanize else source, vocab, replaced)
        inputs = tokenizer(phrase, return_tensors="pt")
        if inputs["input_ids"].shape[-1] == 0:
            print(f"  ignoré (lettres inconnues du modèle) : {card_id} « {source} »")
            continue
        with torch.no_grad():
            waveform = model(**inputs).waveform[0].cpu().numpy()
        wav_path = work_dir / f"{card_id}.wav"
        wavfile.write(str(wav_path), rate=model.config.sampling_rate, data=waveform)
        generated[card_id] = wav_path
        report.setdefault("mots", {})[card_id] = {"ecrit": source, "lu": phrase}
    report["lettres_remplacees"] = replaced
    return generated


def main() -> int:
    parser = argparse.ArgumentParser(description="Packs vocaux amazighs de Kalimati (outil ordinateur)")
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
        sample = [(k, v["lat"]) for k, v in list(texts.items())[:5]]
        print(json.dumps({"lang": args.lang, "count": len(texts), "exemples": sample}, ensure_ascii=False, indent=2))
        return 0

    if not shutil.which("ffmpeg"):
        print("Erreur : ffmpeg est nécessaire (couper les silences, encoder en MP3).", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    work_dir = out_dir / "_wav_tmp"
    work_dir.mkdir(parents=True, exist_ok=True)
    human_dir = Path(args.human_dir) if args.human_dir else None
    report = {"lang": args.lang, "humains": []}

    remaining = {}
    final_entries = {}
    for card_id, entry in texts.items():
        dst_mp3 = out_dir / f"{card_id}.mp3"
        human = None
        if human_dir:
            human = next((p for p in (human_dir / f"{card_id}.mp3", human_dir / f"{card_id}.wav") if p.exists()), None)
        if human:
            encode_mp3_24k(human, dst_mp3)
            final_entries[card_id] = entry["lat"]
            report["humains"].append(card_id)
        else:
            remaining[card_id] = entry

    if remaining and not args.no_tts:
        wavs = synthesize_with_mms(remaining, args.lang, work_dir, report)
        for card_id, wav_path in wavs.items():
            encode_mp3_24k(wav_path, out_dir / f"{card_id}.mp3")
            final_entries[card_id] = remaining[card_id]["lat"]

    shutil.rmtree(work_dir, ignore_errors=True)
    durations = {card_id: mp3_seconds(out_dir / f"{card_id}.mp3") for card_id in final_entries}
    for card_id, seconds in durations.items():
        report.setdefault("mots", {}).setdefault(card_id, {})["secondes"] = seconds
    total_bytes = sum((out_dir / f"{card_id}.mp3").stat().st_size for card_id in final_entries)
    index_path = out_dir.parent / f"amz-{args.lang}-index.json"
    index_data = {
        "lang": args.lang,
        "version": 1,
        "count": len(final_entries),
        "totalBytes": total_bytes,
        "source": report.get("modele", "enregistrements humains"),
        "licence": report.get("licence", ""),
        "entries": final_entries,
    }
    index_path.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = out_dir.parent / f"amz-{args.lang}-rapport.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pack {args.lang} prêt : {len(final_entries)} MP3 ({total_bytes / 1024:.1f} Ko) -> {index_path}")
    missing = sorted(set(texts) - set(final_entries))
    if missing:
        print(f"Sans voix : {len(missing)} cartes (ex. {', '.join(missing[:5])}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
