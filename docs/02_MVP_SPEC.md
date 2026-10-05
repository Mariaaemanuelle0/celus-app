# Especificação do MVP — Celus V1

Objetivo do MVP: provar a experiência básica num território piloto (ex.: uma cidade/região), sem IA, sem automação avançada, sem painel B2B.

## Telas principais

### 1. Mapa (busca direcionada)
- Estilo GPS: zoom, arraste, ordenação por proximidade do usuário (geolocalização do navegador/app).
- Seleção de **modo macro** antes dos filtros finos (ver `03_REGRAS_DE_NEGOCIO.md` para a árvore completa):
  - Ficar (quarto, temporada, casa de evento, motorhome)
  - Resolver agora (banho, rede, cabine)
  - Se manter ativo (academia — opcional no MVP, pode ficar pra fase 2)
  - Descobrir (eventos — opcional no MVP)
- No MVP mínimo, pode-se lançar só com **Ficar** + **Resolver agora** + categoria complementar de imóvel (venda/aluguel).
- Pins coloridos por modo, com valor visível. Seta de alta/baixa de preço e estrela de destaque são "nice to have", não bloqueantes.
- Filtro por avaliação mínima, faixa de preço, distância.

### 2. Feed (descoberta passiva)
- Tela inicial estilo rede social: cards de imóvel, espaço, conteúdo.
- Cada card leva à ficha/reserva correspondente.
- No MVP, pode ser alimentado manualmente (você e seu time postando), sem depender de conteúdo gerado por usuário ainda.

### 3. Ficha do espaço/imóvel
- Fotos, descrição, localização, preço (pacotes 1h/3h/6h ou diária), avaliação em dois eixos (qualidade + custo-benefício).
- Botão de reserva.
- Manual de bons modos (texto livre que o anfitrião preenche: regras, como deixar o local).

### 4. Fluxo de reserva (para espaço por hora)
- Usuário escolhe pacote de tempo → confirma pagamento (cartão salvo) → recebe forma de acesso (ver tipo de acesso no cadastro: fechadura digital / responsável local / presencial).
- Timer visível na tela durante o uso, com aviso 20 min antes do fim.
- Extensão de tempo com 1 toque (cobrança automática adicional).
- Excedente: cobrança por minuto após carência de 3–5 min, com teto máximo (ex.: 2x o valor da hora).

### 5. Avaliação pós-uso
- Dois eixos: qualidade objetiva (limpeza, funcionou como anunciado) e custo-benefício (valeu o preço, dentro da categoria de expectativa do anúncio).
- Para espaços sem serviço de limpeza contratado: campo extra de "deixou como recebeu" (sim/não + comentário opcional).
- Avaliação bilateral: anfitrião também avalia o usuário.

### 6. Perfil do usuário
- Dois perfis possíveis na mesma conta: **pessoal** (quem busca/reserva) e **imobiliário/locador** (quem anuncia).
- Perfil pessoal: foto, bio, histórico de reservas, avaliações recebidas, **livro dos sonhos** (ver abaixo).
- Perfil locador: carteira de espaços/imóveis cadastrados, avaliação como anfitrião.

### 7. Livro dos sonhos (versão básica para o MVP)
- Usuário pode "salvar" (tipo Pinterest) qualquer imóvel/espaço do mapa/feed em um álbum pessoal.
- Contador simples de "X pessoas sonham com este lugar", visível para o proprietário e (se o anúncio permitir) para outros usuários.
- Privacidade: álbum privado por padrão; usuário escolhe tornar público.
- **Fora do MVP** (fase futura): efeito perfil verificado/celebridade, promoções segmentadas para quem salvou, notificação por data comemorativa.

### 8. Cadastro de espaço (lado do anfitrião)
Campos mínimos:
- Tipo (venda, aluguel residencial, temporada, espaço por hora, motorhome)
- Fotos (mínimo 1, recomendado 3+)
- Localização (endereço + coordenadas)
- Preço: pacotes fixos por tempo (ex.: 1h / 3h / 6h) para espaço por hora; valor único para venda/aluguel
- Capacidade máxima (para espaços comunitários/grupo)
- Tipo de acesso: fechadura digital / responsável local (nome + contato) / presencial
- Manual de bons modos (texto livre)
- Status: pendente de aprovação → aprovado (curadoria manual no início, feita por você)

## Fora do escopo do MVP (não construir ainda)

- IA de busca por linguagem natural ou chat
- Painel B2B / Celus Empresas
- Programa de pontos e trocas
- Motor de retenção algorítmico (ranking automático, taxa decrescente)
- Story de 1h, outdoor virtual (AR), chat de quadrante
- Três modelos de credenciado (no MVP, curadoria e aprovação são manuais, feitas por você)
- Contratação hiperlocal "disponível agora" de profissional freelance (pode ser fase 2, logo após o MVP validar)

## Fluxo de dados mínimo (entidades principais)

- `User` (id, nome, foto, bio, tipo_perfil_ativo, criado_em)
- `Listing` (id, owner_id, tipo, titulo, descricao, fotos[], lat, lng, preco_base, pacotes[], capacidade_max, tipo_acesso, manual_boas_vindas, status)
- `Booking` (id, listing_id, user_id, pacote_escolhido, inicio, fim_previsto, fim_real, valor_total, status)
- `Review` (id, booking_id, autor_id, alvo_id, nota_qualidade, nota_custo_beneficio, comentario, deixou_como_recebeu)
- `DreamBookEntry` (id, user_id, listing_id, criado_em, publico_bool)
