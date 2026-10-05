# Regras de negócio — Celus

## Arquitetura de filtros do mapa

### Camada 1 — modo macro (seleção única por padrão, com opção "todos")
- **Ficar**: quarto, temporada, casa de evento, motorhome
- **Resolver agora**: banho, rede, wifi, cabine
- **Se manter ativo**: academia, crossfit, yoga
- **Descobrir**: eventos, shows, lançamentos, corrida

### Camada 2 — filtros específicos por modo
- Ficar → preço, datas, nº de hóspedes, tipo de imóvel
- Resolver agora → duração, preço/hora, capacidade individual ou grupo
- Se manter ativo → tipo de atividade, horário disponível, preço por sessão
- Descobrir → data do evento, tipo, gratuito/pago

### Camada 3 — filtros universais
- Distância/raio a partir da localização do usuário
- Avaliação mínima
- Faixa de preço

Pins são coloridos por modo macro (não por subtipo, para não gerar excesso de cores).

## Precificação de espaço por hora

- Pacotes fixos definidos pelo anfitrião, com desconto progressivo por tempo (ex.: 1h = R$10 / 3h = R$25 / 6h = R$50).
- Reserva por pacote fechado (evita cálculo de fração de tempo no MVP).
- Preço por pessoa em espaços comunitários (ex.: R$5/pessoa em banho e rede compartilhados) — capacidade máxima declarada pelo anfitrião vira filtro de busca.
- Preço dinâmico: ajuste manual do anfitrião a qualquer momento; gatilhos automáticos (clima, horário de pico, evento local) são fase futura. Mudança de preço vale só para a **próxima** reserva, nunca para uma já confirmada.

## Cobrança e timer

- Cobrança automática via cartão/token salvo no momento da reserva.
- Aviso push 20 minutos antes do fim do tempo contratado, com opção de estender com 1 toque.
- Excedente de tempo: cobrança por minuto após carência de 3–5 minutos (evita punir quem só demorou um pouco a mais).
- Teto máximo de multa por excedente (ex.: até 2x o valor da hora) — protege a reputação da plataforma contra percepção de abuso.
- Gateway de pagamento precisa suportar cobrança recorrente/autorizada (ex.: Stripe, Pagar.me) — ver `05_NOTAS_TECNICAS.md`.

## Avaliação em dois eixos

- **Qualidade objetiva**: limpeza, funcionamento, fidelidade ao anunciado.
- **Custo-benefício**: se valeu o preço pago, comparado dentro da própria categoria de expectativa do anúncio (ex.: "básico e barato" não é comparado com "conforto premium").
- Nota baixa em custo-benefício sinaliza preço desalinhado; nota baixa em qualidade sinaliza problema real a corrigir.
- Para espaços sem limpeza contratada: avaliação extra de "deixou como recebeu" — cria pressão social pra devolver o espaço em ordem.

## Curadoria e segurança

- Aprovação manual de todo anúncio antes de publicar (feita pela equipe Celus no início).
- Avaliação bilateral obrigatória (usuário avalia espaço/anfitrião e vice-versa).
- Filtro de nota mínima disponível pro usuário buscar; corte automático de anúncio com nota baixa só quando houver volume suficiente de dados.
- Verificação de documento obrigatória para categorias mais sensíveis (quarto avulso em casa habitada, temporada).
- **Princípio inegociável**: nenhuma categoria de espaço deve colocar duas pessoas desconhecidas sozinhas dentro de um ambiente íntimo fechado. Priorizar espaços com acesso independente ou natureza comercial.

## Tipos de acesso ao espaço/imóvel

| Situação | Solução |
|---|---|
| Prédio com portaria | App notifica a portaria sobre o horário autorizado |
| Espaço com fechadura digital | Senha temporária de uso único, gerada por reserva, expira automaticamente |
| Proprietário não quer mexer na fechadura | Combinado com responsável local (vizinho, síndico), registrado no cadastro |
| Chave em imobiliária parceira | Corretor retira e devolve, com registro de horário no app |

## Regra de "catraca livre" (verificação de estado do espaço)

- Proprietário pode permitir até 5 locações consecutivas sem supervisão presencial.
- A partir da 6ª locação consecutiva sem supervisão, o sistema exige verificação (pelo próprio proprietário ou por um "verificador" contratado via app) antes de liberar novas reservas.

## Programa de pontos (fase 2, não MVP — documentado aqui para referência futura)

- Cliente final acumula pontos por transação concluída (compra, aluguel, reserva de espaço) e por contribuição de conteúdo (foto/comentário do local).
- Resgate em benefícios dentro da plataforma: desconto em diária, prioridade de reserva, outdoor virtual (fase AR).
- Pontos **nunca** conversíveis diretamente em dinheiro — evita enquadramento como moeda virtual regulada pelo Banco Central.
- Corretor/anfitrião tem dois mecanismos de incentivo: taxa decrescente por fidelidade (longo prazo) e bônus por meta batida em janela de tempo (curto prazo, ex.: trimestre).

## Modelos de credenciado (fase 2 em diante — documentado aqui para referência)

1. **Credenciado de tarefa** (estilo Uber): limpeza, verificação, serviços freelance (garçom, tosador, barman). Chamado por demanda, sem vínculo contínuo, com limite de jornada (ex.: não pode ficar 12h consecutivas ativo).
2. **Influencer-gestor**: cuida da estrutura de um espaço e também produz conteúdo; comissão sobre desempenho de reserva, não só engajamento.
3. **Corretor da casa**: venda/aluguel residencial de maior valor. Vínculo contratual, CRECI ativo quando envolver venda, contrato de exclusividade com o proprietário, metas de conversão acompanhadas.

### Contratação hiperlocal "disponível agora" (fase 2)
- Profissional ativa status "disponível agora" + raio de atuação + habilidades específicas.
- Contratante publica necessidade urgente; sistema retorna candidatos por proximidade e avaliação.
- Precedente validado: Waitro (Brasil) e Bartinder (EUA) já operam esse modelo para garçom/bartender.
