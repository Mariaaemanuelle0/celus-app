import { useEffect, useState } from 'react';
import { listarAnuncios } from './anuncios';
import type { Anuncio } from './types';

let cache: { anuncios: Anuncio[]; ficticio: boolean } | null = null;

export function useAnuncios() {
  const [estado, setEstado] = useState(cache);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (cache) return;
    listarAnuncios()
      .then((r) => { cache = r; setEstado(r); })
      .catch((e: Error) => setErro(e.message));
  }, []);
  return { anuncios: estado?.anuncios ?? [], ficticio: estado?.ficticio ?? false, carregando: !estado && !erro, erro };
}
