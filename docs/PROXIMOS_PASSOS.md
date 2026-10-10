# Onde paramos (08/10/2026)

App no ar: https://celus-app.vercel.app (cada push na main publica sozinho na Vercel).

## Pronto
- Mapa (MapLibre), Procurar e Rentabilizar, reservas por hora, diárias, profissionais, ingressos com interesse, camping, código de chegada, catraca livre, suporte, cadastro assistido.
- Comunidades com encontros e caução em celus (dentro do Perfil).
- Feira do Polvo: troca de itens por celus, sem doação, mínimo 5 celus (dentro do Perfil).
- Perfil sem seguidores, com blocos visíveis ou ocultos.
- Carteira com celus guardados, referência 1 celus = R$ 1 e a tabela de ganhos de `src/lib/regras.ts`.
- Saúde: parceiros (academias etc.) com QR que muda a cada 30 s, check-in com GPS, bônus de constância.
- Bônus de adesão: comércio, espaço ou academia aprovado ganha 100 celus.
- Ranking de pessoas e comércios (semana, mês, ano), ao vivo, com pódio e prêmios no fechamento (dentro do Perfil).
- Loteria do Mar: escolhe 3 entre 30 elementos do mar, prêmio acumulado, sorteio ao vivo terça, quinta e sábado às 20 h (dentro do Perfil).
- Testes de ponta a ponta em `tests/fluxos/` (todos passando).

## Próximos passos
1. Currículo de freelancer (histórico e estrelas visíveis só para quem contrata).
2. Mostrar comunidades e parceiros de saúde no mapa e no Feed.
3. Supabase (login, banco, QR de saúde conferido no servidor). A fundadora cria a conta; nunca usar a chave service_role.
4. Pagamento real com split (precisa de CNPJ).
5. Termos de uso com o advogado (lista em `docs/DECISOES.md`), incluindo loteria e ranking.
6. Desafios e circuitos de corrida no mapa.

## Como trabalhar
Ler `CLAUDE.md` e `docs/DECISOES.md` antes de tudo. Rodar `npm run build` e os testes (`npm run teste:fluxos` com `npm run preview` rodando) antes de cada push.
