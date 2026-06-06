import numpy as np
import pandas as pd
import random
import warnings
import os

warnings.filterwarnings('ignore')

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# LOAD DATASET
df = pd.read_csv(os.path.join(BASE_DIR, 'data', 'Dataset Wisata Yogyakarta - lokasi_wisata.csv'))

def jam_str_to_float(s):
    s = str(s).strip()
    parts = s.split(':')
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    return h + m / 60

df['jam_buka']  = df['jam_buka'].apply(jam_str_to_float)
df['jam_tutup'] = df['jam_tutup'].apply(jam_str_to_float)
df['durasi_jam'] = df['durasi_menit'] / 60

def parse_latlon(s):
    try:
        lat, lon = str(s).replace('"','').split(',')
        return float(lat.strip()), float(lon.strip())
    except:
        return 0.0, 0.0

latlon = df['latitude_longitude'].apply(parse_latlon)
df['lat'] = latlon.apply(lambda x: x[0])
df['lon'] = latlon.apply(lambda x: x[1])

id_list   = df['id_lokasi'].tolist()
id_to_idx = {id_: i for i, id_ in enumerate(id_list)}
idx_to_id = {i: id_ for i, id_ in enumerate(id_list)}

KATEGORI_UTAMA = {
    'Belanja / Ikonik'    : 'Ikonik',
    'Ikonik'              : 'Ikonik',
    'Sejarah / Candi'     : 'Sejarah',
    'Sejarah / Budaya'    : 'Sejarah',
    'Sejarah / Spot Foto' : 'Sejarah',
    'Sejarah / Museum'    : 'Sejarah',
    'Pantai / Alam'       : 'Pantai',
    'Alam / Spot Foto'    : 'Alam',
    'Alam / Susur Goa'    : 'Alam',
    'Alam / Air Terjun'   : 'Alam',
    'Alam / Kuliner'      : 'Alam',
    'Alam / Taman'        : 'Alam',
    'Alam / Pegunungan'   : 'Alam',
    'Alam / Danau'        : 'Alam',
    'Kafe / Spot Foto'    : 'Kafe',
    'Kafe / Alam'         : 'Kafe',
    'Spot Foto / Hiburan' : 'Hiburan',
    'Spot Foto / Edukasi' : 'Hiburan',
    'Hiburan Malam'       : 'Hiburan',
    'Hiburan / Wahana'    : 'Hiburan',
    'Hiburan / Air'       : 'Hiburan',
    'Kebun Binatang'      : 'Hiburan',
}
df['kategori_utama'] = df['kategori'].map(KATEGORI_UTAMA).fillna('Lainnya')
N = len(df)

# LOAD MATRIKS JARAK
dm_raw = pd.read_csv(os.path.join(BASE_DIR, 'data', 'Dataset Wisata Yogyakarta - matriks_jarak.csv'))

def parse_jarak(val):
    try:
        return float(str(val).replace(',', '.'))
    except:
        return 0.0

dm_raw['jarak_km_float'] = dm_raw['jarak_km'].apply(parse_jarak)

dist_matrix         = np.zeros((N, N))
travel_time_matrix  = np.zeros((N, N))

for _, row in dm_raw.iterrows():
    asal   = row['id_lokasi_asal']
    tujuan = row['id_lokasi_tujuan']
    if asal in id_to_idx and tujuan in id_to_idx:
        i = id_to_idx[asal]
        j = id_to_idx[tujuan]
        dist_matrix[i][j]        = row['jarak_km_float']
        travel_time_matrix[i][j] = row['waktu_tempuh_menit'] / 60

# CONSTANTS
REWARD_VISIT    = 10.0
REWARD_DIVERSITY = 3.0
REWARD_URUTAN   = 4.0
PENALTY_SAME    = 15.0
PENALTY_SIMILAR = 8.0
SIMILAR_GROUPS = [{"Kafe", "Hiburan"}]
URUTAN_IDEAL = ["Sejarah", "Alam", "Pantai", "Ikonik", "Kafe", "Hiburan"]

