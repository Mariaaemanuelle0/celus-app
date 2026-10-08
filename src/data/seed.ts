// Dados FICTÍCIOS para desenvolvimento, usados enquanto o Supabase não está configurado.
// As posições são deslocamentos em km a partir do centro da cidade piloto.
import type { Anuncio, Comunidade, Encontro, Troca, LocalSaude } from './types';
import { centroPiloto } from '../lib/geo';

export function agendaPadrao(tipo: Anuncio['tipoPreco']): Anuncio['agenda'] {
  const dia: [number, number] = tipo === 'pacote' ? [7 * 60, 23 * 60] : [0, 24 * 60];
  return { dias: [dia, dia, dia, dia, dia, dia, dia], bloqueios: [] };
}

type Semente = Omit<Anuncio, 'lat' | 'lng' | 'comodidades' | 'extras' | 'limpezaInclusa' | 'totalSonhos' | 'donoId' | 'status' | 'fotos' | 'agenda' | 'criadoEm'> & {
  dx: number; dy: number; comodidades?: string[]; extras?: Anuncio['extras']; limpezaInclusa?: boolean; totalSonhos?: number;
};

const S: Semente[] = [
  { id: 's1', categoria: 'banheiro', subcategoria: 'vestiario', titulo: 'Vestiário com chuveiro quente', descricao: 'Seis boxes com chuveiro quente, bancos e armários.', bairro: 'Centro', dx: 0.3, dy: 0.9, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 6 }], porPessoa: true, capacidade: 6, metragemM2: 18, comodidades: ['ventilador', 'acessivel'], extras: [{ nome: 'Toalha', preco: 3 }, { nome: 'Kit higiene', preco: 4 }], tipoAcesso: 'presencial', manualBonsModos: 'Toalha usada vai no cesto azul.', limpezaInclusa: true, notaQualidade: 4.5, notaCustoBeneficio: 4.8, totalAvaliacoes: 112 },
  { id: 's2', categoria: 'banheiro', subcategoria: 'banheiro', titulo: 'Banheiro limpo da padaria', descricao: 'Banheiro reformado nos fundos da padaria, limpo de hora em hora.', bairro: 'Centro', dx: -0.25, dy: -0.15, tipoPreco: 'pacote', pacotes: [{ horas: 0.25, preco: 2 }], porPessoa: true, capacidade: 1, metragemM2: 4, comodidades: ['acessivel'], tipoAcesso: 'presencial', manualBonsModos: 'Peça a ficha no caixa.', limpezaInclusa: true, notaQualidade: 4.6, notaCustoBeneficio: 4.9, totalAvaliacoes: 240 },
  { id: 's3', categoria: 'descanso', subcategoria: 'rede', titulo: 'Rede na varanda do Seu Tião', descricao: 'Rede de algodão na sombra, ventilador de teto e água gelada.', bairro: 'Vila', dx: -0.5, dy: 0.4, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 10 }, { horas: 3, preco: 25 }, { horas: 6, preco: 50 }], capacidade: 1, metragemM2: 12, comodidades: ['ventilador', 'wifi'], extras: [{ nome: 'Travesseiro', preco: 2 }], tipoAcesso: 'responsavel', responsavelLocal: 'Dona Lia, vizinha da casa 12', manualBonsModos: 'Ao sair, dobre a manta e feche o portão.', notaQualidade: 4.7, notaCustoBeneficio: 4.9, totalAvaliacoes: 38, totalSonhos: 12 },
  { id: 's4', categoria: 'descanso', subcategoria: 'cabine', titulo: 'Cabine de descanso com ar', descricao: 'Cabine individual com colchão, ar-condicionado e cortina blackout.', bairro: 'Centro', dx: 0.6, dy: -0.75, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 18 }, { horas: 3, preco: 45 }, { horas: 6, preco: 80 }], capacidade: 1, metragemM2: 4, comodidades: ['ar', 'tomada', 'wifi'], tipoAcesso: 'fechadura', manualBonsModos: 'Proibido comer dentro da cabine.', limpezaInclusa: true, notaQualidade: 4.8, notaCustoBeneficio: 4.3, totalAvaliacoes: 64, totalSonhos: 21 },
  { id: 's5', categoria: 'trabalho', subcategoria: 'sala', titulo: 'Sala de trabalho silenciosa', descricao: 'Quatro mesas, cadeiras boas e internet rápida.', bairro: 'Jardim', dx: 0.15, dy: -1.2, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 15 }, { horas: 3, preco: 40 }, { horas: 6, preco: 70 }], capacidade: 4, metragemM2: 20, comodidades: ['ar', 'wifi', 'tomada', 'acessivel', 'banheiro'], extras: [{ nome: 'Café à vontade', preco: 6 }], tipoAcesso: 'fechadura', manualBonsModos: 'Ligação só na varanda.', limpezaInclusa: true, notaQualidade: 4.9, notaCustoBeneficio: 4.6, totalAvaliacoes: 41, totalSonhos: 17 },
  { id: 's6', categoria: 'trabalho', subcategoria: 'wifi', titulo: 'Wi-Fi na varanda do café', descricao: 'Mesa, tomada e senha do Wi-Fi.', bairro: 'Centro', dx: -0.7, dy: -0.4, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 4 }, { horas: 3, preco: 10 }], porPessoa: true, capacidade: 10, metragemM2: 30, comodidades: ['wifi', 'tomada', 'ventilador', 'banheiro'], tipoAcesso: 'presencial', manualBonsModos: 'Fones de ouvido, por favor.', limpezaInclusa: true, notaQualidade: 4.3, notaCustoBeneficio: 4.8, totalAvaliacoes: 57 },
  { id: 's7', categoria: 'ficar', subcategoria: 'casa', titulo: 'Casa com quintal', descricao: 'Três quartos, churrasqueira e varal.', bairro: 'Canto', dx: -0.8, dy: 1.1, tipoPreco: 'diaria', preco: 320, capacidade: 6, metragemM2: 110, comodidades: ['ar', 'wifi', 'estacionamento', 'banheiro'], extras: [{ nome: 'Roupa de cama', preco: 30 }], tipoAcesso: 'fechadura', manualBonsModos: 'Check-in 14h, check-out 11h.', limpezaInclusa: true, notaQualidade: 4.9, notaCustoBeneficio: 4.5, totalAvaliacoes: 27, totalSonhos: 58 },
  { id: 's15', categoria: 'ficar', subcategoria: 'suite', titulo: 'Suíte com entrada própria', descricao: 'Suíte nos fundos com entrada independente, banho quente e cama de casal. Boa para descansar entre compromissos ou passar a noite.', bairro: 'Vila', dx: 0.95, dy: 0.2, tipoPreco: 'diaria', preco: 140, pacotes: [{ horas: 3, preco: 40 }, { horas: 6, preco: 65 }, { horas: 12, preco: 90 }], capacidade: 2, metragemM2: 22, comodidades: ['ar', 'wifi', 'tomada'], extras: [{ nome: 'Café da manhã', preco: 18 }], tipoAcesso: 'fechadura', manualBonsModos: 'Entrada pelo portão lateral. Toalhas no armário.', limpezaInclusa: true, notaQualidade: 4.7, notaCustoBeneficio: 4.8, totalAvaliacoes: 31, totalSonhos: 9 },
  { id: 's16', categoria: 'ficar', subcategoria: 'camping', titulo: 'Camping no quintal com sombra', descricao: 'Gramado amplo com mangueiras, ponto de luz para cada barraca, banheiro e chuveiro externos. A cinco minutos da praia.', bairro: 'Canto', dx: -1.15, dy: 0.65, tipoPreco: 'diaria', preco: 45, porPessoa: true, pacotes: [{ horas: 8, preco: 20 }], capacidade: 16, metragemM2: 600, comodidades: ['banheiro', 'chuveiro', 'churrasqueira', 'sombra', 'tomada', 'estacionamento', 'pet'], extras: [{ nome: 'Aluguel de barraca', preco: 30 }, { nome: 'Lenha', preco: 15 }], tipoAcesso: 'responsavel', responsavelLocal: 'Seu Ivo, caseiro', manualBonsModos: 'Silêncio depois das 22h. Lixo separado no tambor verde. Fogo só na churrasqueira.', limpezaInclusa: true, notaQualidade: 4.6, notaCustoBeneficio: 4.9, totalAvaliacoes: 18, totalSonhos: 34 },
  { id: 's8', categoria: 'eventos', subcategoria: 'festa', titulo: 'Casa de festa com piscina', descricao: 'Área gourmet, piscina aquecida e estacionamento.', bairro: 'Jardim', dx: 1.3, dy: -1.4, tipoPreco: 'pacote', pacotes: [{ horas: 6, preco: 900 }, { horas: 12, preco: 1500 }], capacidade: 40, metragemM2: 400, comodidades: ['ar', 'wifi', 'estacionamento', 'acessivel', 'banheiro'], extras: [{ nome: 'Limpeza pós-evento', preco: 200 }], tipoAcesso: 'responsavel', responsavelLocal: 'Rita, caseira', manualBonsModos: 'Música até 23h.', limpezaInclusa: true, notaQualidade: 4.8, notaCustoBeneficio: 4.2, totalAvaliacoes: 22, totalSonhos: 73 },
  { id: 's9', categoria: 'estacionamento', subcategoria: 'carro', titulo: 'Garagem coberta', descricao: 'Vaga coberta com portão automático e câmera.', bairro: 'Centro', dx: 0.35, dy: -0.45, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 8 }, { horas: 3, preco: 18 }, { horas: 12, preco: 35 }], capacidade: 1, metragemM2: 12, comodidades: ['coberta', 'monitorada', 'acessivel', 'banheiro'], tipoAcesso: 'fechadura', manualBonsModos: 'Não deixe objetos à vista.', notaQualidade: 4.8, notaCustoBeneficio: 4.6, totalAvaliacoes: 93 },
  { id: 's10', categoria: 'estacionamento', subcategoria: 'moto', titulo: 'Vagas para moto', descricao: 'Oito vagas com manobrista de dia e câmera à noite.', bairro: 'Centro', dx: 0.7, dy: 0.6, tipoPreco: 'pacote', pacotes: [{ horas: 1, preco: 4 }, { horas: 12, preco: 18 }], capacidade: 1, metragemM2: 3, comodidades: ['monitorada'], tipoAcesso: 'presencial', manualBonsModos: 'Deixe a chave só se o manobrista pedir.', notaQualidade: 4.5, notaCustoBeneficio: 4.8, totalAvaliacoes: 61 },
  { id: 's11', categoria: 'imoveis', subcategoria: 'aluguel', titulo: 'Apartamento 2 quartos', descricao: 'Segundo andar, varanda, uma vaga.', bairro: 'Jardim', dx: 0.9, dy: -1.0, tipoPreco: 'valor', preco: 2400, unidadePreco: '/mês', capacidade: 4, metragemM2: 68, comodidades: ['estacionamento'], manualBonsModos: 'Visitas com hora marcada.', notaQualidade: 4.3, notaCustoBeneficio: 4.4, totalAvaliacoes: 6 },
  { id: 's12', categoria: 'servicos', subcategoria: 'evento', profissao: 'barman', titulo: 'Lucas, barman', descricao: 'Drinks clássicos e caipirinhas.', bairro: 'Disponível agora', dx: -0.3, dy: -0.6, tipoPreco: 'servico', preco: 45, unidadePreco: '/h', capacidade: 1, manualBonsModos: 'Atende num raio de 2 km.', notaQualidade: 4.9, notaCustoBeneficio: 4.7, totalAvaliacoes: 52 },
  { id: 's13', categoria: 'servicos', subcategoria: 'reforma', profissao: 'eletricista', titulo: 'Marcos, eletricista', descricao: 'Tomada, chuveiro, disjuntor e luminária.', bairro: 'Disponível agora', dx: 0.5, dy: 0.25, tipoPreco: 'servico', preco: 80, unidadePreco: '/visita', capacidade: 1, manualBonsModos: 'Visita inclui diagnóstico.', notaQualidade: 4.8, notaCustoBeneficio: 4.5, totalAvaliacoes: 67 },
  { id: 's14', categoria: 'servicos', subcategoria: 'pet', profissao: 'passeador', titulo: 'Theo, passeador de cães', descricao: 'Passeio de 40 minutos, até 3 cães.', bairro: 'Disponível agora', dx: -0.6, dy: -0.75, tipoPreco: 'servico', preco: 25, unidadePreco: '/passeio', capacidade: 1, manualBonsModos: 'Manda foto e trajeto no fim.', notaQualidade: 4.9, notaCustoBeneficio: 4.9, totalAvaliacoes: 73 },
];

