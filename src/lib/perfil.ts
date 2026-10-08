import { useMemo } from 'react';
import { useDB } from '../store/db';

/** Nome da seção de trocas. Mudar aqui muda no app inteiro. */
export const NOME_TROCAS = 'Feira do Polvo';

export const PRIVACIDADE_PADRAO = { comunidades: true, eventos: true, lugares: false };

/** Blocos do perfil: comunidades, eventos que foi e lugares que usou. Cada um pode ficar visível ou oculto. */
export function useBlocosPerfil(uid: string) {
  const comunidades = useDB((d) => d.comunidades);
  const encontros = useDB((d) => d.encontros);
  const reservas = useDB((d) => d.reservas);
  const anuncios = useDB((d) => d.anuncios);
  return useMemo(() => {
    const comu = comunidades.filter((c) => c.membros.includes(uid));
    const nomeComu = (id: string) => comunidades.find((c) => c.id === id)?.nome ?? '';
    const eventos = [
      ...reservas.filter((r) => r.userId === uid && r.tipo === 'ingresso' && r.status !== 'cancelada').map((r) => ({ id: r.id, t: r.inicio, nome: anuncios.find((a) => a.id === r.anuncioId)?.titulo ?? 'Evento', link: `/anuncio/${r.anuncioId}` })),
      ...encontros.filter((e) => e.presencas.some((p) => p.userId === uid && p.status === 'presente')).map((e) => ({ id: e.id, t: e.inicio, nome: `${e.titulo} (${nomeComu(e.comunidadeId)})`, link: `/comunidade/${e.comunidadeId}` })),
    ].sort((a, b) => b.t - a.t);
    const vistos = new Set<string>();
    const lugares = reservas.filter((r) => r.userId === uid && r.status === 'concluida' && r.tipo !== 'ingresso' && r.tipo !== 'servico')
      .sort((a, b) => b.inicio - a.inicio)
      .map((r) => anuncios.find((a) => a.id === r.anuncioId))
      .filter((a): a is NonNullable<typeof a> => !!a && !vistos.has(a.id) && !!vistos.add(a.id));
    return { comu, eventos, lugares };
  }, [comunidades, encontros, reservas, anuncios, uid]);
}

