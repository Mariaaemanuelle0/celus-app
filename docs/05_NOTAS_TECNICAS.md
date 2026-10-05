# Notas técnicas — Celus

## Stack sugerida para o MVP (ajustável conforme preferência)

- **Frontend web/mobile**: React (web) ou React Native/Expo (se quiser um app mobile nativo desde já). Para validar rápido, uma Progressive Web App (PWA) mobile-first em React pode ser suficiente e mais barata de manter que dois apps nativos.
- **Mapa**: Mapbox GL JS ou Google Maps JavaScript API — ambos suportam pins customizados, clustering e geolocalização do usuário.
- **Backend**: Node.js (Express/Fastify) ou um BaaS como Supabase/Firebase para acelerar o MVP (autenticação, banco, storage de imagem já prontos).
- **Banco de dados**: PostgreSQL (recomendado pelo suporte nativo a dados geográficos via extensão PostGIS, útil para busca por raio/proximidade).
- **Armazenamento de mídia**: S3 (ou equivalente) para fotos/vídeos de imóveis e espaços.

## Integrações externas necessárias

### Pagamento
- Precisa de gateway que suporte **cobrança recorrente/autorizada** (tokenização de cartão), para viabilizar o timer com cobrança automática e extensão de tempo com 1 toque.
- Opções no Brasil: **Stripe** (suporta tokenização e cobranças subsequentes) ou **Pagar.me** (gateway nacional, boa documentação, suporta split de pagamento — útil para dividir comissão entre Celus e anfitrião automaticamente).
- Avaliar necessidade de **split de pagamento automático** desde o início (parte vai para o anfitrião, parte fica de comissão Celus) — reduz trabalho manual de repasse.

### Geolocalização
- API de geolocalização do navegador/dispositivo (nativa, sem custo) para "usar minha localização".
- Cálculo de distância: fórmula de Haversine é suficiente para o MVP (não precisa de serviço externo pago só para isso).

### Fechadura digital (fase 2, não bloqueante para o MVP)
- Fechaduras com integração por app geralmente usam plataformas como **TTLock** (fornece SDK/API para gerar senha temporária remotamente).
- Fluxo: reserva confirmada → API da fechadura gera senha válida só na janela de horário paga → expira sozinha.

### Moderação de conteúdo (fase 2/3)
- Filtro de palavrão/discurso de ódio: serviços prontos como a **Perspective API** (Google) analisam texto e retornam score de toxicidade — reduz necessidade de lista manual de termos.

## Pontos de atenção de arquitetura

- **Separar claramente dois tipos de "listing"**: os que seguem lógica de reserva por **tempo/pacote** (espaço por hora) dos que seguem lógica de **transação única** (venda) ou **contrato recorrente** (aluguel mensal) — são fluxos de dados e de pagamento diferentes, não force o mesmo modelo para os três.
- **Design para multi-tenant desde o início** (ainda que não use agora): caso o produto expanda para múltiplas cidades, é mais barato já estruturar `listing.cidade_id` desde o começo do que migrar depois.
- **Auditoria/logs de acesso**: para qualquer fluxo que envolva fechadura digital ou responsável local, registrar timestamp de entrada/saída — vira prova em caso de disputa futura.
- **Rate limiting e abuso**: qualquer endpoint de chat ou avaliação precisa de limite de requisições por usuário/IP desde o MVP, mesmo que a moderação completa só venha depois.

## O que explicitamente NÃO integrar no MVP

- Nenhuma API de IA (Anthropic ou outra) — fase futura.
- Nenhuma API de realidade aumentada (ARCore Geospatial ou similar) — fase 8.
- Nenhum sistema de moeda interna com conversão em dinheiro real.
