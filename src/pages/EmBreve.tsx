export function EmBreve({ titulo, etapa, texto }: { titulo: string; etapa: number; texto: string }) {
  return (
    <>
      <div className="eyebrow">Etapa {etapa}</div>
      <h1>{titulo}</h1>
      <div className="empty">{texto}</div>
    </>
  );
}
