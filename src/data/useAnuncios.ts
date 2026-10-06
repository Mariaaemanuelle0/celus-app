import { jornada } from '../lib/regras';
import { useDB } from '../store/db';

/**
 * Anúncios que aparecem para quem procura (modo demonstração: banco local; com Supabase: servidor).
 * Profissional só aparece enquanto está com "disponível agora" ligado.
 * Anúncios em destaque vêm primeiro.
 */
export function useAnuncios() {
  const anuncios = useDB((d) => d.anuncios);
  const agora = Date.now();
  const visiveis = anuncios
    .filter((a) => a.status === 'aprovado' && (a.categoria !== 'servicos' || jornada(a, agora).disponivel))
    .filter((a) => !a.evento || (!a.evento.cancelado && a.evento.fim > agora));
  return { anuncios: visiveis, todos: anuncios, ficticio: true, carregando: false, erro: null as string | null };
}

export const emDestaque = (a: { destaqueAte?: number }) => !!a.destaqueAte && a.destaqueAte > Date.now();
