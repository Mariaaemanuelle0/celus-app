// Roda todos os testes de fluxo contra o app (por padrão, o build local em http://localhost:4173).
// Uso: npm run build && npm run preview  (em outro terminal)  e  npm run teste:fluxos
// Para testar o site publicado: CELUS_URL=https://celus-app.vercel.app npm run teste:fluxos
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

fs.mkdirSync(path.join(__dirname, '../../.teste-saida'), { recursive: true });
const arquivos = fs.readdirSync(__dirname).filter((f) => f.endsWith('.cjs') && f !== 'rodar.cjs').sort();
let falhou = 0;
for (const f of arquivos) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', env: process.env, timeout: 300_000 });
  const saida = (r.stdout || '') + (r.stderr || '');
  const problemas = saida.split('\n').filter((l) => l.startsWith('FAIL') || (l.startsWith('errors') && l.trim() !== 'errors []'));
  const ok = r.status === 0 && !problemas.length;
  if (!ok) falhou++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${f}`);
  if (!ok) console.log(problemas.length ? problemas.join('\n') : saida.slice(-1500));
}
console.log(falhou ? `\n${falhou} fluxo(s) com falha.` : '\nTodos os fluxos passaram.');
process.exit(falhou ? 1 : 0);
