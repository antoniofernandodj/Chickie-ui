# Plano de Implementação: Pedido via QR Code (Pedido na Mesa)

Este documento descreve a estratégia para implementar o fluxo de atendimento presencial onde o cliente realiza pedidos escaneando um QR Code na mesa.

## 1. Visão Geral

O objetivo é permitir que estabelecimentos físicos ofereçam um cardápio digital interativo onde o cliente:

1. Escaneia um QR Code único por mesa.
2. Navega pelo cardápio da loja específica.
3. Adiciona itens ao carrinho.
4. Finaliza o pedido sem precisar informar endereço de entrega.
5. O sistema identifica automaticamente a mesa de origem para a cozinha e garçons.

## 2. Estrutura de URL e Roteamento

Para facilitar a geração de QR Codes e a identificação automática, utilizaremos uma estrutura de URL amigável:

- **Padrão:** `/loja/:slug/mesa/:numero`
- **Exemplo:** `https://chickie.app/loja/chiquitos-burguer/mesa/12`

### Alterações no `app.routes.ts`:
```typescript
{
  path: 'loja/:slug/mesa/:numero',
  loadComponent: () => import('./features/loja/loja-detalhe.component')
    .then(m => m.LojaDetalheComponent),
  title: 'Pedido na Mesa — Chiquitos',
},
```

## 3. Mudanças nos Modelos de Dados (Backend & Frontend)

Precisamos estender o objeto de pedido para suportar a identificação da mesa.

### `CreatePedidoRequest` (Frontend -> Backend):
```typescript
export interface CreatePedidoRequest {
  // ... campos existentes
  loja_mesa_uuid?: string; // Opcional: ID interno da mesa se houver cadastro
  numero_mesa?:    string; // Obrigatório no fluxo de QR Code
  tipo_pedido:     'delivery' | 'retirada' | 'mesa';
}
```

### `Pedido` (Interface de Visualização):
```typescript
export interface Pedido {
  // ... campos existentes
  numero_mesa?: string | null;
  tipo_pedido:  'delivery' | 'retirada' | 'mesa';
}
```

## 4. Experiência do Usuário (Fluxo Frontend)

### 4.1. Detalhe da Loja (`LojaDetalheComponent`)
- Capturar o parâmetro `:numero` da rota.
- Armazenar o contexto de "Atendimento em Mesa" no `CartService`.
- Exibir um banner informativo: "✅ Você está na **Mesa 12**".

### 4.2. Gerenciamento de Estado (`CartService`)
O `CartService` será o responsável por persistir o número da mesa durante a sessão de compra.

```typescript
export interface CartState {
  loja: Loja;
  itens: CartItem[];
  mesa?: string; // Adicionado para suporte a QR Code
}
```

### 4.3. Checkout (`CheckoutComponent`)
Se o contexto for `mesa`:
- **Pular Etapa de Endereço**: O sistema não deve pedir CEP ou Logradouro.
- **Taxa de Entrega Zerada**: Automaticamente definir `taxa_entrega = 0`.
- **Formas de Pagamento**:
  - Permitir PIX/Cartão online (fluxo atual).
  - Adicionar opção "Pagar no Balcão" (opcional).

## 5. Melhorias de UX Sugeridas

1. **Feedback Visual Imediato**: Assim que o QR Code é lido, o app deve confirmar a mesa com uma animação ou mensagem clara.
2. **Persistência Segura**: Se o usuário fechar o navegador e abrir novamente, o número da mesa deve estar lá (via `localStorage`).
3. **Botão "Chamar Garçom"**: No menu flutuante ou rodapé, um botão para notificar o estabelecimento (via SSE/WebSocket).
4. **Fechamento de Conta**: Permitir que o usuário veja todos os pedidos feitos pela mesa naquela sessão (mesmo de outras pessoas, se o backend suportar agrupamento por mesa ativa).

### 5.1. Kitchen Display System (KDS)
- Pedidos de mesa devem aparecer com um destaque visual (cor diferente).
- O número da mesa deve ser exibido de forma proeminente no topo do card de pedido.

### 5.2. Gestão de Mesas (Admin)
- Nova seção no painel administrativo para:
  - Listar mesas cadastradas.
  - Gerar QR Codes para cada mesa.
  - Ver quais mesas estão com pedidos ativos.

## 6. Próximos Passos (Plano de Ação)

1. **Backend**: Atualizar API de criação de pedido para aceitar `numero_mesa`, aceitar o `numero_pedido_dia` (int32), numero do pedido em relação ao dia (pedido 1, pedido 2, etc) e validar o `tipo_pedido`.
2. **Frontend - Core**: Atualizar interfaces e criar `MesaService` para gerenciar o estado da mesa.
3. **Frontend - Roteamento**: Implementar a nova rota `/mesa/:numero`.
4. **Frontend - Checkout**: Ajustar a lógica de `CheckoutComponent` para condicionalmente esconder o formulário de endereço.
5. **Frontend - UI**: Adicionar feedbacks visuais de que o usuário está em uma mesa específica.

---
*Documento gerado por Gemini CLI em 09/05/2026.*