/** Próximo sábado às 22h (a data do evento de exemplo acompanha o calendário). */
function proximoSabado(): number {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(22, 0, 0, 0); return d.getTime();
}

export function anunciosFicticios(): Anuncio[] {
  const c = centroPiloto();
  const sab = proximoSabado();
  const kmLat = 1 / 110.574;
  const kmLng = 1 / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  const evento: Semente = { id: 's17', categoria: 'eventos', subcategoria: 'ingressos', titulo: 'Calourada da Atlética', descricao: 'Festa de boas-vindas dos calouros com DJ, open de água e área externa. Proibido para menores de 18.', bairro: 'Jardim', dx: 1.1, dy: -0.35, tipoPreco: 'ingresso', capacidade: 400, manualBonsModos: 'Leve documento com foto. Meia-entrada: carteirinha estudantil válida na entrada.', notaQualidade: 4.7, notaCustoBeneficio: 4.6, totalAvaliacoes: 12, totalSonhos: 40 };
  const extras = [{ ...evento, evento: { inicio: sab, fim: sab + 6 * 3600_000, interesseBase: 214 }, lotes: [{ id: 'l1', nome: '1º lote', preco: 30, qtd: 150, vendidos: 132, meia: true }, { id: 'l2', nome: '2º lote', preco: 45, qtd: 250, vendidos: 0, meia: true }] }];
  const daqui3 = Date.now() + 3 * 86_400_000, sunset = new Date(Date.now() + 16 * 86_400_000); sunset.setHours(17, 0, 0, 0);
  extras.push({ id: 's18', categoria: 'eventos', subcategoria: 'ingressos', titulo: 'Sunset na Laje', descricao: 'Fim de tarde com DJ e vista para a cidade. Lote promocional para quem marcar interesse antes de abrir as vendas.', bairro: 'Vila', dx: -0.9, dy: -1.05, tipoPreco: 'ingresso', capacidade: 300, manualBonsModos: 'Documento com foto na entrada. Proibido para menores de 18.', notaQualidade: 5, notaCustoBeneficio: 5, totalAvaliacoes: 0, totalSonhos: 18,
    evento: { inicio: sunset.getTime(), fim: sunset.getTime() + 5 * 3600_000, vendasAbrem: daqui3, interesseBase: 96 }, lotes: [{ id: 'l1', nome: 'Lote promocional', preco: 35, qtd: 100, vendidos: 0, meia: true }, { id: 'l2', nome: '1º lote', preco: 50, qtd: 200, vendidos: 0, meia: true }] } as typeof extras[number]);
  return [...S, ...extras].map(({ dx, dy, ...a }) => ({
    comodidades: [], extras: [], limpezaInclusa: false, totalSonhos: 0,
    donoId: 'celus-demo', status: 'aprovado' as const, fotos: [], criadoEm: 0,
    agenda: agendaPadrao(a.tipoPreco),
    ...a,
    lat: c.lat - dy * kmLat,
    lng: c.lng + dx * kmLng,
  }));
}

