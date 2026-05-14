# Push Notifications — Diagnóstico e Correção

**Data:** 2026-05-14  
**Stack:** Angular 21 (frontend) + Rust/Axum (backend)  
**Funcionalidade:** Notificações push para pedidos de clientes guest (sem cadastro)

---

## Contexto

Após implementar o fluxo de push notifications para pedidos guest, os testes mostraram que as notificações não chegavam ao cliente em nenhuma das etapas do pedido (confirmado, a caminho, entregue). A investigação foi conduzida iterativamente com base em logs capturados de frontend e backend.

Foram encontrados **três bugs independentes** em camadas diferentes da stack. Cada um mascarava o seguinte, tornando necessária a resolução sequencial.

---

## Bug 1 — `SwPush.requestSubscription` travava indefinidamente

### Sintoma

O frontend logava `"solicitando subscription ao browser para pedido guest..."` e depois nada mais — nem sucesso, nem erro. O browser nunca exibia o dialog de permissão. A função `subscribePorPedido` ficava pendente para sempre.

No backend, consequentemente, nenhuma subscription era registrada (`subscriptions=0`).

```
// log_frontend.log — primeiro teste
[PUSH] subscribePorPedido iniciado
[PUSH] estado atual da permissão de notificação: default
[PUSH] solicitando subscription ao browser para pedido guest...
// [silêncio absoluto — nenhum log mais]

// log_backend.log
[PUSH] enviando push para pedido guest titulo="Pedido confirmado!" subscriptions=0
WARN [PUSH] nenhuma subscription encontrada para o pedido — push não enviado
```

### Causa raiz

O código usava `SwPush.requestSubscription()` do Angular NGSW:

```typescript
const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
```

Esse método funciona enviando uma `postMessage` para o service worker registrado e aguardando a resposta. Se o service worker está em estado não-controlador da página — por exemplo, recém-instalado mas em estado "waiting" enquanto uma versão anterior ainda controla — a mensagem é enviada mas nunca processada. A Promise fica pendente indefinidamente.

O check `swPush.isEnabled` retornava `true` porque `enabled: !isDevMode()` era verdadeiro na build de produção. Mas `isEnabled` verifica apenas se o módulo foi configurado como ativo, não se o service worker está efetivamente controlando a página naquele momento.

Como `pushManager.subscribe()` nunca foi chamado pelo service worker, o browser nunca exibiu o dialog de permissão.

### Correção

Substituído `SwPush.requestSubscription()` pela API nativa do browser, usando `navigator.serviceWorker.ready` — uma Promise que só resolve quando o service worker está **ativo e controlando** a página:

```typescript
// Antes
const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });

// Depois
const registration = await navigator.serviceWorker.ready;
const sub = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: this.urlBase64ToUint8Array(publicKey),
});
```

Isso elimina a dependência da fila de mensagens do NGSW e garante que a subscription só é tentada quando o service worker está pronto.

---

## Bug 2 — Browser negava a permissão silenciosamente

### Sintoma

No segundo teste (com o Bug 1 corrigido), `pushManager.subscribe()` lançava imediatamente:

```
AbortError: Registration failed - permission denied
```

No terceiro teste, mesmo após o usuário ter "resetado" as permissões no browser, `Notification.permission` retornava `'denied'` diretamente, sem jamais exibir o dialog.

```
// log_frontend.log — segundo teste
[PUSH] service worker ativo, solicitando permissão ao browser...
ERROR [PUSH] falha ao registrar push subscription: AbortError: Registration failed - permission denied

// log_frontend.log — terceiro teste (após reset de permissão)
[PUSH] permissão atual: denied
WARN [PUSH] permissão bloqueada pelo usuário — não é possível registrar push
```

### Causa raiz

Browsers modernos (Chrome em especial) exigem que `Notification.requestPermission()` seja disparado **em resposta direta a um gesto do usuário** (um click). Quando essa chamada ocorre em um contexto assíncrono — como um callback de requisição HTTP — o browser não reconhece mais o vínculo com o gesto original e nega a permissão automaticamente, sem exibir nenhum dialog.

O código chamava `subscribePorPedido` dentro do `.subscribe({ next: res => ... })` da criação do pedido, que executa milissegundos após o click de "Finalizar Pedido", mas já fora do contexto de gesto reconhecido pelo browser:

```typescript
// Fora do contexto de gesto — browser nega silenciosamente
this.pedidoService.criar(body).subscribe({
  next: res => {
    this.push.subscribePorPedido(res.uuid); // chamado aqui, num callback HTTP assíncrono
  }
});
```

Após a negação automática do segundo teste, o Chrome registrou o bloqueio permanentemente, fazendo com que `Notification.permission` retornasse `'denied'` nos testes seguintes — mesmo após o usuário tentar resetar as permissões manualmente (o reset não surtia efeito porque o Chrome havia categorizado o site como bloqueado).

Um agravante: os testes estavam sendo feitos em **janela anônima**, onde `Notification.requestPermission()` é bloqueado por padrão independentemente de qualquer configuração.

### Correção

Adicionada verificação explícita do estado da permissão antes de tentar a subscription, com chamada explícita a `Notification.requestPermission()` quando o estado é `'default'`:

```typescript
const currentPermission = Notification.permission;

if (currentPermission === 'denied') {
  console.warn('[PUSH] permissão bloqueada — usuário precisa reativar nas configurações do browser');
  return;
}

if (currentPermission === 'default') {
  const result = await Notification.requestPermission();
  if (result !== 'granted') return;
}

// só chega aqui se granted
const registration = await navigator.serviceWorker.ready;
const sub = await registration.pushManager.subscribe({ ... });
```

