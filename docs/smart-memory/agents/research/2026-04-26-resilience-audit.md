---
title: Resilience Audit — AUTH-V2-03c & BI-VOICE-00
type: research
agent: dev-dev-delta (Kronix)
created: 2026-04-26
tags: [audit, resilience, hardening, auth, bi-voice]
related: ["[[AUTH-V2-03c]]", "[[BI-VOICE-00]]"]
---

# Auditoria Adversarial — 2026-04-26

**Scope:** AUTH-V2-03c (Step-up Auth) + BI-VOICE-00 (getProviderKey)
**Status:** Findings levantados. Sem correção aplicada — aguardando QA gate.

---

## AUTH-V2-03c — Step-up Auth

### Arquivos auditados
- `src/hooks/useStepUpAuth.ts`
- `src/pages/MfaVerify.tsx`
- `src/components/auth/ProtectedRoute.tsx`

---

### [P0] — Race condition: `ProtectedRoute` renderiza children antes do MFA guard completar

**Arquivo:** `src/components/auth/ProtectedRoute.tsx:86-148`

**O que acontece:**
`mfaChecked` começa como `false`. O `useEffect` MFA guard (linha 49) é assíncrono — chama `supabase.auth.mfa.listFactors()` e `getAuthenticatorAssuranceLevel()`. Enquanto essa Promise está em voo, o componente já chegou ao `return <>{children}</>` (linha 148) pois `isLoading` é `false` e `user` existe.

**Cenário concreto:** Gestor com MFA obrigatório faz login. `isLoading` vira `false`, `user` existe, `settings` chega via React Query — o guard ainda está aguardando a RPC do Supabase. Nesse intervalo (tipicamente 200-800ms numa conexão normal), os `children` são renderizados e montados. O React Query pode já ter disparado fetches de dados sensíveis antes do redirect para `/mfa-verify`.

**Por que é P0:** Dados sensíveis podem ser carregados/expostos antes da verificação MFA completar. A proteção não é atômica.

---

### [P0] — `useStepUpAuth`: `lastGrantedAt` é variável de módulo (global mutable state)

**Arquivo:** `src/hooks/useStepUpAuth.ts:19`

```typescript
let lastGrantedAt: number | null = null;
```

**O que acontece:**
`lastGrantedAt` é declarada no escopo do módulo, não dentro do hook. Em aplicações React com múltiplos componentes usando `useStepUpAuth`, todos compartilham a mesma instância dessa variável. Pior: ela persiste pelo tempo de vida do módulo (toda a sessão do browser tab).

**Cenário concreto 1 — Bypass por timing:** Usuário A faz step-up em ação sensível às 10:00. `lastGrantedAt` é setado. Às 10:04 (dentro da janela de 5min), o mesmo usuário tenta outra ação sensível — `onGranted()` é executado sem verificar o Supabase, sem checar se a sessão ainda é AAL2. Se a sessão foi invalidada (logout forçado, token refresh, revogação remota), o guard é bypassado.

**Cenário concreto 2 — Multi-tab:** Tab 1 faz step-up. Tab 2 abre a mesma rota. Como `lastGrantedAt` vive no módulo (e módulos são por-tab em browsers), não há risco cross-tab aqui — mas o state é invisível para qualquer reset de sessão que ocorra no mesmo tab.

**Por que é P0:** A janela de 5min sem reverificação com o Supabase é uma assunção de confiança implícita. Se o token for revogado remotamente (admin force-logout), o step-up ainda passa durante 5min.

---

### [P1] — `ProtectedRoute`: erro silencioso no `getAuthenticatorAssuranceLevel`

**Arquivo:** `src/components/auth/ProtectedRoute.tsx:71-72`

```typescript
const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (aalData && aalData.currentLevel !== 'aal2') {
```

**O que acontece:**
O error da RPC é destructurado mas descartado (sem `error: aalErr`). Se a chamada falhar (network error, Supabase timeout, JWT expirado), `aalData` será `null`. A condição `if (aalData && ...)` avalia como `false` — o guard passa silenciosamente. O usuário acessa o sistema como se tivesse AAL2.

