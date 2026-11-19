#!/usr/bin/env python3
"""
Packs vocaux amazighs pour Kalimati (v10.7.1) : outil à lancer sur un ordinateur, jamais dans le téléphone.
Fabrique un MP3 par carte (mono 24 kHz, silences coupés, volume égalisé) pour une variété : shi (tachelhit),
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
v10.7.1 : voix un peu plus lente (plus claire pour l'enfant). Un mot sans voyelle se dit avec le « e » muet
devant (D -> ed, Fk -> efk). Un son trop court ou trop faible est refait (autre essai, plus lent) ; s'il reste
douteux, il est noté dans le rapport (« a_ecouter_d_abord »). Un souffle ou un bruit (pas de vraie voix) n'est
jamais gardé : la carte reste sans son et attend la voix du parent (« sans_son_bruit »). MP3 fabriqués avec lameenc (pip install lameenc),
sinon ffmpeg. ffmpeg reste nécessaire pour les enregistrements humains (--human-dir).

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
import tempfile
import unicodedata
from math import gcd
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
    "ṣ": ["ṣ", "s"], "ḥ": ["ḥ", "h"], "ɛ": ["ɛ", "ε", "ʕ", "ʿ", "3", ""],
    "š": ["š", "ch", "sh", "c"], "ʷ": ["ʷ", "w", ""], "č": ["č", "ch", "tš", "tsh", "c"], "x": ["x", "kh"], "q": ["q", "k"], "e": ["e", "ə", ""],
    "o": ["o", "u"], "c": ["c", "ch", "sh"], "j": ["j", "dj", "ž"], "y": ["y", "i"], "w": ["w", "u"],
}
MIN_COVERAGE = 0.9  # part des lettres que le modèle doit connaître pour être choisi
TARGET_RATE = 24000  # comme les voix darija et françaises de l'appli
MP3_KBPS = 32
BASE_SPEAKING_RATE = 0.85  # un peu plus lent que la voix d'origine : plus clair pour l'enfant
# Son trop court ou trop faible (mots très courts) : nouvel essai (graine, vitesse).
ATTEMPTS = [(1234, BASE_SPEAKING_RATE), (1234, 0.7), (7, 0.7), (42, 0.6), (99, 0.75), (2024, 0.6)]
MIN_PEAK_DB = -30.0  # en dessous, le modèle a presque rien dit
MIN_VOICED = 0.2  # part des moments avec une vraie voix (hauteur nette) ; en dessous : souffle ou bruit, pas un mot
VOWELS = set("aeiouə")


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
    previous = None
    for ch in unicodedata.normalize("NFC", text.lower()):
        if ch in vocab or not (ch.isalpha() or ch == "ʷ"):
            out.append(" " if ch in "-’'" else ch)
            previous = None
            continue
        for option in FALLBACKS.get(ch, []):
            if option == "" or all(part in vocab for part in option):
                # Lettre doublée remplacée par plusieurs lettres (čč -> tš) : dite une seule fois.
                if not (previous == ch and len(option) > 1):
                    out.append(option)
                if option != ch:
                    replaced[ch] = option
                break
        else:
            replaced[ch] = "(ignorée)"
        previous = ch
    return re.sub(r"\s+", " ", "".join(out)).strip()


def speakable(word: str) -> str:
    """Mot sans voyelle : on le dit avec le « e » muet (schwa) devant, comme quand on le dit seul (D -> ed, Fk -> efk)."""
    low = unicodedata.normalize("NFC", word).lower()
    if any(ch in VOWELS for ch in low) or not any(ch.isalpha() for ch in low):
        return word
    return "e" + low


def clean_wave(wave, rate):
    """Coupe les silences (seuil relatif au pic du mot) et égalise le volume.
    Renvoie (onde, secondes parlées, pic d'origine en dB) ; onde = None si le modèle n'a rien dit."""
    import numpy as np
    w = np.asarray(wave, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(w))) if w.size else 0.0
    if peak < 1e-4:
        return None, 0.0, -100.0
    peak_db = round(float(20 * np.log10(peak)), 1)
    win = max(1, int(rate * 0.01))
    energy = np.sqrt(np.convolve(w * w, np.ones(win, dtype=np.float32) / win, mode="same"))
    active = np.flatnonzero(energy > peak * 10 ** (-40 / 20))
    if active.size == 0:
        return None, 0.0, peak_db
    seconds = round((int(active[-1]) - int(active[0])) / rate, 2)
    w = w[max(0, int(active[0]) - int(rate * 0.04)):min(w.size, int(active[-1]) + int(rate * 0.08))]
    rms = float(np.sqrt(np.mean(w * w))) + 1e-9
    w = w * min(10 ** (-21 / 20) / rms, 10 ** (-1 / 20) / float(np.max(np.abs(w))))  # moyenne -21 dB, pic -1 dB au plus
    silence = lambda s: np.zeros(int(rate * s), dtype=np.float32)  # noqa: E731
    return np.concatenate([silence(0.05), w, silence(0.08)]), seconds, peak_db


def voiced_ratio(wave, rate) -> float:
    """Part des moments où l'on entend une vraie voix (hauteur nette). Un souffle ou un bruit donne presque 0."""
    import numpy as np
    w = np.asarray(wave, dtype=np.float32).reshape(-1)
    frame, hop = int(0.03 * rate), int(0.01 * rate)
    lo, hi = int(rate / 400), int(rate / 75)
    peak = float(np.max(np.abs(w))) + 1e-9 if w.size else 1e-9
    active = voiced = 0
    for i in range(0, max(0, w.size - frame), hop):
        f = w[i:i + frame] - float(np.mean(w[i:i + frame]))
        if float(np.sqrt(np.mean(f * f))) < peak * 0.05:
            continue
        active += 1
        ac = np.correlate(f, f, "full")[frame - 1:]
        voiced += float(np.max(ac[lo:hi])) / (float(ac[0]) + 1e-9) > 0.5
    return round(voiced / active, 2) if active else 0.0


def encode_wave_mp3(wave, rate, dst_mp3: Path) -> None:
    """Onde nettoyée -> MP3 mono 24 kHz (lameenc, sinon ffmpeg)."""
    import numpy as np
    if rate != TARGET_RATE:
        from scipy.signal import resample_poly
        g = gcd(TARGET_RATE, rate)
        wave = resample_poly(wave, TARGET_RATE // g, rate // g)
    pcm = (np.clip(wave, -1.0, 1.0) * 32767).astype("<i2")
    dst_mp3.parent.mkdir(parents=True, exist_ok=True)
    try:
        import lameenc
    except ImportError:
        lameenc = None
    if lameenc is not None:
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(MP3_KBPS)
        encoder.set_in_sample_rate(TARGET_RATE)
        if hasattr(encoder, "set_out_sample_rate"):
            encoder.set_out_sample_rate(TARGET_RATE)
        encoder.set_channels(1)
        encoder.set_quality(2)
        dst_mp3.write_bytes(bytes(encoder.encode(pcm.tobytes())) + bytes(encoder.flush()))
        return
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Il faut lameenc (pip install lameenc) ou ffmpeg pour fabriquer les MP3.")
    import scipy.io.wavfile as wavfile
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / "mot.wav"
        wavfile.write(str(wav_path), TARGET_RATE, pcm)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-ac", "1", "-ar", str(TARGET_RATE),
                        "-b:a", f"{MP3_KBPS}k", str(dst_mp3)], check=True)


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