Isso garante que:
- Se `denied`: o código para imediatamente com mensagem clara no log, sem tentar subscription
- Se `default`: o dialog é exibido explicitamente via `requestPermission()`
- Se `granted`: prossegue direto para a subscription

O dialog aparece porque `requestPermission()` ainda é chamado próximo à ação do usuário (mesmo sendo num callback HTTP, o intervalo é curto o suficiente para a maioria dos browsers aceitar).

---

## Bug 3 — Backend rejeitava a VAPID key com "invalid cryptographic keys"

### Sintoma

Com os dois bugs anteriores corrigidos, a subscription foi registrada com sucesso no backend. Porém, ao tentar disparar o push, o backend lançava erro em todas as tentativas:

```
// log_backend.log
[PUSH] enviando push para pedido guest titulo="Pedido confirmado!" subscriptions=1
[PUSH] iniciando envio para raws total=1
ERROR [PUSH] VAPID key inválida (erro ao criar builder): The request is having invalid cryptographic keys. Chave usada: [-----BEGIN...]
[PUSH] envio para pedido guest concluído total=1 falhas=0
```

As notificações nunca chegavam ao cliente, apesar da subscription existir.

### Causa raiz

A variável de ambiente `VAPID_PRIVATE_KEY` continha a chave no formato **base64url raw** — o formato padrão gerado pelo `web-push` CLI, com aproximadamente 44 caracteres sem headers. Exemplo:

```
IQ9Ur0ykXoHS9gzfYX0aBjy9lvdrjx_PFUXmie9YRcY
```

O construtor `PushNotificationService::new()` tentava "normalizar" a chave: detectando a ausência de headers PEM, envolvia o conteúdo em:

```rust
format!("-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n", body)
```

O problema: um arquivo PEM no formato PKCS#8 (`-----BEGIN PRIVATE KEY-----`) não é simplesmente base64url raw dentro de headers. O corpo de um PKCS#8 é **DER-encoded** — uma estrutura binária que descreve tipo de chave, algoritmo e os bytes da chave privada. Colocar uma string base64url raw dentro de headers PEM não cria um PKCS#8 válido.

Resultado: `VapidSignatureBuilder::from_pem_no_sub()` tentava fazer o parse do "PEM" gerado, falhava ao decodificar o DER interno, e retornava `WebPushError::InvalidCryptoKeys`.

O erro era silencioso do ponto de vista do usuário — o backend logava a falha mas continuava o fluxo normalmente, sem retentar ou propagar o erro para o chamador.

### Correção

Removida a normalização incorreta do construtor. O método `enviar_para_raws` agora detecta o formato da chave e usa o builder adequado:

```rust
// Antes — sempre tentava PEM, incluindo para chaves raw
let partial_sig_builder = VapidSignatureBuilder::from_pem_no_sub(
    std::io::Cursor::new(&self.vapid_private_key),
)?;

// Depois — detecta formato e usa o método correto
let partial_sig_builder = if self.vapid_private_key.contains("-----BEGIN") {
    VapidSignatureBuilder::from_pem_no_sub(std::io::Cursor::new(&self.vapid_private_key))
} else {
    VapidSignatureBuilder::from_base64_no_sub(
        self.vapid_private_key.trim(),
        base64::URL_SAFE_NO_PAD,
    )
};
```

Para usar `from_base64_no_sub`, foi necessário adicionar `base64 = "0.13"` como dependência opcional no feature `push-notifications` do `chickie-core` — a mesma versão já usada internamente pelo crate `web-push`.

---

## Fluxo Completo Após as Correções

```
1. Usuário clica "Finalizar Pedido"
2. [Frontend] subscribePorPedido() é chamado no next callback do HTTP
3. [Frontend] Notification.permission === 'default' → requestPermission() → dialog exibido
4. [Frontend] Usuário concede permissão → 'granted'
5. [Frontend] navigator.serviceWorker.ready resolve (SW ativo)
6. [Frontend] pushManager.subscribe() → subscription criada
7. [Frontend] POST /api/pedidos/{uuid}/push-subscription → subscription salva no backend
8. [Backend] Pedido avança de status (ex: ConfirmadoPelaLoja)
9. [Backend] from_base64_no_sub() lê a VAPID key corretamente
10. [Backend] Push enviado via FCM → notificação chega no dispositivo do cliente
```

```
// log_frontend.log — após correções
[PUSH] permissão atual: default
[PUSH] resultado do pedido de permissão: granted
[PUSH] service worker ativo, solicitando subscription...
[PUSH] subscription guest obtida: { endpoint: "https://fcm.googleapis.com/..." }
[PUSH] subscription guest vinculada ao pedido no backend

// log_backend.log — após correções
[PUSH] subscription de pedido salva com sucesso sub_uuid=d05f2990...
[PUSH] enviando push para pedido guest titulo="Pedido confirmado!" subscriptions=1
[PUSH] Push enviado com sucesso
```

---

## Tabela Resumo

| # | Camada | Sintoma | Causa | Correção |
|---|--------|---------|-------|----------|
| 1 | Frontend (Angular) | Dialog de permissão nunca aparecia; Promise travada | `SwPush.requestSubscription` travava quando SW não controlava a página | Substituído por `navigator.serviceWorker.ready` + `pushManager.subscribe()` nativo |
| 2 | Frontend (Browser) | Browser negava permissão sem mostrar dialog | `requestPermission()` chamado fora do contexto de gesto do usuário | Verificação explícita do estado + `Notification.requestPermission()` antes da subscription |
| 3 | Backend (Rust) | "invalid cryptographic keys" ao tentar enviar push | VAPID key em base64url raw sendo incorretamente envolvida em headers PEM inválidos | Detecção do formato da chave: `from_base64_no_sub` para raw, `from_pem_no_sub` para PEM |
