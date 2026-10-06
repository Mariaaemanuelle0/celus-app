/** Abre a rota no app de navegação da pessoa. O Celus mostra onde fica; quem guia é o Waze ou o Google Maps. */
export function ComoChegar({ lat, lng, rotulo = 'Como chegar' }: { lat: number; lng: number; rotulo?: string }) {
  return (
    <div className="rota">
      <span className="hint">{rotulo}</span>
      <a className="btn sm ghost" href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noreferrer">Waze</a>
      <a className="btn sm ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">Google Maps</a>
    </div>
  );
}
