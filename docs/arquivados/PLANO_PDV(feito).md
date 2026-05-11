# Plano de Implementação: Tela de PDV (Ponto de Venda)

Este documento descreve o plano para a criação de uma interface de PDV no projeto Chickie UI, destinada ao uso por funcionários da loja para realizar vendas presenciais ou por telefone.

## 1. Visão Geral
O PDV permitirá que a equipe da loja crie pedidos rapidamente, selecione produtos, gerencie o carrinho e finalize vendas, integrando-se diretamente ao fluxo de pedidos e KDS (Kitchen Display System) já existente.

---

## 2. Acesso e Autenticação

### Como seria acessado:
- **Rota:** `/pdv`
- **Proteção:** Utilizará o `funcionarioGuard`.
- **Permissões:** Acesso permitido para usuários com classe `funcionario`, `owner` ou `admin`.

### Estado de Login:
- **Obrigatório Logado:** O PDV não pode ser acessado deslogado por questões de segurança e para vincular o pedido à loja correta.
- **Contexto da Loja:** 
    - **Funcionário:** O PDV identifica automaticamente a `loja_uuid` vinculada ao perfil do funcionário.
    - **Owner/Admin:** Poderá selecionar qual loja deseja operar o PDV (ou virá da rota `/admin/:loja_uuid/pdv`).

---

## 3. Interface do Usuário (UI)

O design deve ser otimizado para velocidade (uso de mouse ou touch), com botões grandes e fluxo simplificado.

### Layout Sugerido (Split Screen):
1.  **Lado Esquerdo (Catálogo):**
    - **Barra de Busca:** Pesquisa rápida de produtos por nome ou código.
    - **Filtro de Categorias:** Abas ou botões laterais para alternar entre categorias (ex: Burgers, Bebidas, Acompanhamentos).
    - **Grid de Produtos:** Cards simples com nome, preço e foto.
2.  **Lado Direito (Carrinho/Comanda):**
    - **Lista de Itens:** Itens adicionados com quantidade e opcionais.
    - **Controles:** Botões de `+`, `-` e `Remover` para cada item.
    - **Totais:** Exibição clara de Subtotal, Taxas (se houver) e Total.
    - **Botão "Limpar":** Para cancelar o rascunho atual.
    - **Botão "Finalizar":** Abre o modal de checkout.

---

## 4. Fluxo de Pedido

1.  **Seleção de Produtos:**
    - Funcionário clica no produto.
    - Se o produto tiver opcionais, abre um modal rápido (reaproveitando o `CriarPedidoModalComponent`).
    - Item é adicionado ao `CartService`.

2.  **Identificação do Cliente (Opcional):**
    - Campo para Nome/CPF ou busca de cliente cadastrado (para fidelidade).
    - Por padrão, o pedido é "Consumidor Final".

3.  **Checkout / Finalização:**
    - **Tipo de Pedido:** Retirada (Balcão) ou Consumo Local (Mesa/Comanda).
    - **Forma de Pagamento:** Seleção de Dinheiro, Cartão (Débito/Crédito) ou PIX.
    - **Observações:** Campo para notas adicionais no pedido.

4.  **Submissão:**
    - O pedido é enviado para o backend via `PedidoService.criar`.
    - **Diferencial PDV:** O pedido deve ser criado com um status especial (ex: `confirmado_pela_loja`) para que pule a fase de aprovação e vá direto para a cozinha (KDS).

---

## 5. Integração Técnica

### Componentes Necessários:
- `PdvComponent`: Container principal e gerenciador de estado da tela.
- `PdvCatalogoComponent`: Exibição dos produtos e categorias.
- `PdvCarrinhoComponent`: Gerenciamento dos itens selecionados.
- `PdvCheckoutModalComponent`: Passo final para escolha de pagamento e envio.

### Serviços Envolvidos:
- `CatalogoService`: Para listar produtos e categorias da loja.
- `CartService`: Para gerenciar o estado temporário da venda.
- `PedidoService`: Para enviar o pedido final ao servidor.
- `FuncionarioService`: Para validar o vínculo com a loja.

---

## 6. Real-time e Feedback
- Assim que o pedido é finalizado, o PDV deve mostrar uma confirmação e permitir a impressão do ticket (opcional).
- O pedido deve aparecer instantaneamente no `FuncionarioPanelComponent` (KDS) via SSE/WebSockets já implementados no `PedidosLiveService`.

---

## 7. Próximos Passos (Evolução)
- **Modo Offline:** Persistência local (IndexedDB) para vendas mesmo sem internet estável.
- **Integração com Impressora:** Suporte a impressão térmica direta (ESC/POS).
- **Gestão de Mesas:** Mapa de mesas para controle de consumo local contínuo.
