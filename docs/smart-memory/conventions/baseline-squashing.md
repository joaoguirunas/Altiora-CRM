---
title: "Baseline Squashing — Convenções e Protocolo"
type: convention
agent: dev-data-engineer
updated: 2026-07-25
tags: [convention, baseline, squashing, migrations, rel-05, release-pipeline]
related: [[../stories/done/REL-05]], [[migrations-discipline]], [[../agents/data-engineer/migrations-log]]
---

# Baseline Squashing — Convenções e Protocolo

## O que é squashing

Baseline squashing é o processo de consolidar N migrations incrementais em um único arquivo `_baseline_vN.sql` que representa o schema completo em um ponto no tempo.

**Threshold para squash:** 100+ migrations ativas (configurável via `--threshold`).
**Frequência esperada:** a cada ~100 novas migrations; cron semanal notifica quando próximo.

---

## Quando fazer squash

| Sinal | Ação |
|---|---|
| Cron `adm-baseline-check` notifica: migrations ativas > 100 | Agendar PR de squash |
| Onboarding de novo tenant demora > 5 min | Squash urgente |
| Mais de 6 meses sem squash | Avaliar proativamente |

**Nunca squash quando:**
- Branch de feature grande em andamento (espere o merge)
- Migration de rollback em trânsito
- Incidente ativo no ambiente de produção

---

## Protocolo passo a passo

### 1. Gerar candidato

```bash
# Threshold padrão (100 migrations):
node scripts/squash-baseline.js --auto

# Squash até timestamp específico (deixa migrations posteriores livres):
node scripts/squash-baseline.js --up-to 20260724999999

# Dry-run para ver o que seria gerado:
node scripts/squash-baseline.js --auto --dry-run
```

Saídas:
- `supabase/migrations/_baseline_v{N}.candidate.sql` — candidato para revisão
- `docs/smart-memory/ops/baseline-vN-report-YYYY-MM-DD.md` — relatório com warnings

### 2. Revisar candidato

```bash
# Abrir e revisar manualmente:
code supabase/migrations/_baseline_vN.candidate.sql

# Verificar warnings no relatório:
cat docs/smart-memory/ops/baseline-vN-report-*.md
```

**Checklist de revisão obrigatória:**

- [ ] Nenhum `DROP DATABASE` (W004 — workflow bloqueia, mas verificar)
- [ ] `DROP TABLE` existentes são intencionais (W003)
- [ ] `gen_random_uuid()` aparece apenas em `DEFAULT` de colunas, nunca em DML (W001)
- [ ] Funções com `current_setting('app.*')` têm GUCs documentadas (W005)
- [ ] Ordem de CREATE TABLE → ADD CONSTRAINT → CREATE INDEX está correta
- [ ] Seeds críticos marcados com `-- @include-in-baseline` foram incluídos
- [ ] Nenhum dado de usuário real no candidato

### 3. Criar PR e aguardar aprovação

```bash
git add supabase/migrations/_baseline_vN.candidate.sql
git add docs/smart-memory/ops/baseline-vN-report-*.md
git commit -m "chore(baseline): candidato v{N} para revisão [REL-05]"
git push origin feature/baseline-squash-vN
```

Abrir PR com:
- Label: `baseline-squash-approved` (após revisão aprovada)
- Título: `chore(baseline): squash v{N} — {count} migrations`

O workflow `baseline-approve.yml` irá automaticamente:
1. Fazer dry-run do candidato no banco
2. Renomear `.candidate.sql` → `_baseline_vN.sql`
3. Mover migrations originais para `supabase/migrations/archived/vN/`
4. Registrar em `adm_releases` com `is_baseline=true`
5. Commitar tudo na branch do PR

### 4. Merge e validação

Após aprovação do workflow: fazer merge normalmente. O baseline v{N} passa a ser o ponto de partida para novos tenants.

---

## Estrutura de arquivos

```
supabase/migrations/
├── _baseline_v1.sql           ← baseline ativo (squash de 1–886)
├── _baseline_v2.candidate.sql ← candidato aguardando revisão
├── 20260726000000_nova_feat.sql  ← delta migrations (posteriores ao baseline)
└── archived/
    └── v1/
        ├── README.md          ← gerado automaticamente pelo workflow
        ├── 20260101000000_initial.sql
        ├── 20260102000000_add_users.sql
        └── ... (originais arquivados — NUNCA deletar)
```

---

## Onboarding de novos tenants

Com baseline ativo, o `adm-sync-client` aplica:
1. `_baseline_vN.sql` (schema completo até vN)
2. Migrations delta (posteriores ao baseline, em ordem cronológica)

**Resultado:** onboarding de segundos em vez de minutos.

Sem baseline (nunca squashed): aplica todas as migrations desde a primeira — pode ser 700+ arquivos.

---

## Rollback de emergência

Se o baseline gerar problema descoberto após merge:

1. Via GitHub Actions (recomendado):
   - Acionar `baseline-restore.yml` manualmente via GitHub UI
   - Input `baseline_version`: versão do baseline problemático
   - Input `apply`: `true` apenas após dry-run aprovado

2. Manual (emergência extrema):
   ```bash
   # Mover archived de volta
   mv supabase/migrations/archived/vN/*.sql supabase/migrations/
   # Deletar o baseline problemático
   rm supabase/migrations/_baseline_vN.sql
   # Commitar e acionar re-deploy
   ```

---

## Seeds críticos

INSERTs de dados de configuração essencial (não dados de usuário) devem ser marcados para inclusão no baseline:

```sql
-- @include-in-baseline
INSERT INTO public.feature_flags (key, value, description) VALUES
  ('max_sends_per_day', '1000', 'Limite diário de envios por tenant');
```

Sem o marcador, o script filtra todos os INSERTs por segurança.

---

## Warnings comuns e resolução

| Código | Sinal | Ação |
|---|---|---|
| W001 | `gen_random_uuid()` | Verificar contexto — OK em DEFAULT de tabela, problema em seed com UUID fixo esperado |
| W002 | `now()` em DEFAULT | OK em CREATE TABLE; verificar se aparece em DML residual |
| W003 | `DROP TABLE` | Verificar se a tabela foi recriada mais adiante no baseline; se foi, manter ambos; se não, avaliar se é intencional |
| W004 | `DROP DATABASE` | **BLOQUEANTE** — remover antes de aprovar; workflow rejeita automaticamente |
| W005 | `current_setting('app.*')` | Documentar GUCs necessárias para ambiente de dry-run; adicionar ao `supabase/.env.example` |

---

## Política de aprovação

- **Quem aprova:** super-admin (usuário com acesso ao repositório + ao ADM)
- **Revisão mínima:** 1 pessoa além do autor do squash (4-eyes principle)
- **Nunca auto-aplicar:** `adm-baseline-check` apenas notifica — nunca gera nem aplica squash sozinho
- **Máximo 1 baseline ativo por vez:** `_baseline_v{N}.sql` substituído pelo próximo v{N+1} no próximo squash

---

## Referências

- Story: [[../stories/done/REL-05]] — implementação original
- Script: `scripts/squash-baseline.js`
- Workflows: `.github/workflows/baseline-approve.yml`, `.github/workflows/baseline-restore.yml`
- Migrations ADM: `supabase/migrations_adm/20260725330000_adm_releases_is_baseline.sql`
- Log de migrations: [[../agents/data-engineer/migrations-log]]
