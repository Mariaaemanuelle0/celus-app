import type { Categoria } from './types';

export const CATEGORIAS: Record<Categoria, { nome: string; curto?: string; cor: string; subs: Record<string, string> }> = {
  banheiro: { nome: 'Banheiro', cor: '#5AA9FF', subs: { banheiro: 'Banheiro', vestiario: 'Vestiário', ducha: 'Ducha' } },
  descanso: { nome: 'Descanso', cor: '#A08CFF', subs: { rede: 'Rede', cabine: 'Cabine' } },
  trabalho: { nome: 'Trabalho', cor: '#49C7A5', subs: { sala: 'Sala de trabalho', wifi: 'Só Wi-Fi', computador: 'Computador com internet', reuniao: 'Sala de reunião' } },
  ficar: { nome: 'Ficar', cor: '#F2A65A', subs: { suite: 'Suíte independente', casa: 'Casa inteira', motorhome: 'Motorhome' } },
  eventos: { nome: 'Eventos', cor: '#F07AA8', subs: { festa: 'Festa', inauguracao: 'Inauguração', show: 'Show' } },
  imoveis: { nome: 'Imóveis', cor: '#D4B26A', subs: { venda: 'Venda', aluguel: 'Aluguel' } },
  estacionamento: { nome: 'Estacionamento', curto: 'Estacionar', cor: '#B9C6E0', subs: { carro: 'Carro', moto: 'Moto', bike: 'Bicicleta' } },
  servicos: { nome: 'Serviços', cor: '#5CD6D6', subs: { restaurante: 'Restaurante', evento: 'Eventos', pet: 'Pet', reforma: 'Reforma', limpeza: 'Limpeza', beleza: 'Beleza' } },
};

export const PROFISSOES: Record<string, Record<string, string>> = {
  restaurante: { garcom: 'Garçom', cozinheiro: 'Cozinheiro', chapeiro: 'Chapeiro', auxcozinha: 'Auxiliar de cozinha' },
  evento: { barman: 'Barman', fotografo: 'Fotógrafo', dj: 'DJ', recepcao: 'Recepcionista', seguranca: 'Segurança' },
  pet: { tosador: 'Banho e tosa', passeador: 'Passeador', adestrador: 'Adestrador', petsitter: 'Pet sitter' },
  reforma: { eletricista: 'Eletricista', encanador: 'Encanador', pintor: 'Pintor', pedreiro: 'Pedreiro', montador: 'Montador de móveis' },
  limpeza: { diarista: 'Diarista', posobra: 'Limpeza pós-obra', piscina: 'Limpeza de piscina' },
  beleza: { manicure: 'Manicure', cabeleireiro: 'Cabeleireiro', maquiador: 'Maquiador' },
};

export const COMODIDADES: Record<string, string> = {
  ar: 'Ar-condicionado', ventilador: 'Ventilador', wifi: 'Wi-Fi', tomada: 'Tomada',
  banheiro: 'Banheiro no local', acessivel: 'Acessível', estacionamento: 'Estacionamento',
  coberta: 'Coberta', monitorada: 'Monitorada 24h',
};

export const ACESSO = { fechadura: 'Fechadura digital', portaria: 'Portaria do prédio', responsavel: 'Responsável local', presencial: 'Presencial' } as const;

export const ORDEM_CATEGORIAS: Categoria[] = ['banheiro', 'descanso', 'trabalho', 'ficar', 'eventos', 'imoveis', 'estacionamento', 'servicos'];
