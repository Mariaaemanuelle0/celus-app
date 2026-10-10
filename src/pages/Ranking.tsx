import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Moeda, Voltar } from '../components/ui';
import { PERIODOS, PREMIOS_RANKING, periodoAnterior, periodoDe, type Periodo } from '../lib/regras';
import { comercioDe, ranking, type Participante, type Tipo } from '../lib/ranking';
import { useDB, useUsuario } from '../store/db';

const DO: Record<Periodo, string> = { semana: 'da semana', mes: 'do mês', ano: 'do ano' };
const PASSADO: Record<Periodo, string> = { semana: 'da semana passada', mes: 'do mês passado', ano: 'do ano passado' };

function Avatar({ x }: { x: Participante }) {
  return <span className="avatar mini">{x.foto ? <img src={x.foto} alt="" /> : x.nome.slice(0, 1)}</span>;
}

function fechaEm(fim: number): string {
  const h = Math.max(0, (fim - Date.now()) / 3600_000);
  return h < 24 ? `Fecha em ${Math.ceil(h)} h` : `Fecha em ${Math.ceil(h / 24)} dias`;
}

/** Pódio do período que fechou: 2º, 1º e 3º lado a lado, com a coroa no campeão. */
function Podio({ top, p }: { top: Participante[]; p: Periodo }) {
  const ordem = [1, 0, 2].filter((i) => top[i]);
  return (
    <div className="podio">
      {ordem.map((i) => (
        <div key={top[i].id} className={`podio-lugar p${i + 1}`}>
          {i === 0 && <span className="coroa" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg></span>}
          <Avatar x={top[i]} />
          <b className="podio-nome">{top[i].nome}</b>
          <span className="num hint">{top[i].pontos} celus</span>
          <span className="podio-degrau num">{i + 1}º</span>
          <span className="podio-premio"><Moeda tamanho={12} /> +{PREMIOS_RANKING[p][i]}</span>
        </div>
      ))}
    </div>
  );
}

export function RankingPage() {
  const u = useUsuario()!;
  const usuarios = useDB((d) => d.usuarios);
  const carteiras = useDB((d) => d.carteiras);
  const anuncios = useDB((d) => d.anuncios);
  const locaisSaude = useDB((d) => d.locaisSaude);
  const souComercio = !!comercioDe({ anuncios, locaisSaude }, u.id);
  const [tipo, setTipo] = useState<Tipo>(souComercio ? 'comercios' : 'pessoas');
  const [p, setP] = useState<Periodo>('semana');
  const d = { usuarios, carteiras, anuncios, locaisSaude };
  const aoVivo = ranking(d, tipo, p);
  const anterior = periodoAnterior(p);
  const coroados = ranking(d, tipo, p, anterior.ini).slice(0, 3);
  const minhaPos = aoVivo.findIndex((x) => x.id === u.id);
  const visiveis = aoVivo.slice(0, 20);

  const linha = (x: Participante, pos: number) => (
    <div key={x.id} className={`rk-linha ${x.id === u.id ? 'voce' : ''}`}>
      <span className="rk-pos num">{pos + 1}</span>
      <Avatar x={x} />
      <span className="sp" style={{ minWidth: 0 }}><b className="rk-nome">{x.nome}{x.id === u.id ? ' (você)' : ''}</b><span className="hint">{x.sub}</span></span>
      <span className="num rk-pts">{x.pontos}</span>
    </div>
  );

  return (
    <>
      <Voltar para="/perfil" />
      <h1>Ranking</h1>
      <p className="lead">Quem mais ganha celus usando a Celus. O placar é ao vivo; no fim de cada semana, mês e ano o pódio é coroado e leva celus de prêmio.</p>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg"><button aria-pressed={tipo === 'pessoas'} onClick={() => setTipo('pessoas')}>Pessoas</button><button aria-pressed={tipo === 'comercios'} onClick={() => setTipo('comercios')}>Comércios</button></div>
        <div className="seg">{(Object.keys(PERIODOS) as Periodo[]).map((k) => <button key={k} aria-pressed={p === k} onClick={() => setP(k)}>{PERIODOS[k]}</button>)}</div>
      </div>

      {minhaPos >= 0 ? (
        <div className="walletmini rk-voce">
          <span><span className="eyebrow" style={{ display: 'block' }}>Sua posição {DO[p]}</span><b className="num" style={{ fontSize: 22, fontWeight: 500 }}>{minhaPos + 1}º</b> <span className="hint">com {aoVivo[minhaPos].pontos} celus</span></span>
          <span className="hint" style={{ textAlign: 'right' }}>{minhaPos === 0 ? 'Você lidera!' : `Faltam ${aoVivo[minhaPos - 1].pontos - aoVivo[minhaPos].pontos + 1} para o ${minhaPos}º`}</span>
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 14 }}>{tipo === 'comercios' ? <>Você aparece no ranking de pessoas. Tem comércio, espaço ou academia? <Link to="/renda/anunciar">Anuncie</Link> e ganhe 100 celus quando a curadoria aprovar.</> : 'Sua conta anuncia na Celus, então você aparece no ranking dos comércios.'}</p>
      )}

      <h2>Campeões {PASSADO[p]}</h2>
      <div className="box rk-coroa"><Podio top={coroados} p={p} /></div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}><h2 style={{ margin: 0 }}><span className="aovivo" aria-hidden="true" /> Ao vivo</h2><span className="hint">{fechaEm(periodoDe(p).fim)}</span></div>
      <div className="box rk-lista">
        {visiveis.map(linha)}
        {minhaPos >= 20 && <><div className="rk-reti" aria-hidden="true">···</div>{linha(aoVivo[minhaPos], minhaPos)}</>}
      </div>

      <h2>Prêmios</h2>
      <div className="box" style={{ padding: '4px 14px' }}>
        {(Object.keys(PERIODOS) as Periodo[]).map((k) => <div key={k} className="sumline"><span>{PERIODOS[k]}</span><span>{PREMIOS_RANKING[k].join(' / ')}</span></div>)}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Celus de prêmio para o 1º, 2º e 3º lugar, em pessoas e em comércios. Conta só o que você ganha usando o app: prêmios, loteria e celus recebidos em trocas e cauções não entram na pontuação.</p>
    </>
  );
}
