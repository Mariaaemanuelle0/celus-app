// Estilo do mapa da Celus: vetorial, escuro, em azul-marinho, com ruas legíveis e prédios em 3D.
// Dados: OpenStreetMap servido pelo OpenFreeMap (gratuito, sem chave).
// Para trocar de fornecedor (ex.: Mapbox), defina VITE_MAP_STYLE_URL com a URL do estilo.
import type { StyleSpecification } from 'maplibre-gl';

const C = {
  fundo: '#060B16',
  quadra: '#0A1222',
  parque: '#0C1D24',
  agua: '#071A33',
  aguaLinha: '#0D2A4D',
  predio: '#0E1830',
  predio3d: '#13213D',
  ruaMenor: '#17233A',
  ruaMedia: '#22375C',
  ruaGrande: '#2B4C86',
  ruaRapida: '#3567C4',
  contorno: '#04070F',
  trilho: '#1B2840',
  texto: '#8D9BB8',
  textoForte: '#C9D4EA',
  halo: '#060B16',
};

const larg = (min: number, max: number) => ['interpolate', ['exponential', 1.4], ['zoom'], 10, min, 18, max];

const rua = (id: string, classes: string[], cor: string, min: number, max: number, minzoom = 0) => ({
  id, type: 'line' as const, source: 'omt', 'source-layer': 'transportation', minzoom,
  filter: ['all', ['match', ['get', 'class'], classes, true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
  layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  paint: { 'line-color': cor, 'line-width': larg(min, max) },
});

export const ESTILO_CELUS = {
  version: 8,
  name: 'Celus Noite',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap · OpenFreeMap' } },
  layers: [
    { id: 'fundo', type: 'background', paint: { 'background-color': C.fundo } },
    { id: 'uso', type: 'fill', source: 'omt', 'source-layer': 'landuse', paint: { 'fill-color': C.quadra } },
    { id: 'parque', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.parque } },
    { id: 'verde', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['grass', 'wood'], true, false], paint: { 'fill-color': C.parque, 'fill-opacity': 0.8 } },
    { id: 'agua', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.agua } },
    { id: 'rio', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.aguaLinha, 'line-width': 1.2 } },
    { id: 'predio', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14, maxzoom: 15.5, paint: { 'fill-color': C.predio } },
    rua('rua-servico', ['service', 'track'], C.ruaMenor, 0.4, 6, 14),
    rua('rua-menor', ['minor'], C.ruaMenor, 0.6, 12, 12),
    rua('rua-media', ['secondary', 'tertiary'], C.ruaMedia, 0.8, 16, 9),
    rua('rua-grande', ['primary', 'trunk'], C.ruaGrande, 1, 20, 7),
    rua('rua-rapida', ['motorway'], C.ruaRapida, 1.2, 22, 5),
    { id: 'trilho', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: ['match', ['get', 'class'], ['rail', 'transit'], true, false], paint: { 'line-color': C.trilho, 'line-width': 1.2, 'line-dasharray': [3, 3] } },
    {
      id: 'predio-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 15,
      paint: { 'fill-extrusion-color': C.predio3d, 'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-base': ['get', 'render_min_height'], 'fill-extrusion-opacity': 0.85 },
    },
    {
      id: 'nome-rua', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: { 'text-color': C.texto, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'nome-agua', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 12 },
      paint: { 'text-color': '#4C78B8', 'text-halo-color': C.halo, 'text-halo-width': 1 },
    },
    {
      id: 'bairro', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 11,
      filter: ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter'], true, false],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
      paint: { 'text-color': '#5D6C8C', 'text-halo-color': C.halo, 'text-halo-width': 1.2 },
    },
    {
      id: 'cidade', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 12,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 14 },
      paint: { 'text-color': C.textoForte, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    },
  ],
} as unknown as StyleSpecification;
