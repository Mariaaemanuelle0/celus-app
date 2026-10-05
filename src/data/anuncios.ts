import { supabase } from '../lib/supabase';
import { agendaPadrao, anunciosFicticios } from './seed';
import type { Anuncio, Categoria } from './types';

type Linha = {
  id: string; categoria: Categoria; subcategoria: string; profissao: string | null; titulo: string; descricao: string;
  bairro: string | null; lat: number; lng: number; tipo_preco: Anuncio['tipoPreco'];
  pacotes: { horas: number; preco: number }[] | null; preco: number | null; unidade_preco: string | null;
  por_pessoa: boolean; capacidade: number; metragem_m2: number | null; comodidades: string[];
  extras: { nome: string; preco: number }[]; tipo_acesso: Anuncio['tipoAcesso'] | null; responsavel_local: string | null;
  manual_bons_modos: string; limpeza_inclusa: boolean; nota_qualidade: number | null; nota_custo_beneficio: number | null;
  total_avaliacoes: number; total_sonhos: number; dono_id: string; fotos: string[]; criado_em: string;
};

const daLinha = (r: Linha): Anuncio => ({
  id: r.id, donoId: r.dono_id, status: 'aprovado', fotos: r.fotos ?? [], agenda: agendaPadrao(r.tipo_preco), criadoEm: Date.parse(r.criado_em),
  categoria: r.categoria, subcategoria: r.subcategoria, profissao: r.profissao ?? undefined,
  titulo: r.titulo, descricao: r.descricao, bairro: r.bairro ?? '', lat: r.lat, lng: r.lng,
  tipoPreco: r.tipo_preco, pacotes: r.pacotes ?? undefined, preco: r.preco ?? undefined, unidadePreco: r.unidade_preco ?? undefined,
  porPessoa: r.por_pessoa, capacidade: r.capacidade, metragemM2: r.metragem_m2 ?? undefined, comodidades: r.comodidades,
  extras: r.extras, tipoAcesso: r.tipo_acesso ?? undefined, responsavelLocal: r.responsavel_local ?? undefined,
  manualBonsModos: r.manual_bons_modos, limpezaInclusa: r.limpeza_inclusa,
  notaQualidade: r.nota_qualidade ?? 5, notaCustoBeneficio: r.nota_custo_beneficio ?? 5,
  totalAvaliacoes: r.total_avaliacoes, totalSonhos: r.total_sonhos,
});

/** (Para a troca pelo Supabase) Anúncios aprovados. Usa o Supabase quando configurado; senão, os dados fictícios. */
export async function listarAnuncios(): Promise<{ anuncios: Anuncio[]; ficticio: boolean }> {
  if (!supabase) return { anuncios: anunciosFicticios(), ficticio: true };
  const { data, error } = await supabase.from('anuncios_mapa').select('*');
  if (error) throw error;
  return { anuncios: (data as Linha[]).map(daLinha), ficticio: false };
}
