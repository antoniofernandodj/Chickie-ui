---
name: project-pdv-telao
description: PDV identification step (mesa/nome_requerente) and telão display screen for last PDV order
metadata:
  type: project
---

PDV agora tem um passo de identificação (`'identificacao'`) entre construção e pagamento onde o atendente pode opcionalmente informar número da mesa OU nome do cliente (nome_requerente).

**Why:** Pedidos PDV precisam indicar a mesa ou chamar o cliente pelo nome no telão.

**How to apply:**
- `pdvStep` signal: `'inicio' | 'construcao' | 'identificacao' | 'finalizacao'`
- `numeroMesaPdv` e `nomeRequerente` são signals no PDV component
- Backend: migration `0023_add_nome_requerente_pedidos.sql` adicionou coluna `nome_requerente TEXT` em `pedidos`
- Backend: `Pedido::new()` aceita `nome_requerente: Option<String>` como 9° parâmetro (antes de `tipo_pedido`)
- Frontend `Pedido` interface tem `nome_requerente: string | null`
- Frontend `CreatePedidoRequest` tem `nome_requerente?: string | null`
- KDS e admin mostram badges "Mesa X" (azul) e nome do cliente (roxo) nos cards
- Tela telão: `/telao` (funcionário) e `/admin/:loja_uuid/telao` — componente `PdvTelaoComponent` em `features/pdv/pdv-telao.component.ts`

[[feedback-design-system-buttons]]
