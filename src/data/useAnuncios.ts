import { useDB } from '../store/db';

/** Anúncios aprovados (modo demonstração: vêm do banco local; com Supabase: do servidor). */
export function useAnuncios() {
  const anuncios = useDB((d) => d.anuncios);
  return { anuncios: anuncios.filter((a) => a.status === 'aprovado'), todos: anuncios, ficticio: true, carregando: false, erro: null as string | null };
}
