# Plano: Pre-Permission Dialog para Push Notifications

## Problema

Quando o pedido é finalizado, o browser exibe diretamente a caixa de diálogo **nativa** pedindo permissão para notificações. O usuário não tem contexto do porquê está sendo perguntado, o que leva a recusas desnecessárias.

Código atual em `push-notification.service.ts` (linha ~100):

```ts
if (currentPermission === 'default') {
  const result = await Notification.requestPermission(); // ← dispara direto a caixa nativa
  ...
}
```

## Solução: Pre-Permission Prompt (Permission Priming)

**A caixa nativa do browser é obrigatória e não pode ser substituída** — é uma restrição de segurança. Mas é possível exibir um modal customizado *antes* dela para dar contexto ao usuário.

### Fluxo proposto

```
[Modal Angular customizado]
    → usuário clica "Sim, quero acompanhar"
        → [Caixa nativa do browser]
            → usuário clica "Permitir"
                → subscription registrada ✅

    → usuário clica "Agora não"
        → nada acontece (permissão continua 'default')
            → pode perguntar de novo futuramente ✅
```

### Vantagem crítica

Se `Notification.requestPermission()` for chamado diretamente e o usuário clicar **"Bloquear"**, o browser marca a permissão como `denied` **permanentemente** — só muda manualmente nas configurações. Com o pre-prompt customizado, se o usuário recusar no *modal seu*, a permissão continua `default` e é possível tentar novamente na próxima visita.

## Implementação

### 1. Criar componente de modal

`src/app/shared/components/push-permission-dialog.component.ts`

```ts
@Component({
  selector: 'app-push-permission-dialog',
  template: `
    <div class="dialog-overlay">
      <div class="dialog-box">
        <span class="icon">🔔</span>
        <h3>Acompanhe seu pedido em tempo real</h3>
        <p>Ative as notificações para receber atualizações sobre o status do seu pedido assim que ele for confirmado, preparado e saiu para entrega.</p>
        <div class="actions">
          <button (click)="responder(false)">Agora não</button>
          <button class="primary" (click)="responder(true)">Sim, quero acompanhar</button>
        </div>
      </div>
    </div>
  `
})
export class PushPermissionDialogComponent {
  readonly result = new Subject<boolean>();

  responder(aceito: boolean) {
    this.result.next(aceito);
    this.result.complete();
  }
}
```

### 2. Criar serviço de diálogo (ou usar o padrão de overlay existente)

O componente pode ser aberto via `ViewContainerRef` / `createComponent()` ou integrado ao sistema de modais já existente no projeto.

### 3. Modificar `PushNotificationService.subscribePorPedido()`

```ts
if (currentPermission === 'default') {
  // 1. Mostrar modal customizado
  const aceito = await this.mostrarPrePermissionDialog();
  if (!aceito) {
    console.info('[PUSH] usuário recusou no pre-prompt — permissão continua default');
    return;
  }

  // 2. Só agora acionar a caixa nativa
  const result = await Notification.requestPermission();
  if (result !== 'granted') return;
}
```

### 4. Onde é chamado

- `checkout.component.ts` linha ~435: `this.push.subscribePorPedido(res.uuid)`
- `criar-pedido-modal.component.ts` linha ~937: `this.push.subscribePorPedido(res.uuid)`

A mudança no serviço já cobre os dois pontos automaticamente.

## Arquivos a modificar/criar

| Arquivo | Ação |
|---|---|
| `src/app/shared/components/push-permission-dialog.component.ts` | Criar |
| `src/app/core/services/push-notification.service.ts` | Modificar `subscribePorPedido()` |

## Referência

Padrão de UX descrito em: https://web.dev/articles/push-notifications-permission-ux
