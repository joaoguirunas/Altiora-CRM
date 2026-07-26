---
title: "ADR-AUTH-02: fallbackProfile com timeout de 2s — trade-off UX vs segurança"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, auth, ux, security, profile, timeout]
related: ["[[ADR-AUTH-01-hostname-bootstrap]]", "[[ADR-AUTH-03-restricted-route-control-plane]]"]
---

# ADR-AUTH-02: fallbackProfile com timeout de 2s — trade-off UX vs segurança

## Context

`useSimpleAuth.fetchUserProfile(authUser)` faz SELECT em `settings_users` para obter o profile do usuário (role, permissions). Se essa query demorar (DB lento, cold start da edge function, RLS complexa), o usuário fica numa tela de loading indefinidamente — degradação de UX severa.

Opções:
1. **Aguardar indefinidamente** — seguro (profile real sempre), mas trava a UI em casos de lentidão. Risco de usuário ver tela em branco por >10s.
2. **Erro explícito + retry** — boa semântica, mas requer que o usuário tome ação (recarregar).
3. **Timeout com fallback profile** — após N segundos, montar um profile degradado (`user_type: 'atendente'`, `super_adm: false`) e liberar a UI. Usuário vê o app imediatamente; permissions são as mais restritivas possíveis.
4. **Spinner de loading máximo** — manter loading state por máximo N segundos; se não resolveu, redirecionar para login.

## Decision

**Timeout de 2s (default, configurável via env) com fallback profile para o role mais restritivo (`atendente`, `super_adm: false`).**

```ts
// VITE_AUTH_PROFILE_TIMEOUT_MS pode sobrescrever o default em ambientes lentos.
// VITE_AUTH_INIT_TIMEOUT_MS faz o mesmo para o timeout outer de inicialização (default 3s).
const timer = setTimeout(() => {
  if (isFetchingProfile.current) {
    setUser({ ...authUser, profile: { ...fallbackProfile, isProvisional: true } });
    setIsLoading(false);
  }
}, PROFILE_FETCH_TIMEOUT_MS);
```

O `fallbackProfile` tem `user_type: 'atendente'` — o role de menor permissão no sistema. Isso significa:
- Não é `gestor`: não acessa Settings, não pode mudar filtros.
- Não é `super_adm`: não acessa `/adm`.
- Queries que usam `useUserPermissions.getResponsavelFilter()` com role `atendente` retornam `currentUserId` — só vê seus próprios dados.

`isValid` em `useUserPermissions` retorna `false` quando profile está em fallback (detectado por `profile.isProvisional` — débito: ainda não implementado). Hooks respeitosos propagam `__INVALID_USER__` sentinel para abortar queries.

Timeout adicional de 3s (`initializeAuth`) força `isLoading=false` mesmo se `fetchUserProfile` nem começou — defesa contra cenários extremos de travamento.

## Consequences

**Positivo:**
- UI nunca trava indefinidamente — usuário sempre vê o app em menos de 2s após login.
- Fallback é o role mais restritivo — não expõe dados indevidos em caso de profile ausente.
- Cold starts do DB/edge function (comuns após períodos de inatividade) não degradam experiência de login.

**Negativo / trade-offs:**
- **Permissões degradadas sem aviso visual**: ~~planejado~~ resolvido em AUTH-V2-02 / FIX-AUTH-01: `fallbackProfile.isProvisional = true` é hoje propagado por `useUserPermissions` (`canChangeFilters`, `canCreate*`, `canDelete*`, `getResponsavelFilter`, `getTeamFilter` retornam falsy/sentinel quando `isProvisional`). UI exibe toast de aviso em `DashLayout` enquanto `isProvisional` for true.
- **Mutations inseguras**: hooks que não verificam `isValid` podem executar mutations com role `atendente` quando o user real é `gestor`. Mitigação atual: `__INVALID_USER__` sentinel em queries, mas mutations precisam de verificação explícita.
- **RLS não depende do profile do app**: RLS Postgres usa `auth.jwt()` claims — o `user_type` da tabela `settings_users` é apenas para UI/UX decisions. Vazamento de dados via RLS não é possível via fallback profile (o JWT tem as claims corretas independente do profile app).
- **2s pode ser curto**: em DB muito lentos ou cold starts extremos, o profile real pode chegar logo após o timeout — resultado: user vê o app com fallback por 50-200ms antes de re-renderizar com profile real.

**Arquivos relevantes:**
- `src/hooks/useSimpleAuthSingleTenant.ts` — `fetchUserProfile()`, `initializeAuth()`
- `src/hooks/useUserPermissions.ts` — `__INVALID_USER__` sentinel, `isValid`
