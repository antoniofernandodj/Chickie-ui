# Plano: Zero Native HTML Form Elements

Objetivo: nenhuma tela do projeto deve ter `<button>`, `<input>`, `<select>`, `<textarea>` ou `<input type="checkbox">` nativos. Tudo vindo do design system (`ui-*` components).

## Status

### ✅ Concluído (admin/)
- `admin-catalogo-tab.component.ts`
- `admin-adicionais-tab.component.ts`
- `admin-cupons-tab.component.ts`
- `admin-promocoes-tab.component.ts`
- `admin-config-pedido-tab.component.ts`
- `admin-enderecos-tab.component.ts`
- `admin-horarios-tab.component.ts`
- `admin-equipe-tab.component.ts`

### ⏳ Pendente

#### admin-pedidos-tab.component.ts
- Checkbox `[checked]`/`(change)` → `<ui-checkbox>`
- "Avançar pedido" brand `<button>` → `<ui-button>`
- Expand pedido `<button>` → `<ui-button variant="flat">`

#### auth/
- `signup.component.html` — ~5 inputs, ~2 buttons
- `esqueci-senha.component.html` — ~2 inputs, ~2 buttons

#### checkout/
- `checkout.component.html` — ~8 inputs, 1 textarea, ~4 buttons

#### loja/
- `avaliacao-loja-form.component.ts` — inputs, textarea, button
- `avaliacao-produto-form.component.ts` — inputs, textarea, button
- `criar-pedido-modal.component.html` — inputs/buttons
- `loja-detalhe.component.html` — buttons

#### owner/
- `owner-panel.component.html` — ~4 buttons

#### pdv/
- `pdv.component.html` — ~3 inputs, ~5 buttons
- `pdv-item-modal.component.ts` — inputs, buttons

#### pedidos/
- `pedido-detalhe.component.html` — ~8 buttons
- `pedidos.component.html` — buttons
- `avaliar-pedido-modal.component.ts` — inputs, textarea, buttons

#### perfil/
- `perfil.component.html` — inputs, buttons

#### funcionario/
- `funcionario-panel.component.html` — inputs, buttons

## Componentes do Design System disponíveis
- `<ui-input>` — text, email, number, date, time, password (com min/max/step/mask/state/hint/error)
- `<ui-password-input>` — input com toggle de visibilidade
- `<ui-select>` — CVA, com label/error/hint/size
- `<ui-textarea>` — CVA, com label/rows/error/hint/size
- `<ui-checkbox>` — CVA boolean, com label/size
- `<ui-button>` — variants: primary/secondary/ghost/danger/flat; sizes: xs/sm/md/lg; loading/disabled/fullWidth

## Padrões estabelecidos
- Botão flex-1: `<div class="flex-1"><ui-button [fullWidth]="true">...</ui-button></div>`
- Availability state: `[state]="checking ? 'warning' : available === true ? 'success' : 'default'"`
- Icon list buttons → `<admin-edit-btn>`, `<admin-toggle-available-btn>`, `<admin-remove-btn>`
- Modal close X → `<ui-button variant="ghost" size="xs">✕</ui-button>`