**Fail-open:** Falha de rede = acesso garantido. O comportamento seguro seria fail-closed (redirecionar ou mostrar erro).

---

### [P1] — `MfaVerify`: acesso sem `factorId` silencia o botão mas não protege a rota

**Arquivo:** `src/pages/MfaVerify.tsx:29,41,151`

```typescript
const factorId = factors?.totp?.[0]?.id ?? '';
// ...
if (code.length !== 6 || !factorId) return; // early return no handleVerifyTotp
// ...
disabled={code.length !== 6 || isPending || !factorId}
```

**O que acontece:**
Se `factors` ainda está carregando (React Query em estado `isLoading`) ou se o usuário não tem fatores TOTP cadastrados, `factorId` é `''`. O botão fica desabilitado e `handleVerifyTotp` retorna cedo — mas a página `/mfa-verify` continua acessível e não exibe nenhum feedback de erro para o usuário.

**Cenário:** Usuário com MFA deletado no backend (admin removeu o fator) acessa `/mfa-verify`. Vê a tela de código, digita 6 dígitos, nada acontece. Sem mensagem de erro, sem redirect. O usuário fica travado.

**Secundário:** `factors` vem de `useMFA` — não há tratamento de erro visível no destructure. Se `useMFA` retorna `factors: null` por erro de rede, o comportamento é idêntico ao descrito.

---

### [P1] — `useStepUpAuth`: `setStatus` não transita para `'error'` em falha de AAL check

**Arquivo:** `src/hooks/useStepUpAuth.ts:38-41`

```typescript
if (aalError) {
  setError('Erro ao verificar nível de autenticação.');
  return; // status permanece 'idle'
}
```

**O que acontece:**
Quando `getAuthenticatorAssuranceLevel` retorna erro, o status não é setado para `'error'` — permanece `'idle'`. O consumidor do hook não consegue distinguir "nenhum step-up necessário ainda" de "falha na verificação". O `onGranted` callback não é chamado e não há forma programática de detectar que houve falha.

**Impacto:** UX quebrada — o usuário clica em ação sensível, nada acontece (sem dialog, sem loading), apenas um possível toast ou mensagem de erro se o caller checar `error`. Mas callers que não monitoram `error` ficam sem feedback.

---

### [P2] — `ProtectedRoute`: `listFactors` não trata erro de rede

**Arquivo:** `src/components/auth/ProtectedRoute.tsx:60-61`

```typescript
const { data: factorsData } = await supabase.auth.mfa.listFactors();
const hasTotp = (factorsData?.totp ?? []).some((f) => f.status === 'verified');
```

**O que acontece:**
Sem destructure do `error`, falha de rede resulta em `factorsData = null`, `hasTotp = false`, e o usuário é redirecionado para `/settings/mfa-setup` — como se não tivesse TOTP configurado. Usuário com MFA ativo, em rede instável, pode ser forçado a re-enrolar.

---

### [P2] — `MfaVerify`: `unenrollSelf` durante recovery não tem fallback se falhar

**Arquivo:** `src/pages/MfaVerify.tsx:76-78`

```typescript
if (factorId) {
  await unenrollSelf.mutateAsync({ factorId });
}
navigate('/settings/mfa-setup', { replace: true });
```

**O que acontece:**
`unenrollSelf.mutateAsync` pode lançar (e lança se o fator não existe mais ou RPC falhar). O `catch` do `handleRecovery` (linha 83) captura genericamente e mostra "Erro ao processar código de recuperação." — o usuário não sabe se o recovery code foi consumido ou não.

**Cenário adversarial:** Recovery code é consumido com sucesso (tabela de recovery codes atualizada), mas `unenrollSelf` falha. O usuário viu o erro genérico, tenta de novo com outro recovery code (conta um segundo código), mas o TOTP ainda está lá. Loop confuso.

---

## BI-VOICE-00 — `getProviderKey` e `gemini-live-token`

### Arquivos auditados
- `supabase/functions/_shared/ai_providers.ts`
- `supabase/functions/gemini-live-token/index.ts`

