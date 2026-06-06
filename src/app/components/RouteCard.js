'use client';

import React from 'react';

export default function RouteCard({ location, onRemove, onLike, isLiked, isBanned, categoryColor, isActive, onMouseEnter, onMouseLeave }) {
  let cardClass = "route-card animate-fade-in";
  if (isLiked) cardClass += " liked";
  if (isBanned) cardClass += " banned";
  if (isActive) cardClass += " active-card";

  const catStyle = categoryColor ? {
    backgroundColor: `${categoryColor}20`,
    color: categoryColor,
    borderColor: categoryColor,
    border: '1px solid'
  } : {};


  return (
    <div className={cardClass} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="route-time">
        {location.jam_tiba} - {location.jam_selesai}
      </div>
      <div className="route-details">
        <h3 className="route-name" style={{ textDecoration: isBanned ? 'line-through' : 'none' }}>
          {location.nama}
        </h3>
        <span className="route-cat" style={catStyle}>{location.kategori} - {location.kat_detail}</span>
        
        <div className="route-meta">
          <span>Biaya: Rp {location.harga.toLocaleString('id-ID')}</span>
          <span>Jarak: {location.jarak_dari_prev} km</span>
        </div>
      </div>
      <div className="route-actions">
        <button 
          className={`btn-action btn-like ${isLiked ? 'active' : ''}`} 
          onClick={() => onLike(location.id_str)}
          title="Kunci destinasi ini di rute selanjutnya"
        >
          {isLiked ? '♥ Disukai' : '♡ Suka'}
        </button>
        <button 
          className={`btn-action btn-danger ${isBanned ? 'active' : ''}`} 
          onClick={() => onRemove(location.id_str)}
          title="Hapus lokasi ini dari rute"
        >
          {isBanned ? 'Batal Hapus' : '✕ Hapus'}
        </button>
      </div>
    </div>
  );
}
