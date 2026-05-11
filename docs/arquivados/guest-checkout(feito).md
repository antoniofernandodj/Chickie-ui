# Guest Checkout — Pedido sem Cadastro

> Análise técnica e estratégica para implementação de pedidos por usuários não autenticados na plataforma Chickie.

---

## Contexto

Permitir que um cliente faça um pedido sem precisar criar conta na plataforma. O histórico de pedidos fica armazenado localmente no dispositivo e os pedidos são enviados normalmente para a loja.

---

## 1. Vantagens

| Benefício | Impacto |
|---|---|
| Redução da taxa de abandono | Cliente com fome quer rapidez — cada etapa extra de login é uma saída potencial |
| Barreira de entrada baixa | Atrai novos usuários que ainda não confiam o suficiente para entregar seus dados |
| Sensação de privacidade | Muitos usuários evitam criar contas para não receber spam |

---

## 2. Implementação Técnica

### A. Persistência no Dispositivo (Client-Side)

- Gerar um **UUID de convidado** no primeiro acesso e salvar no `localStorage` / `IndexedDB`
- Ao finalizar pedido, salvar localmente: UUID do pedido, código de rastreamento, itens, total
- Salvar também últimos endereços e nome de contato para agilizar pedidos futuros sem redigitar

### B. Rastreamento do Pedido (Server-Side)

Dois mecanismos complementares:

1. **Token temporário**: ao confirmar o pedido, o servidor retorna um JWT de vida curta. O dispositivo usa esse token para consultar o status via polling.
2. **Link de acompanhamento**: enviar um link único via WhatsApp ou SMS. Garante que o cliente recupere o acesso ao status mesmo se limpar o cache do navegador/app.

### C. Migração Convidado → Usuário (Upselling)

Após a conclusão do pedido, exibir call-to-action suave:

> _"Pedido realizado! Quer salvar seus dados para ganhar desconto na próxima vez? Basta escolher uma senha."_

- Aproveitar os dados já preenchidos (nome, telefone, endereço) para pré-preencher o formulário de cadastro
- Associar o histórico de pedidos do convidado ao novo usuário após conversão

---

## 3. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Perda do histórico se o usuário limpar o cache | Aviso discreto na UI: _"Como você não está logado, seu histórico fica disponível apenas neste aparelho"_ |
| Dificuldade de remarketing / programa de fidelidade | Coletar ao menos o telefone — suficiente para WhatsApp e campanhas |
| Pedidos falsos (trotes) | Validar o número de telefone por código SMS ou mensagem WhatsApp antes de enviar à cozinha |
| Rastreio sem conta | Link único de acompanhamento enviado por WhatsApp resolve o caso de perda de localStorage |

---

## 4. Fluxo Sugerido

```
Cliente abre a loja (deslogado)
        │
        ▼
Monta o carrinho normalmente
        │
        ▼
Checkout: preenche nome + telefone + endereço
        │
        ▼
Validação do telefone via WhatsApp (código OTP)
        │
        ▼
Pedido enviado → servidor retorna código + token
        │
        ├── Token salvo no localStorage
        └── Link de rastreamento enviado via WhatsApp
              │
              ▼
        Página /pedidos/:codigo acessível pelo link
```

---

## 5. Veredito

**Vale a pena implementar.** Para uma plataforma em crescimento competindo com grandes players, reduzir fricção na conversão é prioridade. A validação por WhatsApp (OTP) é o ponto de equilíbrio ideal: garante um contato real com o cliente sem exigir cadastro formal, e já entrega o link de rastreamento no canal mais usado pelo público-alvo do delivery brasileiro.

### Prioridade de implementação sugerida

1. `[AGORA]` Aceitar pedido com campos livres (nome + telefone) sem autenticação
2. `[AGORA]` Salvar pedido no `localStorage` e exibir na tela `/pedidos`
3. `[BREVE]` Link de rastreamento via WhatsApp ao confirmar pedido
4. `[DEPOIS]` Validação OTP por WhatsApp antes de enviar à cozinha
5. `[DEPOIS]` Fluxo de migração convidado → conta registrada com histórico associado