---

### [P1] — `getProviderKey` silencia RPC error e retorna `null` — upstream não distingue "não configurado" de "falha de infra"

**Arquivo:** `supabase/functions/_shared/ai_providers.ts:15-18`

```typescript
if (error) {
  console.error(`[ai_providers] getProviderKey(${provider}) error:`, JSON.stringify(error));
  return null;
}
```

**O que acontece:**
Erro de RPC (timeout, permissão negada, função SQL inexistente) e provider genuinamente não configurado ambos retornam `null`. O caller `gemini-live-token` (linha 78-86) trata o `null` com:

```typescript
if (!geminiKey) {
  return json({ error: 'gemini_not_configured', ... }, 412);
}
```

**Consequência:** Uma falha de infra (RPC timeout, SUPABASE_SERVICE_ROLE_KEY inválida, função `get_active_ai_provider_key` dropada) retorna HTTP 412 para o frontend com a mensagem "Gestor precisa cadastrar API key Gemini". O gestor vai em Configurações, vê a key cadastrada, fica confuso. O bug real (infra) fica mascarado.

**Correto seria:** retornar 500 em erro de RPC, 412 apenas quando `data === null` sem erro.

---

### [P2] — `gemini-live-token`: `fetch` para Google API sem timeout explícito

**Arquivo:** `supabase/functions/gemini-live-token/index.ts:91-104`

```typescript
googleRes = await fetch(`${GEMINI_AUTH_TOKENS_URL}?key=${geminiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});
```

**O que acontece:**
Deno edge functions têm timeout global do Supabase (tipicamente 150s), mas sem `AbortController` + `signal` explícito, a chamada para `generativelanguage.googleapis.com` pode pendurar por esse tempo inteiro. Supabase edge functions têm billing por CPU-time — um timeout de Google API resulta em cobrança de ~150s de invocação por request.

**Impacto financeiro em rate abuse:** Se um tenant fizer 20 requests/hora (limite) e a Google API estiver degradada (pendurar 120s cada), o custo de edge function explode.

---

### [P2] — `gemini-live-token`: audit log fire-and-forget pode mascarar falhas silenciosas de tabela inexistente

**Arquivo:** `supabase/functions/gemini-live-token/index.ts:125-144`

```typescript
void (async () => {
  const logResult = await supabase.from('bi_voice_token_log').insert({ ... });
  if (logResult.error) {
    console.error('[gemini-live-token] audit log error:', JSON.stringify(logResult.error));
  }
})();
```

**O que acontece:**
Fire-and-forget é correto por design (não bloqueia response). O problema é que se a tabela `bi_voice_token_log` não existir (migration não aplicada, rollback), o erro é apenas logado — e a função retorna 200 com o token. O rate limiter na próxima request vai contar 0 registros na tabela ausente (a query SELECT retorna erro, count=null → `(count ?? 0) >= 20` = false), zerando o rate limit efetivamente.

**Sequência adversarial:**
1. Tabela `bi_voice_token_log` não existe (migration rollback)
2. Rate limit check: `countErr` setado → `return 500` (linha 64-66) ← correto, mas...
3. Se a tabela existe MAS insert falha por constraint → tokens são emitidos sem audit, rate limit conta 0

---

## Sumário

| Prioridade | Quantidade | Issues |
|---|---|---|
| **P0** | 2 | Race condition MFA guard; `lastGrantedAt` global mutable |
| **P1** | 3 | AAL check fail-open em ProtectedRoute; `factorId` vazio sem feedback; `setStatus` não vai para 'error'; `getProviderKey` null ambíguo |
| **P2** | 4 | `listFactors` sem error handling; `unenrollSelf` sem fallback no recovery; fetch sem timeout; audit log + rate limit acoplados |

**Total: 9 issues (2 P0, 3 P1, 4 P2)**

> Nenhuma correção aplicada nesta fase. Aguardando QA gate AUTH-V2-03c e conclusão de AUTH-V2-09 + BI-VOICE-01 pelo dev-dev-beta para iniciar hardening.
