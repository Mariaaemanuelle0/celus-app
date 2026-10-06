// Banco de dados do MODO DEMONSTRAÇÃO: tudo fica salvo neste aparelho (localStorage).
// Quando o Supabase for ligado, estas ações passam a chamar o servidor; as telas não mudam.
import { useSyncExternalStore } from 'react';
import type {
  Anuncio, Avaliacao, Beneficio, Carteira, Denuncia, MarcaSemaforo, MensagemChat, Notificacao, Reserva, Story, Usuario,
} from '../data/types';
import { anunciosFicticios } from '../data/seed';
import { centroPiloto } from '../lib/geo';
import { GANHOS } from '../lib/regras';

export type DB = {
  versao: 1;
  sessao: string | null;
  usuarios: Record<string, Usuario>;
  anuncios: Anuncio[];
  reservas: Reserva[];
  avaliacoes: Avaliacao[];
  sonhos: { userId: string; anuncioId: string }[];
  stories: Story[];
  checkins: { userId: string; anuncioId: string; t: number }[];
  curtidas: { userId: string; postId: string }[];
  chat: MensagemChat[];
  semaforo: MarcaSemaforo[];
  carteiras: Record<string, Carteira>;
  beneficios: Beneficio[];
  denuncias: Denuncia[];
  notificacoes: Notificacao[];
};

const CHAVE = 'celus-db-v1';
const MIN = 60_000;

export const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function inicial(): DB {
  const anuncios = anunciosFicticios();
  const agora = Date.now();
  const st = (anuncioId: string, autorNome: string, min: number, legenda: string): Story =>
    ({ id: novoId(), anuncioId, autorId: 'demo-' + autorNome, autorNome, criado: agora - min * MIN, legenda, noPerfil: true });
  return {
    versao: 1, sessao: null, usuarios: {}, anuncios, reservas: [], avaliacoes: [], sonhos: [],
    stories: [
      st('s1', 'Júlia R.', 25, 'Banho quente depois da praia. Salvou o dia.'),
      st('s8', 'Pedro L.', 70, 'Aniversário da Bia começando.'),
      st('s6', 'Nina P.', 15, 'Pão de queijo e Wi-Fi bom. Rendeu a tarde.'),
      st('s3', 'Carol M.', 140, 'Cochilo depois do almoço.'),
    ],
    checkins: [], curtidas: [], chat: [], semaforo: [], carteiras: {},
    beneficios: [
      { id: 'b-ext30', grupo: 'celus', nome: '30 minutos extras grátis', desc: 'Em qualquer reserva por hora.', custo: 150 },
      { id: 'b-camp', grupo: 'celus', nome: 'Campanha Celus do mês', desc: 'Cupons e sorteios da campanha em andamento.', custo: 80 },
      { id: 'b-luau', grupo: 'evento', nome: 'Ingresso para evento Celus', desc: 'Evento promovido pela Celus na cidade piloto.', custo: 100 },
      { id: 'b-bola', grupo: 'evento', nome: 'Aluguel de bola na praia', desc: '1 hora, retirada em ponto parceiro.', custo: 20 },
      { id: 'b-v1', grupo: 'local', anuncioId: 's1', nome: 'Toalha grátis', desc: 'No vestiário com chuveiro quente.', custo: 20 },
      { id: 'b-v2', grupo: 'local', anuncioId: 's6', nome: 'Café de brinde', desc: 'No Wi-Fi na varanda do café.', custo: 30 },
      { id: 'b-dest', grupo: 'anfitriao', nome: 'Anúncio em destaque por 24 h', desc: 'Seu espaço aparece primeiro no mapa e no feed.', custo: 400 },
      { id: 'b-com', grupo: 'anfitriao', nome: 'Comissão 2 pontos menor por 30 dias', desc: 'De 15% para 13%. Uma vez por mês, no máximo.', custo: 600 },
      { id: 'b-campa', grupo: 'anfitriao', nome: 'Entrar na campanha Celus do mês', desc: 'Seu espaço aparece nos posts e eventos da campanha.', custo: 250 },
    ],
    denuncias: [],
    notificacoes: [],
  };
}

function carregar(): DB {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.versao === 1) {
        db.notificacoes ??= [];
        for (const a of anunciosFicticios()) if (!db.anuncios.some((x) => x.id === a.id)) db.anuncios.push(a);
        return db;
      }
    }
  } catch { /* armazenamento indisponível: começa do zero */ }
  return inicial();
}

let db: DB = carregar();
const ouvintes = new Set<() => void>();

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* sem espaço ou bloqueado */ }
}

/** Altera o banco de forma imutável e avisa as telas. */
export function mudar(fn: (d: DB) => void) {
  const copia = structuredClone(db);
  fn(copia);
  db = copia;
  salvar();
  ouvintes.forEach((o) => o());
}

export const ler = () => db;

export function useDB<T>(sel: (d: DB) => T): T {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => sel(db));
}

export function useUsuario(): Usuario | null {
  return useDB((d) => (d.sessao ? d.usuarios[d.sessao] ?? null : null));
}

export function apagarTudo() {
  db = inicial();
  salvar();
  ouvintes.forEach((o) => o());
}

/* ---------- Carteira de celus ---------- */
const hojeStr = () => new Date().toISOString().slice(0, 10);

export function carteiraDe(d: DB, userId: string): Carteira {
  return d.carteiras[userId] ?? { saldo: 0, hist: [], hoje: { dia: hojeStr(), contagem: {} }, vales: [] };
}

/** Credita celus respeitando o limite diário da regra. Retorna o valor creditado (0 se bateu o limite). */
export function ganhar(d: DB, userId: string, chave: string, txt: string, vezes = 1): number {
  const regra = GANHOS.find((g) => g.chave === chave);
  if (!regra) return 0;
  const c = carteiraDe(d, userId);
  if (c.hoje.dia !== hojeStr()) c.hoje = { dia: hojeStr(), contagem: {} };
  const ja = c.hoje.contagem[chave] ?? 0;
  const permitido = regra.limite ? Math.max(0, Math.min(vezes, regra.limite - ja)) : vezes;
  if (!permitido) { d.carteiras[userId] = c; return 0; }
  c.hoje.contagem[chave] = ja + permitido;
  const v = regra.v * permitido;
  c.saldo += v;
  c.hist.unshift({ t: Date.now(), txt, v });
  d.carteiras[userId] = c;
  return v;
}

export const centroInicial = centroPiloto;

/* ---------- Notificações dentro do app ---------- */
export function notificar(d: DB, userId: string | undefined, txt: string, link?: string) {
  if (!userId || userId === 'celus-demo' || userId.startsWith('demo-')) return;
  d.notificacoes.unshift({ id: novoId(), userId, t: Date.now(), txt, link, lida: false });
  if (d.notificacoes.length > 300) d.notificacoes.length = 300;
}