def jam_ke_str(jam_float):
    jam_float = max(0.0, jam_float)
    h = int(jam_float)
    m = int(round((jam_float - h) * 60))
    if m == 60:
        h += 1; m = 0
    return f"{h:02d}:{m:02d}"

def get_lokasi(idx):
    row = df.iloc[idx]
    return {
        'idx'      : idx,
        'id_str'   : row['id_lokasi'],
        'nama'     : row['nama_lokasi'],
        'kategori' : row['kategori_utama'],
        'kat_detail': row['kategori'],
        'harga'    : int(row['harga_tiket']),
        'buka'     : float(row['jam_buka']),
        'tutup'    : float(row['jam_tutup']),
        'durasi'   : float(row['durasi_jam']),
        'lat'      : float(row['lat']),
        'lon'      : float(row['lon']),
    }

def decode_chromosome(chromosome, budget_maks=150000, jam_mulai=8.0, banned_locations=None):
    if banned_locations is None:
        banned_locations = set()
    else:
        banned_locations = set(banned_locations)

    rute_valid  = []
    total_biaya = 0
    total_jarak = 0.0
    waktu_skrg  = jam_mulai
    pos_skrg    = None
    jadwal      = []

    for loc_idx in chromosome:
        lokasi = get_lokasi(loc_idx)

        if lokasi['id_str'] in banned_locations:
            continue

        if pos_skrg is None:
            waktu_tiba = waktu_skrg
            jarak_ke   = 0.0
        else:
            jarak_ke   = dist_matrix[pos_skrg][loc_idx]
            waktu_tiba = waktu_skrg + travel_time_matrix[pos_skrg][loc_idx]

        if waktu_tiba < lokasi['buka']:
            waktu_tiba = lokasi['buka']

        waktu_selesai = waktu_tiba + lokasi['durasi']

        if lokasi['tutup'] < 23.9:
            if waktu_tiba >= lokasi['tutup']:
                continue
            if waktu_selesai > lokasi['tutup'] + 0.5:
                continue

        if total_biaya + lokasi['harga'] > budget_maks:
            break

        if waktu_selesai > 24.0:
            break

        total_biaya += lokasi['harga']
        total_jarak += jarak_ke
        waktu_skrg   = waktu_selesai
        pos_skrg     = loc_idx

        rute_valid.append(lokasi)
        jadwal.append({
            'nama'            : lokasi['nama'],
            'id_str'          : lokasi['id_str'],
            'kategori'        : lokasi['kategori'],
            'kat_detail'      : lokasi['kat_detail'],
            'jam_tiba'        : jam_ke_str(waktu_tiba),
            'jam_selesai'     : jam_ke_str(waktu_selesai),
            'harga'           : lokasi['harga'],
            'jarak_dari_prev' : round(jarak_ke, 2),
            'lat'             : lokasi['lat'],
            'lon'             : lokasi['lon'],
        })

    return rute_valid, total_biaya, round(total_jarak, 2), jadwal

def reward_urutan(rute):
    bonus = 0
    last_idx = -1
    for lok in rute:
        if lok['kategori'] in URUTAN_IDEAL:
            idx = URUTAN_IDEAL.index(lok['kategori'])
            if idx >= last_idx:
                bonus   += REWARD_URUTAN
                last_idx = idx
    return bonus

def hitung_fitness(chromosome, budget_maks, jam_mulai, banned_locations, liked_locations):
    rute, biaya, jarak, _ = decode_chromosome(chromosome, budget_maks, jam_mulai, banned_locations)

    if len(rute) == 0:
        return 0.001

    reward  = len(rute) * REWARD_VISIT
    reward += len(set(l['kategori'] for l in rute)) * REWARD_DIVERSITY
    reward += reward_urutan(rute)

    penalti = 0
    for i in range(len(rute) - 1):
        ka = rute[i]['kategori']
        kb = rute[i+1]['kategori']
        if ka == kb:
            penalti += PENALTY_SAME
        for grp in SIMILAR_GROUPS:
            if ka in grp and kb in grp and ka != kb:
                penalti += PENALTY_SIMILAR

    # Penalti raksasa jika ada lokasi favorit yang terlewat
    if liked_locations:
        rute_ids = set(loc['id_str'] for loc in rute)
        for liked_id in liked_locations:
            if liked_id not in rute_ids:
                penalti += 999999

    BOBOT_JARAK = 0.5
    penalti_jarak = jarak * BOBOT_JARAK

    return max(reward - penalti - penalti_jarak, 0.001)

