/**
 * Map view for the project index. Leaflet is only downloaded when a visitor
 * opens the Map view, so the rest of the site ships no map code.
 * Tiles: OpenStreetMap, shown in greyscale so the map stays quiet like the rest of
 * the site. OSM's free tiles are fine for a studio site's traffic; if it ever gets
 * heavy, swap the URL for a keyed provider (MapTiler, Stadia, etc.).
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Point = {
  slug: string;
  title: string;
  year: string;
  lat: number;
  lng: number;
  thumb: string;
  type: string;
  status: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function initMap(el: HTMLElement, points: Point[]) {
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    className: 'mono-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const icon = L.divIcon({ className: 'pin', html: '<span></span>', iconSize: [14, 14] });
  const markers = points.map((p) => {
    const m = L.marker([p.lat, p.lng], { icon, title: p.title }).bindPopup(
      `<a class="pop" href="/projects/${esc(p.slug)}"><img src="${esc(p.thumb)}" alt="" width="200"/><strong>${esc(p.title)}</strong> <span>${esc(p.year)}</span></a>`,
    );
    return { p, m };
  });

  const style = document.createElement('style');
  style.textContent = `
    .mono-tiles{filter:grayscale(1) contrast(.85) brightness(1.08)}
    .pin span{display:block;width:14px;height:14px;border-radius:50%;background:#141414;border:2px solid #fff;box-shadow:0 0 0 1px #141414}
    .leaflet-container a.pop{color:#141414}
    .pop{display:block;color:inherit;text-decoration:none;font:13px/1.4 var(--font)} .pop img{width:200px;height:auto;margin-bottom:6px}
    .pop span{color:#6b6a66}`;
  document.head.appendChild(style);

  function filter(type: string, status: string) {
    const shown = markers.filter(({ p }) => (!type || p.type === type) && (!status || p.status === status));
    markers.forEach(({ m }) => m.remove());
    shown.forEach(({ m }) => m.addTo(map));
    const bounds = L.latLngBounds(shown.map(({ p }) => [p.lat, p.lng]));
    if (shown.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
    else if (shown.length === 1) map.setView(bounds.getCenter(), 12);
    else map.setView([27.33, 88.61], 9); // Gangtok
  }

  return { filter };
}
