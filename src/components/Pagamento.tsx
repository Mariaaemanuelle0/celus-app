import { useState } from 'react';
import { brl } from '../lib/format';
import { useUsuario } from '../store/db';
import type { Pagamento as Metodo } from '../store/acoes';

/** Pagamento em ambiente de teste. Pix é o padrão; cartão é opção. Nada é cobrado de verdade. */
export function Pagamento({ total, titulo, onPagar, onFechar }: { total: number; titulo: string; onPagar: (m: Metodo) => void; onFechar: () => void }) {
  const u = useUsuario();
  const [metodo, setMetodo] = useState<Metodo>(u?.ultimoPagamento ?? 'pix');
  const [pix, setPix] = useState(false);
  const codigo = '00020126CELUS-TESTE-' + Math.round(total * 100);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Pagamento" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal-in">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <h2 className="sp" style={{ margin: 0 }}>{pix ? 'Pague com Pix' : 'Como você quer pagar?'}</h2>
          <button className="x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className="meta" style={{ margin: '6px 0 16px' }}>{titulo}</p>

        {!pix ? (
          <>
            <div className="metodos" role="radiogroup" aria-label="Forma de pagamento">
              <button role="radio" aria-checked={metodo === 'pix'} className="metodo" onClick={() => setMetodo('pix')}>
                <b>Pix</b><span>Aprovado na hora</span>
              </button>
              <button role="radio" aria-checked={metodo === 'cartao'} className="metodo" onClick={() => setMetodo('cartao')}>
                <b>Cartão de crédito</b><span>{u?.ultimoPagamento ? 'Cartão salvo' : 'Cartão de teste'} terminado em 4242. Paga com um toque</span>
              </button>
            </div>
            <div className="sumline" style={{ marginTop: 14 }}><span>Total</span><span>{brl(total)}</span></div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => (metodo === 'pix' ? setPix(true) : onPagar('cartao'))}>
              {metodo === 'pix' ? 'Gerar Pix' : `Pagar ${brl(total)}`}
            </button>
          </>
        ) : (
          <>
            <div className="qr" aria-label="QR Code de teste"><QR semente={codigo} /></div>
            <div className="copia"><span className="num">{codigo}</span><button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(codigo)}>Copiar</button></div>
            <div className="sumline" style={{ marginTop: 8 }}><span>Total</span><span>{brl(total)}</span></div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => onPagar('pix')}>Simular Pix recebido</button>
          </>
        )}
        <p className="hint" style={{ marginTop: 12 }}>Ambiente de teste: nenhum valor é cobrado. O pagamento real entra quando o gateway for ligado.</p>
      </div>
    </div>
  );
}

/** Desenho de QR só ilustrativo (não é um QR válido). */
function QR({ semente }: { semente: string }) {
  let h = 0; for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = 21, cel: boolean[] = [];
  for (let i = 0; i < n * n; i++) { h = (h * 1103515245 + 12345) >>> 0; cel.push(((h >> 16) & 1) === 1); }
  const olho = (x: number, y: number) => <g key={`${x}${y}`}><rect x={x} y={y} width="7" height="7" fill="#03050A" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#03050A" /></g>;
  const naQuina = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width="168" height="168" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      {cel.map((on, i) => { const x = i % n, y = Math.floor(i / n); return on && !naQuina(x, y) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#03050A" /> : null; })}
      {olho(0, 0)}{olho(n - 7, 0)}{olho(0, n - 7)}
    </svg>
  );
}
