export type Categoria =
  | 'banheiro' | 'descanso' | 'trabalho' | 'ficar'
  | 'eventos' | 'imoveis' | 'estacionamento' | 'servicos';

export type Pacote = { horas: number; preco: number };
/** Lote de ingressos de um evento. Meia-entrada sai pela metade do preço. */
export type Lote = { id: string; nome: string; preco: number; qtd: number; vendidos: number; meia: boolean };
export type Ingresso = { codigo: string; loteId: string; loteNome: string; meia: boolean; valor: number; usadoEm?: number };
export type Extra = { nome: string; preco: number };

/** Horário de funcionamento por dia da semana (0 = domingo): [abre, fecha] em minutos do dia, ou null = fechado. */
export type Agenda = { dias: ([number, number] | null)[]; bloqueios: string[] };

export type StatusAnuncio = 'pendente' | 'aprovado' | 'recusado' | 'pausado' | 'convite';

/** Cadastro assistido: a equipe Celus cadastra no local e o anfitrião assume o anúncio com um código. */
export type Convite = { nome: string; email: string; codigo: string; porId: string; t: number; aceitoEm?: number };

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
  tipoPreco: 'pacote' | 'diaria' | 'valor' | 'servico' | 'ingresso';
  pacotes?: Pacote[];
  preco?: number;
  unidadePreco?: string;
  porPessoa?: boolean;
  capacidade: number;
  metragemM2?: number;
  comodidades: string[];
  extras: Extra[];
  tipoAcesso?: 'fechadura' | 'responsavel' | 'presencial' | 'portaria';
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
  /** Profissional: início da jornada atual (null = indisponível) e fim da pausa obrigatória. */
  disponivelDesde?: number | null;
  pausaAte?: number;
  /** Benefícios do anfitrião pagos em celus. */
  destaqueAte?: number;
  campanhaAte?: number;
  /** Catraca livre: locações seguidas sem supervisão desde a última conferência. */
  semSupervisao?: number;
  /** Mudança de título, foto ou descrição esperando a curadoria conferir (o anúncio segue no ar). */
  revisar?: boolean;
  convite?: Convite;
  /** Evento com ingresso: data, hora e lotes. */
  evento?: {
    inicio: number; fim: number; cancelado?: boolean;
    /** Antes desta data o evento está em divulgação: dá para marcar interesse, ainda não dá para comprar. */
    vendasAbrem?: number;
    /** Avisos já enviados aos interessados. */
    avisos?: { abertura?: boolean; vespera?: boolean; ultimoManual?: number };
    /** Só nos dados de demonstração: interessados fictícios para o contador não começar em zero. */
    interesseBase?: number;
  };
  lotes?: Lote[];
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
  foto?: string;
  bio?: string;
  /** Benefício de anfitrião: comissão de 13% até esta data. */
  comissaoReduzidaAte?: number;
  /** Última forma de pagamento usada: vira a escolha padrão na próxima (pagar rápido). */
  ultimoPagamento?: 'pix' | 'cartao';
  /** Bônus únicos já pagos (ex.: perfil completo) e mês do último bônus de boa nota (AAAA-MM). */
  bonus?: string[];
  bonusNotaMes?: string;
  /** Semana (AAAA-Sn) e mês (AAAA-MM) dos últimos bônus de constância em saúde. */
  saudeSemana?: string;
  saudeMes?: string;
  /** Blocos do perfil que outras pessoas podem ver. */
  privacidade?: { comunidades: boolean; eventos: boolean; lugares: boolean };
  /** Onde quem anuncia recebe os repasses. */
  recebimento?: { tipo: 'cpf' | 'cnpj' | 'email' | 'celular' | 'aleatoria'; chave: string; titular: string };
};

export type StatusReserva = 'confirmada' | 'em_uso' | 'concluida' | 'cancelada' | 'solicitado' | 'aceito' | 'a_caminho' | 'em_andamento' | 'recusado';

