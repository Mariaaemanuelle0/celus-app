export type Categoria =
  | 'banheiro' | 'descanso' | 'trabalho' | 'ficar'
  | 'eventos' | 'imoveis' | 'estacionamento' | 'servicos';

export type Pacote = { horas: number; preco: number };
export type Extra = { nome: string; preco: number };

/** Horário de funcionamento por dia da semana (0 = domingo): [abre, fecha] em minutos do dia, ou null = fechado. */
export type Agenda = { dias: ([number, number] | null)[]; bloqueios: string[] };

export type StatusAnuncio = 'pendente' | 'aprovado' | 'recusado' | 'pausado';

export type Anuncio = {
  id: string;
  donoId: string;
  status: StatusAnuncio;
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
  fotos: string[];
  agenda: Agenda;
  notaQualidade: number;
  notaCustoBeneficio: number;
  totalAvaliacoes: number;
  totalSonhos: number;
  criadoEm: number;
};

export type Verificacao = 'nao_enviado' | 'em_analise' | 'verificado';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  nascimento: string; // AAAA-MM-DD
  verificacao: Verificacao;
  equipeCelus: boolean;
  albumPublico: boolean;
  criadoEm: number;
};

export type StatusReserva = 'confirmada' | 'em_uso' | 'concluida' | 'cancelada' | 'solicitado' | 'aceito' | 'a_caminho';

export type Reserva = {
  id: string;
  anuncioId: string;
  userId: string;
  tipo: 'hora' | 'diaria' | 'servico';
  status: StatusReserva;
  inicio: number;          // timestamp do início previsto
  pacote?: Pacote;         // hora
  pessoas: number;
  noites?: number;         // diária
  horasServico?: number;   // serviço
  extras: Extra[];
  extensoes: number;       // horas extras compradas
  minutosTeste: number;    // atalho de teste para avançar o timer
  usoInicio?: number;      // quando começou de fato
  fim?: number;            // quando encerrou
  subtotal: number;        // valor do anfitrião antes da comissão (sem taxa)
  taxaUsuario: number;
  multa: number;
  total: number;           // o que o usuário pagou
  reembolso?: number;
  codigo: string;
  avaliadaPeloUsuario: boolean;
  avaliadaPeloAnfitriao: boolean;
  criadoEm: number;
};

export type Avaliacao = {
  id: string; reservaId: string; autorId: string;
  alvo: 'anuncio' | 'usuario'; alvoId: string;
  qualidade?: number; custoBeneficio?: number; nota?: number; devolveu?: boolean;
  criadoEm: number;
};

export type Story = {
  id: string; anuncioId: string; autorId: string; autorNome: string;
  criado: number; legenda: string; img?: string; noPerfil: boolean;
};

export type MensagemChat = { id: string; quad: string; autorId: string; autorNome: string; t: number; txt: string };

export type MarcaSemaforo = { cell: string; slot: string; nivel: 1 | 2 | 3; t: number; userId: string };

export type Lancamento = { t: number; txt: string; v: number };
export type Vale = { nome: string; onde: string; codigo: string; t: number };
export type Carteira = { saldo: number; hist: Lancamento[]; hoje: { dia: string; contagem: Record<string, number> }; vales: Vale[] };

export type Beneficio = { id: string; grupo: 'local' | 'evento' | 'celus' | 'anfitriao'; anuncioId?: string; nome: string; desc: string; custo: number };

export type Denuncia = { id: string; storyId: string; por: 'Usuário' | 'Anfitrião'; motivo: string; t: number };