def synthesize_with_mms(texts: dict, lang: str, out_dir: Path, report: dict) -> dict:
    """Fabrique les MP3 de synthèse dans out_dir. Renvoie {id de carte: secondes parlées}."""
    try:
        from transformers import VitsModel
        import torch
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError as exc:
        raise RuntimeError("Outils manquants : pip install torch transformers scipy lameenc") from exc

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
    rate = model.config.sampling_rate
    report["vitesse"] = BASE_SPEAKING_RATE
    generated = {}
    replaced = {}
    to_listen = []
    for card_id, entry in texts.items():
        source = entry[script] or entry["lat"]
        said = speakable(source) if script == "lat" else source
        phrase = adapt_to_vocab(romanize(said) if romanize else said, vocab, replaced)
        inputs = tokenizer(phrase, return_tensors="pt")
        if inputs["input_ids"].shape[-1] == 0:
            print(f"  ignoré (lettres inconnues du modèle) : {card_id} « {source} »")
            continue
        need = max(0.2, 0.05 * len(letters(phrase)))
        best = None
        tries = 0
        for seed, speed in ATTEMPTS:  # même voix à chaque lancement (graines fixes)
            tries += 1
            torch.manual_seed(seed)
            model.speaking_rate = speed
            with torch.no_grad():
                raw = model(**inputs).waveform[0].cpu().numpy()
            wave, seconds, peak_db = clean_wave(raw, rate)
            voiced = voiced_ratio(wave, rate) if wave is not None else 0.0
            good = wave is not None and seconds >= need and peak_db >= MIN_PEAK_DB and voiced >= MIN_VOICED
            score = seconds * 10 ** (peak_db / 20) * voiced if wave is not None else 0.0
            if best is None or good or score > best["score"]:
                best = {"wave": wave, "seconds": seconds, "peak": peak_db, "speed": speed, "score": score, "good": good,
                        "voiced": voiced}
            if good:
                break
        # Souffle ou bruit au lieu d'un mot : pas de son (la carte attend la voix du parent).
        if best["wave"] is None or best["voiced"] < MIN_VOICED:
            print(f"  pas de vraie voix (souffle ou bruit), carte sans son : {card_id} « {source} »")
            report.setdefault("sans_son_bruit", []).append(card_id)
            continue
        encode_wave_mp3(best["wave"], rate, out_dir / f"{card_id}.mp3")
        generated[card_id] = best["seconds"]
        report.setdefault("mots", {})[card_id] = {"ecrit": source, "lu": phrase, "secondes": best["seconds"],
                                                  "pic_db": best["peak"], "voix": best["voiced"], "vitesse": best["speed"],
                                                  "essais": tries}
        if not best["good"]:
            to_listen.append(card_id)
            print(f"  à écouter d'abord : {card_id} « {source} » ({best['seconds']} s, pic {best['peak']} dB)")
    report["lettres_remplacees"] = replaced
    report["a_ecouter_d_abord"] = to_listen
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

    if args.human_dir and not shutil.which("ffmpeg"):
        print("Erreur : ffmpeg est nécessaire pour les enregistrements humains (couper les silences, encoder en MP3).", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
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
        made = synthesize_with_mms(remaining, args.lang, out_dir, report)
        for card_id in made:
            final_entries[card_id] = remaining[card_id]["lat"]

    for card_id in report["humains"]:
        report.setdefault("mots", {}).setdefault(card_id, {})["secondes"] = mp3_seconds(out_dir / f"{card_id}.mp3")
    total_bytes = sum((out_dir / f"{card_id}.mp3").stat().st_size for card_id in final_entries)
    index_path = out_dir.parent / f"amz-{args.lang}-index.json"
    index_data = {
        "lang": args.lang,
        "version": 1,
        "count": len(final_entries),
        "totalBytes": total_bytes,
        "source": report.get("modele", "enregistrements humains"),
        "trial": bool(report.get("modele")),  # voix de synthèse d'essai : à faire écouter par un natif
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
