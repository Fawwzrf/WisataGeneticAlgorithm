'use client';

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import dynamic from 'next/dynamic';
import RouteCard from './components/RouteCard';

const RouteMap = dynamic(() => import('./components/RouteMap'), { ssr: false });

const GA_STEPS = [
  "Menganalisis Permintaan...",
  "Inisialisasi Populasi Genetik...",
  "Evaluasi Fitness Rute...",
  "Seleksi (Rank Selection)...",
  "Crossover (Order Crossover)...",
  "Mutasi Genetik (Swap Mutation)...",
  "Memilih Rute Optimal..."
];

const FUN_FACTS = [
  "Tahukah kamu? Malioboro berasal dari bahasa Sansekerta yang berarti 'karangan bunga'.",
  "Candi Prambanan memiliki 240 candi kecil yang mengelilingi candi utama.",
  "Gudeg dulunya dimasak oleh prajurit Kerajaan Mataram di tengah hutan lho!",
  "Sumbu Filosofis Jogja menghubungkan Gunung Merapi, Tugu, Keraton, hingga Pantai Selatan.",
  "Taman Sari dulunya adalah tempat rekreasi dan pesanggrahan bagi Sultan dan keluarganya.",
  "Jogja adalah satu-satunya provinsi di Indonesia yang pemerintahannya berbentuk Kesultanan.",
  "Candi Borobudur dibangun pada abad ke-8 dan merupakan candi Buddha terbesar di dunia.",
  "Pantai Parangtritis terkenal dengan legenda Ratu Kidul dan gumuk pasirnya yang unik."
];

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Home() {
  const [budget, setBudget] = useState(150000);
  const [jamMulai, setJamMulai] = useState(8.0);
  
  // State resmi yang sudah diapply ke backend
  const [appliedBanned, setAppliedBanned] = useState([]);
  const [appliedLiked, setAppliedLiked] = useState([]);
  
  // State pending (sementara) yang dipilih user di UI
  const [pendingBanned, setPendingBanned] = useState([]);
  const [pendingLiked, setPendingLiked] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [genCount, setGenCount] = useState(1);
  const [routeData, setRouteData] = useState(null);
  const [error, setError] = useState(null);
  const [activeLocationId, setActiveLocationId] = useState(null);
  const [funFactIndex, setFunFactIndex] = useState(0);

  // Cek apakah ada perubahan yang belum di-apply
  const hasPendingChanges = 
    JSON.stringify([...appliedBanned].sort()) !== JSON.stringify([...pendingBanned].sort()) ||
    JSON.stringify([...appliedLiked].sort()) !== JSON.stringify([...pendingLiked].sort());

  useEffect(() => {
    let stepInterval;
    let genInterval;
    let factInterval;
    if (loading) {
      setLoadingStep(0);
      setGenCount(1);
      setFunFactIndex(Math.floor(Math.random() * FUN_FACTS.length));
      
      stepInterval = setInterval(() => {
        setLoadingStep(prev => (prev < GA_STEPS.length - 1 ? prev + 1 : prev));
      }, 1500);
      genInterval = setInterval(() => {
        setGenCount(prev => (prev < 300 ? prev + Math.floor(Math.random() * 8) + 2 : 300));
      }, 100);
      factInterval = setInterval(() => {
        setFunFactIndex(prev => (prev + 1) % FUN_FACTS.length);
      }, 4000);
    }
    return () => {
      clearInterval(stepInterval);
      clearInterval(genInterval);
      clearInterval(factInterval);
    };
  }, [loading]);

  const fetchRoute = async (bannedList, likedList) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/generate_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget_maks: parseInt(budget),
          jam_mulai: parseFloat(jamMulai),
          banned_locations: bannedList,
          liked_locations: likedList
        })
      });
      if (!res.ok) throw new Error('Failed to fetch route');
      const data = await res.json();
      setRouteData(data);
      
      // Sinkronisasi state setelah berhasil
      setAppliedBanned([...bannedList]);
      setAppliedLiked([...likedList]);
      setPendingBanned([...bannedList]);
      setPendingLiked([...likedList]);
      
    } catch (err) {
      setError('Gagal memuat rute. Pastikan Backend FastAPI menyala.');
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleGenerateInitial = (e) => {
    if(e) e.preventDefault();
    fetchRoute([], []);
  };

  const handleApplyChanges = () => {
    fetchRoute(pendingBanned, pendingLiked);
  };

  const toggleBanLocation = (id_str) => {
    let newBanned;
    if (pendingBanned.includes(id_str)) {
      newBanned = pendingBanned.filter(id => id !== id_str); // Batal hapus
    } else {
      newBanned = [...pendingBanned, id_str]; // Tambah ke hapus
    }
    setPendingBanned(newBanned);
    
    // Jika di-ban, lepaskan dari liked
    if (pendingLiked.includes(id_str)) {
      setPendingLiked(pendingLiked.filter(id => id !== id_str));
    }
  };

  const toggleLikeLocation = (id_str) => {
    let newLiked;
    if (pendingLiked.includes(id_str)) {
      newLiked = pendingLiked.filter(id => id !== id_str); // Batal suka
    } else {
      newLiked = [...pendingLiked, id_str]; // Tambah ke suka
    }
    setPendingLiked(newLiked);
    
    // Jika di-like, lepaskan dari ban
    if (pendingBanned.includes(id_str)) {
      setPendingBanned(pendingBanned.filter(id => id !== id_str));
    }
  };

  const getCategoryColorMap = () => {
    if(!routeData) return {};
    const categories = [...new Set(routeData.jadwal.map(loc => loc.kategori))];
    const colorMap = {};
    categories.forEach((cat, index) => {
      colorMap[cat] = COLORS[index % COLORS.length];
    });
    return colorMap;
  };
  const categoryColorMap = getCategoryColorMap();

  const getCategoryData = () => {
    if(!routeData) return [];
    const counts = {};
    routeData.jadwal.forEach(loc => {
      counts[loc.kategori] = (counts[loc.kategori] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  };

  const getCostData = () => {
    if(!routeData) return [];
    return routeData.jadwal.map(loc => ({
      name: loc.nama.substring(0,10) + '...',
      biaya: loc.harga
    }));
  };

  return (
    <main className="container">
      <header>
        <h1>WisataGA Jogja</h1>
        <p className="subtitle" style={{fontSize: '0.9rem', margin: 0}}>Eksplorasi Kota Pelajar dengan Rekomendasi Rute Cerdas AI</p>
      </header>

      <div className="content-wrapper dashboard-grid">
        <div className="dashboard-sidebar">
          <section className="glass-panel" style={{ padding: '1rem' }}>
            <form onSubmit={handleGenerateInitial}>
              <div className="form-group" style={{marginBottom: '0.75rem'}}>
                <label>Budget Maksimal (Rp)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={budget} 
                  onChange={e => setBudget(e.target.value)}
                  min="0"
                  step="10000"
                  style={{padding: '0.5rem'}}
                />
              </div>
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label>Jam Mulai</label>
                <select 
                  className="input-field" 
                  value={jamMulai} 
                  onChange={e => setJamMulai(e.target.value)}
                  style={{padding: '0.5rem'}}
                >
                  <option value="6.0">06:00</option>
                  <option value="7.0">07:00</option>
                  <option value="8.0">08:00</option>
                  <option value="9.0">09:00</option>
                  <option value="10.0">10:00</option>
                </select>
              </div>
              <button type="submit" className="btn" disabled={loading} style={{padding: '0.5rem'}}>
                Buat Rute Baru
              </button>
            </form>
          </section>

          {error && (
            <div style={{color: 'var(--danger)', marginTop: '1rem', textAlign: 'center', fontWeight: 'bold'}}>
              {error}
            </div>
          )}

          {routeData && hasPendingChanges && (
             <div className="glass-panel" style={{ marginTop: '1rem', borderColor: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)', padding: '1rem' }}>
               <h3 style={{color: 'var(--accent)', marginBottom: '0.5rem', fontSize: '1rem'}}>Ada Perubahan Rute</h3>
               <p style={{marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem'}}>Terapkan perubahan untuk men-generate rute baru.</p>
               <button className="btn" style={{fontSize: '0.9rem', padding: '0.5rem'}} onClick={handleApplyChanges}>
                 Terapkan & Generate Ulang
               </button>
             </div>
          )}

          {routeData && (
            <div className="timeline" style={{marginTop: '1rem', gap: '1rem', opacity: loading ? 0.3 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'all 0.3s'}}>
              {routeData.jadwal.map((loc, index) => {
                const isPendingBan = pendingBanned.includes(loc.id_str);
                const isPendingLike = pendingLiked.includes(loc.id_str);
                
                return (
                  <RouteCard 
                    key={`${loc.id_str}-${index}`} 
                    location={loc} 
                    onRemove={toggleBanLocation}
                    onLike={toggleLikeLocation}
                    isBanned={isPendingBan}
                    isLiked={isPendingLike}
                    categoryColor={categoryColorMap[loc.kategori]}
                    isActive={activeLocationId === loc.id_str}
                    onMouseEnter={() => setActiveLocationId(loc.id_str)}
                    onMouseLeave={() => setActiveLocationId(null)}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="dashboard-main animate-fade-in" style={{ position: 'relative' }}>
          
          {loading && (
            <div className="loading-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', width: '80%', maxWidth: '400px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 1.5rem auto' }}>
                  <svg className="animate-spin" viewBox="0 0 100 100" style={{ width: '100%', height: '100%', color: 'var(--accent)', animation: 'spin 1.5s linear infinite' }}>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="200" strokeDashoffset="50" strokeLinecap="round" opacity="0.8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {Math.round((Math.min(genCount, 300) / 300) * 100)}%
                  </div>
                </div>
                
                <h3 className="loading-step" style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                  {GA_STEPS[loadingStep]}
                </h3>
                
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', margin: '1.5rem 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(Math.min(genCount, 300) / 300) * 100}%`, background: 'var(--accent)', transition: 'width 0.2s ease-out' }}></div>
                </div>

                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '1.5rem', minHeight: '80px', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <span style={{ fontStyle: 'italic', lineHeight: '1.4' }}>💡 "{FUN_FACTS[funFactIndex]}"</span>
                </div>
              </div>
            </div>
          )}

          {routeData ? (
            <div className="summary-stats" style={{gap: '0.75rem', opacity: loading ? 0.3 : 1, transition: 'all 0.3s'}}>
              <div className="stat-box" style={{padding: '1rem'}}>
                <div className="stat-value" style={{fontSize: '1.25rem'}}>{routeData.jadwal.length}</div>
                <div className="stat-label">Destinasi</div>
              </div>
              <div className="stat-box" style={{padding: '1rem'}}>
                <div className="stat-value" style={{fontSize: '1.25rem'}}>Rp {routeData.total_biaya.toLocaleString('id-ID')}</div>
                <div className="stat-label">Total Biaya</div>
              </div>
              <div className="stat-box" style={{padding: '1rem'}}>
                <div className="stat-value" style={{fontSize: '1.25rem'}}>{routeData.total_jarak} km</div>
                <div className="stat-label">Jarak Tempuh</div>
              </div>
              <div className="stat-box" style={{padding: '1rem'}}>
                <div className="stat-value" style={{fontSize: '1.25rem'}}>{(routeData.fitness / 1000).toFixed(1)}k</div>
                <div className="stat-label">Skor Fitness</div>
              </div>
            </div>
          ) : (
            <div className="summary-stats" style={{gap: '0.75rem'}}>
              <div className="stat-box" style={{padding: '1rem'}}><div className="stat-value" style={{fontSize: '1.25rem'}}>-</div><div className="stat-label">Destinasi</div></div>
              <div className="stat-box" style={{padding: '1rem'}}><div className="stat-value" style={{fontSize: '1.25rem'}}>-</div><div className="stat-label">Total Biaya</div></div>
              <div className="stat-box" style={{padding: '1rem'}}><div className="stat-value" style={{fontSize: '1.25rem'}}>-</div><div className="stat-label">Jarak Tempuh</div></div>
              <div className="stat-box" style={{padding: '1rem'}}><div className="stat-value" style={{fontSize: '1.25rem'}}>-</div><div className="stat-label">Skor Fitness</div></div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px', opacity: loading ? 0.3 : 1, transition: 'all 0.3s' }}>
            <h3 style={{marginBottom: '0.5rem', color: 'var(--text-main)', textAlign: 'center', fontSize: '1rem'}}>Peta Rute Perjalanan</h3>
            <div style={{ flex: 1, position: 'relative' }}>
              {routeData ? (
                <RouteMap route={routeData.jadwal} categoryColorMap={categoryColorMap} activeLocationId={activeLocationId} />
              ) : (
                <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px'}}>
                  Silakan buat rute baru untuk melihat peta.
                </div>
              )}
            </div>
          </div>

          {routeData && (
            <div className="glass-panel charts-container" style={{ padding: '1rem', gap: '1rem', opacity: loading ? 0.3 : 1, transition: 'all 0.3s' }}>
              <div style={{height: '180px'}}>
                <h3 style={{textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Distribusi Kategori</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={getCategoryData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label>
                      {getCategoryData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={categoryColorMap[entry.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{height: '180px'}}>
                <h3 style={{textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Biaya per Destinasi</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getCostData()} margin={{top: 10, right: 10, left: 10, bottom: 20}}>
                    <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} fontSize={9} />
                    <YAxis fontSize={9} width={40} />
                    <RechartsTooltip formatter={(val) => `Rp ${val.toLocaleString('id-ID')}`} />
                    <Bar dataKey="biaya" fill="var(--accent)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
