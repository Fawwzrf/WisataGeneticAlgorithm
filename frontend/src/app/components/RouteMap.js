'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import L from 'leaflet';

// Komponen untuk otomatis memfokuskan peta ke rute
// Komponen pengontrol interaksi peta
function MapController({ activeLocationId, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (activeLocationId && markerRefs.current[activeLocationId]) {
      const marker = markerRefs.current[activeLocationId];
      if (!marker.isPopupOpen()) {
        marker.openPopup();
      }
      map.flyTo(marker.getLatLng(), 15, { duration: 0.5 });
    }
  }, [activeLocationId, map, markerRefs]);
  return null;
}

function MapBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      const bounds = route.map(loc => [loc.lat, loc.lon]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [route, map]);
  return null;
}

export default function RouteMap({ route, categoryColorMap = {}, activeLocationId }) {
  const [osrmPath, setOsrmPath] = useState(null);
  const markerRefs = useRef({});

  if (!route || route.length === 0) return null;

  // Pastikan hanya merender posisi yang valid
  const positions = route
    .map(loc => [loc.lat, loc.lon])
    .filter(pos => pos[0] !== undefined && pos[1] !== undefined && pos[0] !== 0);

  useEffect(() => {
    if (positions.length < 2) {
      setOsrmPath(positions);
      return;
    }
    
    let isMounted = true;
    const fetchOsrmRoute = async () => {
      try {
        const coordsStr = positions.map(p => `${p[1]},${p[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0) {
          const decoded = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          if (isMounted) setOsrmPath(decoded);
        } else {
          if (isMounted) setOsrmPath(positions);
        }
      } catch (e) {
        console.error("OSRM route fetch error:", e);
        if (isMounted) setOsrmPath(positions);
      }
    };
    
    fetchOsrmRoute();
    
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)]);

  if (positions.length === 0) return null;

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}>
      <MapContainer 
        center={positions[0]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {route.map((loc, idx) => {
          const color = categoryColorMap[loc.kategori] || 'var(--accent)';
          const iconHtml = `<div style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><strong>${idx + 1}.</strong> ${loc.nama.substring(0, 20)}${loc.nama.length > 20 ? '...' : ''}</div>`;
          const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: iconHtml,
            iconSize: [null, null],
            iconAnchor: [0, 0]
          });
          return (
            <Marker 
              key={loc.id_str} 
              position={[loc.lat, loc.lon]} 
              icon={customIcon}
              eventHandlers={{
                click: (e) => {
                  const map = e.target._map;
                  map.flyTo([loc.lat, loc.lon], 16, { duration: 1 });
                }
              }}
            >
              <Popup>
                <strong>{idx + 1}. {loc.nama}</strong><br/>
                Kategori: {loc.kategori}<br/>
                Waktu: {loc.jam_tiba} - {loc.jam_selesai}
              </Popup>
            </Marker>
          );
        })}

        <Polyline 
          positions={osrmPath || positions} 
          pathOptions={{ color: 'var(--accent)', weight: 5, opacity: 0.8 }} 
        />
        
        <MapBounds route={route} />
      </MapContainer>
    </div>
  );
}