def buat_individu():
    ind = list(range(N))
    random.shuffle(ind)
    return ind

def order_crossover(p1, p2):
    size  = len(p1)
    a, b  = sorted(random.sample(range(size), 2))
    c1 = [None] * size
    c2 = [None] * size
    c1[a:b+1] = p1[a:b+1]
    c2[a:b+1] = p2[a:b+1]

    def fill(child, other, a, b):
        used  = set(child[a:b+1])
        pos   = (b + 1) % size
        src   = (b + 1) % size
        count = 0
        total = size - (b - a + 1)
        while count < total:
            gene = other[src % size]
            if gene not in used:
                child[pos % size] = gene
                used.add(gene)
                pos = (pos + 1) % size
                count += 1
            src = (src + 1) % size
        return child

    return fill(c1, p2, a, b), fill(c2, p1, a, b)

def swap_mutation(kromosom, rate=0.15):
    k = kromosom[:]
    if random.random() < rate:
        i, j = random.sample(range(len(k)), 2)
        k[i], k[j] = k[j], k[i]
    return k

def rank_selection(populasi, fitness_scores):
    n = len(populasi)
    sorted_indices = sorted(range(n), key=lambda k: fitness_scores[k])
    total_rank = n * (n + 1) / 2
    pick = random.uniform(0, total_rank)
    kum = 0
    for rank_idx, original_idx in enumerate(sorted_indices):
        rank = rank_idx + 1
        kum += rank
        if kum >= pick:
            return populasi[original_idx]
    return populasi[sorted_indices[-1]]

def run_ga(budget_maks=150000, jam_mulai=8.0, banned_locations=None, liked_locations=None, pop_size=100, n_gen=300, cx_rate=0.85, mut_rate=0.15, elite_size=5):
    if banned_locations is None:
        banned_locations = []
    if liked_locations is None:
        liked_locations = []

    populasi = [buat_individu() for _ in range(pop_size)]
    best_overall = None
    best_fit_overall = -np.inf
    stagnasi = 0

    for gen in range(n_gen):
        fitness_scores = [hitung_fitness(ind, budget_maks, jam_mulai, banned_locations, liked_locations) for ind in populasi]
        
        best_idx = int(np.argmax(fitness_scores))
        if fitness_scores[best_idx] > best_fit_overall:
            best_fit_overall = fitness_scores[best_idx]
            best_overall     = populasi[best_idx][:]
            stagnasi         = 0
        else:
            stagnasi += 1

        if stagnasi >= 60:
            break

        sorted_idx = np.argsort(fitness_scores)[::-1]
        elites     = [populasi[i][:] for i in sorted_idx[:elite_size]]
        new_pop    = elites[:]

        while len(new_pop) < pop_size:
            p1 = rank_selection(populasi, fitness_scores)
            p2 = rank_selection(populasi, fitness_scores)

            if random.random() < cx_rate:
                c1, c2 = order_crossover(p1, p2)
            else:
                c1, c2 = p1[:], p2[:]

            new_pop.append(swap_mutation(c1, mut_rate))
            if len(new_pop) < pop_size:
                new_pop.append(swap_mutation(c2, mut_rate))

        populasi = new_pop

    rute, biaya, jarak, jadwal = decode_chromosome(best_overall, budget_maks, jam_mulai, banned_locations)
    return {
        "jadwal": jadwal,
        "total_biaya": biaya,
        "total_jarak": jarak,
        "fitness": best_fit_overall
    }