export type Reserva = {
  id: string;
  anuncioId: string;
  userId: string;
  tipo: 'hora' | 'diaria' | 'servico' | 'ingresso';
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
  /** Comissão da Celus no momento da reserva (padrão 15%). */
  comissao?: number;
  pagamento?: 'pix' | 'cartao';
  avisoFimEnviado?: boolean;
  /** Código de chegada (como o da Uber): conferido por quem recebe ou pelo profissional. */
  chegadaConfirmada?: number;
  tentativasCodigo?: number;
  codigoTravado?: boolean;
  /** Cliente relatou pedido de pagamento por fora (dinheiro, maquininha, Pix direto). */
  pagamentoPorFora?: number;
  /** Chamado de serviço: onde o cliente está (o profissional vai até lá). */
  destino?: { lat: number; lng: number };
  ingressos?: Ingresso[];
  fimEvento?: number;
};

export type Notificacao = { id: string; userId: string; t: number; txt: string; link?: string; lida: boolean };

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

/** k = de onde veio (chave do ganho, 'premio' do ranking, 'loteria'). Só ganhos contam no ranking. */
export type Lancamento = { t: number; txt: string; v: number; k?: string };
/** Bilhete da Loteria do Mar: 3 elementos para o concurso de um dia. */
export type Bilhete = { id: string; userId: string; dia: string; escolha: string[]; valor: number; t: number; status: 'aguardando' | 'ganhou' | 'perdeu'; acertos?: number; premio?: number };
/** Resultado de um concurso. premio3 é o valor para cada ganhador do principal. */
export type Concurso = { dia: string; saiu: string[]; bilhetes: number; premioTotal: number; ganhadores3: number; premio3: number; ganhadores2: number; acumulou: boolean };
export type EstadoLoteria = { acumulado: number; ultimoApurado: string; concursos: Concurso[] };
export type Vale = { nome: string; onde: string; codigo: string; t: number };
export type Carteira = { saldo: number; hist: Lancamento[]; hoje: { dia: string; contagem: Record<string, number> }; vales: Vale[]; /** Celus guardados (caução de encontro, troca em andamento): ainda são da pessoa, mas não dá para usar. */ reservado?: number };

export type Beneficio = { id: string; grupo: 'local' | 'evento' | 'celus' | 'anfitriao'; anuncioId?: string; nome: string; desc: string; custo: number };

export type Denuncia = { id: string; storyId: string; por: 'Usuário' | 'Anfitrião'; motivo: string; t: number };

/** Problema relatado numa reserva ("Tive um problema"). A equipe Celus responde e decide reembolso. */
export type Suporte = {
  id: string; reservaId: string; userId: string; anuncioId: string;
  motivo: string; texto: string; t: number;
  status: 'aberto' | 'resolvido'; resposta?: string; reembolso?: number; resolvidoEm?: number;
};

/** Comunidade: grupo de interesse de um lugar (ex.: corrida na Enseada). */
export type Comunidade = {
  id: string; nome: string; atividade: string; descricao: string; regras: string;
  lat: number; lng: number; bairro: string; criadorId: string; membros: string[]; membrosBase?: number; criadoEm: number;
};
export type Presenca = { userId: string; t: number; codigo: string; status: 'confirmado' | 'presente' | 'faltou' | 'cancelado' };
/** Encontro de uma comunidade, com caução opcional em celus. */
export type Encontro = {
  id: string; comunidadeId: string; organizadorId: string; titulo: string; descricao: string; local: string;
  inicio: number; fim: number; vagas: number; caucao: number; prazoCancelH: number; presencas: Presenca[]; encerrado?: boolean;
};
/** Troca: item que ia para o lixo ou não tem mais uso, trocado por celus (sem doação, mínimo 5 celus). */
export type Troca = {
  id: string; donoId: string; titulo: string; descricao: string; estado: 'novo' | 'usado'; preco: number; fotos: string[];
  lat: number; lng: number; bairro: string; criadoEm: number;
  status: 'disponivel' | 'reservado' | 'entregue' | 'removido'; compradorId?: string; codigo?: string; reservadoEm?: number; entregueEm?: number; denuncias?: number;
};

/** Local parceiro de saúde (academia, estúdio, box...). Na recepção, uma tela mostra um QR que muda a cada 30 s. */
export type TipoSaude = 'academia' | 'estudio' | 'box' | 'piscina' | 'quadra' | 'luta' | 'outro';
export type LocalSaude = { id: string; nome: string; tipo: TipoSaude; bairro: string; lat: number; lng: number; donoId: string; segredo: string; status: 'pendente' | 'aprovado' | 'recusado' | 'pausado'; criadoEm: number };
export type CheckinSaude = { id: string; userId: string; localId: string; t: number };
