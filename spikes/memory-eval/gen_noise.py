# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Generate deterministic "noise" sessions (dataset/noise.json) to stress retrieval.

Constraints: noise must NOT change any expected answer in questions.json (24 questions):
- no new first-person events relevant to the 18 questions (no skiing, trips, car changes,
  dentist visits, runs, dinners by the user);
- nothing personal and "nice" during 2026-02-16..21 (q17);
- lexical traps are allowed and wanted (a colleague skiing, AS Roma, coffee machine,
  snow forecasts, world records, a documentary on Japan, a future dentist visit for Giulia).
"""
import json
import random
from datetime import datetime, timedelta, timezone

from evalkit.common import DATASET

rng = random.Random(42)
TZ = timezone(timedelta(hours=1))

TECH = [
    ("Come rinomino più file in bash con un pattern?", "Puoi usare un ciclo for con mv, oppure il comando rename con un'espressione regolare."),
    ("Differenza tra let e const in JavaScript?", "const non può essere riassegnata, let sì; entrambe hanno scope di blocco."),
    ("Come faccio un JOIN tra due tabelle in PostgreSQL?", "SELECT ... FROM a JOIN b ON a.id = b.a_id; usa LEFT JOIN se vuoi tenere le righe senza corrispondenza."),
    ("Mi spieghi cos'è un indice GIN?", "È un indice invertito adatto a array, jsonb e full-text search."),
    ("Come aggiorno Node con nvm?", "nvm install --lts e poi nvm alias default lts/*."),
    ("Perché il mio container Docker non vede la rete?", "Controlla che sia sulla stessa rete con docker network inspect e che il servizio esponga la porta giusta."),
    ("Cos'è il CAP theorem?", "In presenza di partizioni di rete devi scegliere tra consistenza e disponibilità."),
    ("Come genero una chiave SSH?", "ssh-keygen -t ed25519 -C \"email\" e poi aggiungi la chiave pubblica al server."),
    ("Spiegami async/await in Python.", "async definisce una coroutine, await sospende finché il risultato non è pronto, senza bloccare l'event loop."),
    ("Come faccio il backup di un database MySQL?", "mysqldump -u utente -p nome_db > backup.sql, oppure usa uno snapshot del volume."),
    ("Che differenza c'è tra RAID 1 e RAID 5?", "RAID 1 duplica i dati su due dischi; RAID 5 distribuisce dati e parità su almeno tre dischi."),
    ("Come imposto un cron ogni lunedì alle 8?", "0 8 * * 1 comando"),
    ("Cos'è una race condition?", "Un comportamento che dipende dall'ordine non deterministico di operazioni concorrenti."),
    ("Mi consigli un formato per i log?", "JSON strutturato con timestamp ISO, livello, messaggio e contesto."),
    ("Come funziona OAuth2 in breve?", "Il client ottiene un token da un authorization server e lo usa per accedere alle risorse per conto dell'utente."),
]

DAILY = [
    ("Mi dai una ricetta veloce per la carbonara?", "Guanciale, uova, pecorino, pepe e spaghetti: niente panna."),
    ("Quanto tempo cuocio un uovo sodo?", "Circa 9 minuti da quando l'acqua bolle."),
    ("Che tempo farà domani a Milano? Dicono che potrebbe nevicare.", "Non ho accesso alle previsioni in tempo reale, ma controlla il sito dell'Aeronautica Militare."),
    ("La macchina del caffè fa un rumore strano, cosa può essere?", "Spesso è calcare: prova un ciclo di decalcificazione."),
    ("Hai visto la partita della Roma ieri sera?", "Non seguo le partite in diretta, ma posso aiutarti a trovare il risultato."),
    ("Qual è il record del mondo dei 100 metri?", "9,58 secondi, Usain Bolt, Berlino 2009."),
    ("Ho visto un documentario sul Giappone, che cos'è il wabi-sabi?", "È l'estetica giapponese della bellezza imperfetta e transitoria."),
    ("Consigliami un libro giallo.", "Prova 'Il nome della rosa' di Umberto Eco."),
    ("Come tolgo una macchia di vino dalla tovaglia?", "Sale grosso subito, poi lavaggio con acqua fredda."),
    ("Qual è la capitale dell'Australia?", "Canberra."),
    ("Mi ricordi la differenza tra affetto ed effetto?", "Affetto è un sentimento, effetto è una conseguenza."),
    ("Che film mi consigli per stasera?", "Se ti piacciono i classici, 'Nuovo Cinema Paradiso'."),
    ("Quante calorie ha una mela?", "Circa 50-80 kcal a seconda della dimensione."),
    ("Come si scrive una mail formale di reclamo?", "Oggetto chiaro, fatti in ordine cronologico, richiesta precisa, tono cortese."),
    ("Mi traduci 'see you later' in italiano?", "A dopo / ci vediamo più tardi."),
]

THIRD_PARTY = [
    ("Il mio collega Paolo è andato a sciare a Bormio, dice che c'era tanta neve.", "Bormio con neve fresca è bellissima!"),
    ("Mia sorella si è trasferita a Torino per lavoro.", "Torino è una città molto vivibile, spero si trovi bene."),
    ("Il vicino ha comprato un'auto nuova, una Panda ibrida.", "La Panda ibrida è pratica per la città."),
    ("Un amico mi ha detto che a Roma c'è una mostra su Caravaggio.", "Le mostre su Caravaggio sono sempre molto visitate."),
    ("Devo prenotare il dentista per Giulia a maggio, solo un controllo.", "Ti conviene chiamare con anticipo, a maggio le agende si riempiono."),
    ("Marco dice che vuole cambiare lavoro.", "Se vuoi, posso aiutarlo a preparare il curriculum."),
    ("Sara ha iniziato un corso di yoga il martedì.", "Lo yoga è ottimo per la schiena e lo stress."),
]

POOLS = [(TECH, 0.45), (DAILY, 0.40), (THIRD_PARTY, 0.15)]
START = datetime(2026, 1, 2, 9, 0, tzinfo=TZ)
DAYS = 88  # until end of March
Q17_WEEK = (datetime(2026, 2, 16, tzinfo=TZ), datetime(2026, 2, 22, tzinfo=TZ))


def pick_pool() -> list:
    r, acc = rng.random(), 0.0
    for pool, weight in POOLS:
        acc += weight
        if r <= acc:
            return pool
    return POOLS[-1][0]


sessions = []
for i in range(150):
    ts = START + timedelta(days=rng.randrange(DAYS), hours=rng.randrange(13), minutes=rng.randrange(60))
    pool = pick_pool()
    if pool is THIRD_PARTY and Q17_WEEK[0] <= ts < Q17_WEEK[1]:
        pool = TECH  # keep the q17 week free of personal news
    turns = rng.sample(pool, k=rng.choice([1, 1, 2]))
    messages = []
    for q, a in turns:
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    sessions.append({"id": f"n{i:03d}", "user": "luca", "ts": ts.isoformat(), "messages": messages})

for i in range(20):  # other user's noise: isolation stress
    ts = START + timedelta(days=rng.randrange(DAYS), hours=rng.randrange(13))
    q, a = rng.choice(DAILY + [("Sono andata di nuovo a sciare a Cervinia, che giornata!", "Che bello!")])
    sessions.append({"id": f"en{i:02d}", "user": "elena", "ts": ts.isoformat(),
                     "messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]})

sessions.sort(key=lambda s: s["ts"])
out = {"_note": "Deterministic noise (seed 42) generated by gen_noise.py; must not alter expected answers.",
       "sessions": sessions}
(DATASET / "noise.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"wrote {len(sessions)} noise sessions")
