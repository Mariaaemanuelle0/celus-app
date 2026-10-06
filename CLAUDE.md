# Celus — instruções do projeto

Celus é uma plataforma com mapa que conecta pessoas a espaços e serviços por perto: espaço por hora (banheiro, descanso, trabalho, estacionamento), estadias, eventos, imóveis e profissionais freelancers. Duas camadas no mesmo app: **Procurar** (quem usa) e **Rentabilizar** (quem anuncia).

Leia antes de qualquer tarefa:
- `docs/DECISOES.md` — decisões de produto já tomadas com a fundadora. **Prevalece sobre o pacote original quando houver conflito.**
- `docs/01_VISAO_E_MARCA.md` a `docs/05_NOTAS_TECNICAS.md` — pacote original do projeto.
- `docs/prototipo-celus.html` — protótipo navegável aprovado (referência de telas, fluxos e regras). Abra no navegador.

## Regras de trabalho
- Construir por etapas, na ordem de `docs/DECISOES.md` > "Ordem de construção". Uma etapa por vez, testável no celular.
- Mobile-first. O app é uma PWA (web app instalável) antes de ir para as lojas.
- Código simples e funcional. Sem dependência nova sem motivo claro.
- Textos da interface em português do Brasil, tom direto e caloroso, sem travessões.
- Nunca commitar chaves. Variáveis em `.env` (modelo em `.env.example`).
- Pagamentos, login e dados pessoais (LGPD) passam por revisão humana antes de abrir ao público.

## Stack
- Front: React + TypeScript + Vite, React Router, PWA (vite-plugin-pwa).
- Mapa: MapLibre GL (vetorial, gira e inclina), estilo próprio em `src/lib/estiloMapa.ts` com dados do OpenStreetMap via OpenFreeMap. Para Mapbox, definir `VITE_MAP_STYLE_URL`.
- Back: Supabase (auth, Postgres com PostGIS, storage). Schema em `supabase/migrations/`.
- Sem Supabase configurado, o app usa dados fictícios de `src/data/seed.ts`.
- Pagamento (etapa 4): Pagar.me ou Stripe com split. Ainda não integrado.

## Comandos
- `npm run dev` — servidor local
- `npm run build` — checagem de tipos + build de produção
- `npm run teste:fluxos` — testes de ponta a ponta (com `npm run preview` rodando; outro endereço via `CELUS_URL`). Rodar antes de cada publicação. Na primeira vez: `npx playwright install chromium`.

## Identidade visual
Preto e azul-marinho com acento azul elétrico. Tokens em `src/styles/tokens.css`. Fontes: Unbounded (títulos), Instrument Sans (texto), JetBrains Mono (números, preços, timer).
