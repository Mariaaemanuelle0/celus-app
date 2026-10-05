export type Categoria =
  | 'banheiro' | 'descanso' | 'trabalho' | 'ficar'
  | 'eventos' | 'imoveis' | 'estacionamento' | 'servicos';

export type Pacote = { horas: number; preco: number };
export type Extra = { nome: string; preco: number };

export type Anuncio = {
  id: string;
  categoria: Categoria;
  subcategoria: string;
  profissao?: string;
  titulo: string;
  descricao: string;
  bairro: string;
  lat: number;
  lng: number;
  tipoPreco: 'pacote' | 'diaria' | 'valor' | 'servico';
  pacotes?: Pacote[];
  preco?: number;
  unidadePreco?: string;
  porPessoa?: boolean;
  capacidade: number;
  metragemM2?: number;
  comodidades: string[];
  extras: Extra[];
  tipoAcesso?: 'fechadura' | 'responsavel' | 'presencial';
  responsavelLocal?: string;
  manualBonsModos: string;
  limpezaInclusa: boolean;
  notaQualidade: number;
  notaCustoBeneficio: number;
  totalAvaliacoes: number;
  totalSonhos: number;
};
