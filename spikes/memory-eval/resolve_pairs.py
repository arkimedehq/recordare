# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Near-duplicate resolver prompt on fixed dev pairs (8.11 step 4), through the gateway on :8790 (thinking off).

Usage: python resolve_pairs.py <episode-resolver.ts of the version to test> <pair> [runs]
Prints the count of (relation, keep) decisions."""
import json, re, sys, urllib.request, collections
def prompt(path):
    s = open(path).read()
    m = re.search(r"RESOLVE_SYSTEM = `(.*?)`;", s, re.S)
    return m.group(1).replace("\\\n", "")
PAIRS = {
 "dev": ("Il 2 dicembre 2026 ho inviato la domanda per il concorso da istruttore tecnico del Comune di Bologna e ho ricevuto il numero di protocollo 2026/0871-B (invio alle 15:40).",
         "Il 2 dicembre 2026 ho inviato la domanda per il concorso da istruttore tecnico del Comune di Bologna: 12 pagine con curriculum e lettera di motivazione, oggetto «Domanda di partecipazione – istruttore tecnico, cat. C»; ho detto che avrei passato il numero di protocollo appena arrivato."),
 "dupnew": ("Sabato 5 dicembre 2026 sono andato a vedere il Bologna allo stadio Dall'Ara con mio fratello Luca: 2-1 contro la Lazio, gol di Orsolini all'ultimo minuto.",
            "Sabato 5 dicembre 2026 sono andato allo stadio con Luca."),
 "corr": ("Visita dall'ortopedico martedì 3 novembre 2026, non lunedì come avevo detto.", "Visita dall'ortopedico lunedì 2 novembre 2026."),
 "plan": ("Il 10 dicembre 2026 ho fatto il tagliando della Golf da Autofficina Rizzi: 240 euro, tutto a posto.", "Il 2 dicembre 2026 ho prenotato il tagliando della Golf da Autofficina Rizzi per giovedì 10 dicembre 2026."),
 "days": ("Giovedì 3 dicembre 2026 sono andato a correre ai Giardini Margherita, 8 km.", "Martedì 1 dicembre 2026 sono andato a correre ai Giardini Margherita, 6 km."),
 "lang": ("On 4 December 2026 I had dinner with Giulia at Trattoria da Me.", "Il 4 dicembre 2026 ho cenato con Giulia alla Trattoria da Me, tortellini e una bottiglia di Pignoletto."),
 "dup": ("Il 2 dicembre 2026 ho inviato la domanda per il concorso del Comune di Bologna.",
         "Il 2 dicembre 2026 ho inviato la domanda per il concorso da istruttore tecnico del Comune di Bologna, 12 pagine con curriculum e lettera di motivazione."),
}
N = int(sys.argv[3]) if len(sys.argv) > 3 else 10
sysp = prompt(sys.argv[1]); pair = PAIRS[sys.argv[2]]
c = collections.Counter()
for i in range(N):
    body = {"model": "deepseek-flash", "temperature": 0, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": sysp}, {"role": "user", "content": f"PAIR 1\nNEW: {pair[0]}\nEXISTING: {pair[1]}"}]}
    req = urllib.request.Request("http://localhost:8790/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"]["content"]
    d = json.loads(out)["decisions"][0]
    c[(d["relation"], d.get("keep"))] += 1
print(sys.argv[2], dict(c))
