# Plano de Componentização — Redução de Linhas por Extração

## Objetivo

Extrair padrões de template que se repetem em múltiplos arquivos para componentes
compartilhados, reduzindo duplicação e tornando o HTML dos pais mais enxuto.

A migração do design system (`ui-button`, `ui-input`, `ui-checkbox`) eliminou **−244 linhas**
mas foi limitada porque muitos blocos convertidos ainda contêm HTML estrutural duplicado.
Esta próxima etapa ataca esses blocos.

---

## Componentes a criar

### 1. `<app-pix-qrcode>` — Exibição de cobrança PIX

**Aparece em:** `checkout.component.html`, `criar-pedido-modal.component.html`,
`pedido-detalhe.component.html`

**Bloco duplicado (~25–38 linhas por ocorrência):**
- QR Code (`<img>` com `data:image/png;base64,`)
- Texto "Código copia e cola" + `<p class="font-mono break-all">`
- Botão `<ui-button [variant]="copiado ? 'secondary' : 'primary'">`
- Texto de vencimento

**Interface proposta:**
```html
<app-pix-qrcode
  [pagamento]="pagamentoPix()"
  [copiado]="copiado()"
  (copiar)="copiarPix()"
/>
```

**Redução estimada:** ~70 linhas (83 removidas, ~15 do componente)

---

### 2. `<app-address-selector>` — Seletor de endereços salvos

**Aparece em:** `checkout.component.html`, `criar-pedido-modal.component.html`

**Bloco duplicado (~40 linhas por ocorrência):**
- Seção de endereços do usuário autenticado (lista com `<ui-button [variant]>`)
- Seção de endereços do guest (lista com `<ui-button [variant]>`)
- Separador "ou preencha manualmente"
- Lógica de seleção ativa idêntica nos dois arquivos

**Interface proposta:**
```html
<app-address-selector
  [enderecosUsuario]="enderecosUsuario()"
  [enderecosGuest]="enderecosGuestSalvos()"
  [selecionadoUuid]="enderecoSelecionadoUuid"
  [selecionadoGuestId]="enderecoGuestSelecionadoId"
  (selecionarUsuario)="selecionarEndereco($event)"
  (selecionarGuest)="selecionarEnderecoGuest($event)"
/>
```

**Redução estimada:** ~55 linhas (85 removidas, ~30 do componente)

---

### 3. `<app-payment-method-selector>` — Grid de formas de pagamento

**Aparece em:** `checkout.component.html`, `criar-pedido-modal.component.html`

**Bloco duplicado (~15 linhas por ocorrência):**
- `@for (opt of formasPagamento; track opt.valor)`
- `<ui-button [variant]="formaPagamento === opt.valor ? 'primary' : 'secondary'">`
- Emoji + label dentro de span flex

**Interface proposta:**
```html
<app-payment-method-selector
  [opcoes]="formasPagamento"
  [selecionado]="formaPagamento"
  (selecionar)="formaPagamento = $event"
/>
```

**Redução estimada:** ~20 linhas (30 removidas, ~10 do componente)

---

### 4. `<app-adicional-picker>` — Seletor de adicionais em pills

**Aparece em:** `criar-pedido-modal.component.html` (2×: item simples + pizza por parte),
`pdv-item-modal.component.ts` (2×: pizza parte + item simples)

**Bloco duplicado (~12 linhas por ocorrência):**
- `@for (ad of adicionaisDisponiveis(); track ad.uuid)`
- `<ui-button [variant]="isSelected ? 'primary' : 'secondary'" size="xs">`
- Nome + preço dentro de span

**Interface proposta:**
```html
<app-adicional-picker
  [adicionais]="adicionaisDisponiveis()"
  [selecionados]="adicionaisSelecionados()"
  (toggle)="toggleAdicional($event)"
/>
```

**Redução estimada:** ~30 linhas (48 removidas, ~18 do componente)

---

### 5. `<ui-card>` — Container de seção padrão (design system)

**Aparece em:** praticamente todos os arquivos de feature

**Padrão duplicado (1 linha por uso, mas em dezenas de lugares):**
```html
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
```
Esta classe exata ou variações dela (`p-5`, `p-4`, `mb-4`) aparece mais de 40 vezes no projeto.

**Interface proposta:**
```html
<ui-card>Conteúdo</ui-card>
<!-- com opcionais: padding="sm|md|lg", class extra -->
```

**Redução estimada:** ~40 linhas + padronização visual garantida

---

## Resumo e prioridade

| # | Componente                    | Arquivos afetados | Redução estimada | Prioridade |
|---|-------------------------------|-------------------|------------------|------------|
| 1 | `<app-pix-qrcode>`            | 3                 | ~70 linhas       | Alta       |
| 2 | `<app-address-selector>`      | 2                 | ~55 linhas       | Alta       |
| 5 | `<ui-card>`                   | ~12               | ~40 linhas       | Alta       |
| 3 | `<app-payment-method-selector>` | 2               | ~20 linhas       | Média      |
| 4 | `<app-adicional-picker>`      | 2 (4 ocorrências) | ~30 linhas       | Média      |

**Redução total estimada: ~215 linhas** — quase o dobro do que foi conquistado na migração
anterior.

---

## Localização sugerida

```
src/app/shared/components/
  ui-card.component.ts          ← design system (ui-*)

src/app/shared/features/        ← pasta nova para componentes de domínio compartilhados
  pix-qrcode/
    pix-qrcode.component.ts
  address-selector/
    address-selector.component.ts
  payment-method-selector/
    payment-method-selector.component.ts
  adicional-picker/
    adicional-picker.component.ts
```

---

## Observações

- `<app-pix-qrcode>` e `<app-address-selector>` têm o maior impacto e devem ser feitos primeiro.
- `<ui-card>` é o de menor esforço e maior alcance — é um componente de layout puro sem lógica.
- `<app-payment-method-selector>` e `<app-adicional-picker>` só fazem sentido se os dados
  (`formasPagamento`, `adicionaisDisponiveis`) forem passados via `@Input`, mantendo a lógica
  de seleção no componente pai.
- O PDV (`pdv.component.html`) tem product cards com imagem que permanecem como
  `<div role="button">` — esses poderiam virar um `<app-product-card>` futuramente,
  mas têm baixa prioridade pois a duplicação ocorre dentro do mesmo arquivo.
