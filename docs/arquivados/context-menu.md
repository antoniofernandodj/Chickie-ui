# Menu de Contexto (Right-Click / Long-Press)

**Data:** 2026-05-12  
**Status:** Implementado e em produção

## O que foi construído

Sistema de menu de contexto global para desktop (clique direito) e mobile (pressão longa de 500ms), composto por três peças:

### `ContextMenuService` (`src/app/core/services/context-menu.service.ts`)

Serviço singleton que mantém o estado do menu em um `signal<ContextMenuState | null>`. Expõe dois métodos: `open(x, y, items)` e `close()`. Qualquer componente ou diretiva pode abrir o menu sem precisar injetar o componente visual diretamente.

```typescript
export type ContextMenuItem =
  | { label: string; icon?: string; action: () => void; variant?: 'default' | 'danger'; disabled?: boolean }
  | 'separator';
```

### `ContextMenuDirective` (`src/app/shared/directives/context-menu.directive.ts`)

Diretiva `[appContextMenu]` que aceita um array de `ContextMenuItem[]` e cuida de toda a lógica de input:

- **Desktop / Android:** escuta `contextmenu` e chama `svc.open()`
- **iOS / touch:** escuta `pointerdown` e inicia um timer de 500ms; se o dedo não mover, abre o menu
- **Feedback visual:** durante o long-press, reduz a opacidade do elemento para 0.55 via `Renderer2`
- **Anti-duplo no Android:** flag `timerFired` — o timer seta antes de abrir; o handler `contextmenu` (que o Android também dispara após o long-press) verifica a flag e pula se já foi

### `UiContextMenuComponent` (`src/app/shared/components/ui-context-menu.component.ts`)

Componente raiz que lê o `state` do serviço e renderiza o menu flutuante:

- Posicionado com `position: fixed`, z-index `9999`
- Overlay transparente `z-[9998]` captura cliques fora e fecha o menu
- `pos = computed(...)` ajusta x/y para não sair da viewport (usa `window.innerWidth/Height`)
- `@HostListener('document:keydown.escape')` fecha com tecla Escape
- Separadores renderizam como `<div class="border-t">`
- Items com `variant: 'danger'` ficam em vermelho
- Items com `disabled: true` ficam com `opacity-40 cursor-not-allowed`

Registrado globalmente em `app.html` como `<ui-context-menu />` e em `app.ts` no `imports`.

## Onde foi aplicado

| Elemento | Arquivo | Itens do menu |
|----------|---------|---------------|
| Card de produto (admin catálogo) | `admin-product-card.component.ts` | Editar, Marcar disponível/indisponível, —, Remover (danger) |
| Header de categoria (admin catálogo) | `admin-category-card.component.ts` | Editar categoria, —, Excluir categoria (danger) |
| Accordion de pedido (admin pedidos) | `admin-pedidos-tab.component.ts` | Ver detalhes, Copiar código, —, Avançar status (disabled para 'cancelado'/'entregue') |
| Item da comanda (PDV) | `pdv.component.html` + `.ts` | Remover da comanda (danger) |

## Decisões técnicas

**Por que um serviço global em vez de um portal por diretiva?**  
Um único componente renderizado na raiz elimina problemas de `overflow: hidden` nos pais e garante que o menu sempre apareça acima de tudo. Componentes individuais não precisam saber como o menu é renderizado.

**Por que `pointerType === 'mouse'` no long-press handler?**  
O evento `pointerdown` dispara tanto para mouse quanto para touch. Filtrar por tipo evita que o timer seja iniciado em cliques de mouse — nesse caso o `contextmenu` nativo já cuida de tudo.

**SSR safety**  
Acesso a `window` dentro de `isPlatformBrowser()` no `UiContextMenuComponent` — o componente não é renderizado no servidor, mas a guarda evita erros de hydration.

**Armadilha: `String.prototype.replace()` com `$` no replacement**  
Durante a formatação de templates inline com Prettier, o script usava `str.replace(match, replacement)` onde `replacement` continha `R$&nbsp;`. O JavaScript interpreta `$&` como "inserir o match inteiro aqui", corrompendo o arquivo. Solução: sempre passar uma função como segundo argumento — `str.replace(match, () => replacement)` — para desativar todos os padrões especiais de `$`.