/** Comunidades, encontros e trocas de exemplo (fictícios). */
export function sementesSaude(): LocalSaude[] {
  const c = centroPiloto();
  const kmLat = 1 / 110.574, kmLng = 1 / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  const em = (dx: number, dy: number) => ({ lat: c.lat - dy * kmLat, lng: c.lng + dx * kmLng });
  return [
    { id: 'h1', nome: 'Academia Fôlego', tipo: 'academia', bairro: 'Centro', ...em(0.3, 0.2), donoId: 'demo-folego', segredo: 'folego-demo', status: 'aprovado', criadoEm: 0 },
    { id: 'h2', nome: 'Box Maré Alta', tipo: 'box', bairro: 'Vila', ...em(-0.7, 0.5), donoId: 'demo-mare', segredo: 'mare-demo', status: 'aprovado', criadoEm: 0 },
    { id: 'h3', nome: 'Estúdio Respira Pilates', tipo: 'estudio', bairro: 'Jardim', ...em(0.8, -0.6), donoId: 'demo-respira', segredo: 'respira-demo', status: 'aprovado', criadoEm: 0 },
  ];
}

export function sementesComunidade(): { comunidades: Comunidade[]; encontros: Encontro[]; trocas: Troca[] } {
  const c = centroPiloto();
  const kmLat = 1 / 110.574, kmLng = 1 / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  const em = (dx: number, dy: number) => ({ lat: c.lat - dy * kmLat, lng: c.lng + dx * kmLng });
  const dia = (n: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.getTime(); };
  const comunidades: Comunidade[] = [
    { id: 'c1', nome: 'Corrida no Parque', atividade: 'Corrida', descricao: 'Treinos leves e longos para todos os ritmos. Ninguém fica para trás.', regras: 'Chegue 10 minutos antes. Leve água.', ...em(-0.4, -0.9), bairro: 'Jardim', criadorId: 'demo-rafa', membros: [], membrosBase: 186, criadoEm: 0 },
    { id: 'c2', nome: 'Calistenia na Praça', atividade: 'Calistenia', descricao: 'Barras, paralelas e muito incentivo. Iniciantes são muito bem-vindos.', regras: 'Respeite a vez nas barras.', ...em(0.5, 0.3), bairro: 'Centro', criadorId: 'demo-duda', membros: [], membrosBase: 74, criadoEm: 0 },
    { id: 'c3', nome: 'Trilha de Domingo', atividade: 'Trilha', descricao: 'Trilhas de nível fácil e médio perto da cidade, com carona combinada no grupo.', regras: 'Calçado fechado e protetor solar.', ...em(1.1, -1.2), bairro: 'Canto', criadorId: 'demo-leo', membros: [], membrosBase: 121, criadoEm: 0 },
    { id: 'c4', nome: 'Futevôlei na Areia', atividade: 'Futevôlei', descricao: 'Rachões no fim da tarde. Todos os níveis.', regras: 'Bola de cada um, rede do grupo.', ...em(-1, 0.7), bairro: 'Vila', criadorId: 'demo-bia', membros: [], membrosBase: 58, criadoEm: 0 },
  ];
  const encontros: Encontro[] = [
    { id: 'e1', comunidadeId: 'c1', organizadorId: 'demo-rafa', titulo: 'Longão de sábado, 8 km', descricao: 'Ritmo confortável, volta no lago.', local: 'Portão principal do parque', inicio: dia(2, 7), fim: dia(2, 8, 30), vagas: 40, caucao: 0, prazoCancelH: 2, presencas: [] },
    { id: 'e2', comunidadeId: 'c2', organizadorId: 'demo-duda', titulo: 'Aula experimental de calistenia', descricao: 'Primeira aula com a Duda: aquecimento, base e primeira barra.', local: 'Barras da praça central', inicio: dia(1, 18), fim: dia(1, 19), vagas: 8, caucao: 50, prazoCancelH: 6, presencas: [] },
    { id: 'e3', comunidadeId: 'c3', organizadorId: 'demo-leo', titulo: 'Trilha da Pedra, nível fácil', descricao: 'Cerca de 2 h de caminhada com mirante no fim.', local: 'Estacionamento da entrada da trilha', inicio: dia(3, 7, 30), fim: dia(3, 11), vagas: 20, caucao: 30, prazoCancelH: 12, presencas: [] },
  ];
  const trocas: Troca[] = [
    { id: 't1', donoId: 'demo-marta', titulo: 'Mudas de costela-de-adão', descricao: 'Tenho três mudas enraizadas, em vasinho.', estado: 'novo', preco: 15, fotos: [], ...em(0.2, -0.3), bairro: 'Centro', criadoEm: Date.now() - 2 * 3600_000, status: 'disponivel' },
    { id: 't2', donoId: 'demo-joao', titulo: 'Geladeira antiga funcionando', descricao: 'Funciona, só faz um barulho. Quem levar retira aqui, não tenho como entregar.', estado: 'usado', preco: 30, fotos: [], ...em(-0.6, 0.4), bairro: 'Vila', criadoEm: Date.now() - 26 * 3600_000, status: 'disponivel' },
    { id: 't3', donoId: 'demo-carla', titulo: 'Cama de solteiro com estrado', descricao: 'Madeira boa, um pé com marca. Desmontada.', estado: 'usado', preco: 40, fotos: [], ...em(0.9, 0.5), bairro: 'Centro', criadoEm: Date.now() - 5 * 3600_000, status: 'disponivel' },
    { id: 't4', donoId: 'demo-paulo', titulo: 'Caixa de brinquedos de bebê', descricao: 'Chocalhos, blocos e livrinhos de pano, tudo lavado.', estado: 'usado', preco: 25, fotos: [], ...em(-0.3, -1.1), bairro: 'Jardim', criadoEm: Date.now() - 50 * 3600_000, status: 'disponivel' },
    { id: 't5', donoId: 'demo-ana', titulo: 'Bicicleta aro 26 precisando de câmara', descricao: 'Quadro ótimo, pneu traseiro furado.', estado: 'usado', preco: 120, fotos: [], ...em(1.2, -0.6), bairro: 'Jardim', criadoEm: Date.now() - 8 * 3600_000, status: 'disponivel' },
  ];
  return { comunidades, encontros, trocas };
}
