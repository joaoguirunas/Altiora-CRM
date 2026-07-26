#!/usr/bin/env node
/**
 * squash-baseline.js — REL-05 AC1
 *
 * Gera um candidato de baseline SQL a partir das migrations existentes.
 * Extrai apenas DDL (filtra DML como INSERTs de dados, mas preserva seeds
 * críticos marcados com -- @include-in-baseline).
 *
 * NÃO move nem deleta arquivos originais — gera apenas o candidato.
 * Aprovação e arquivamento são feitos via .github/workflows/baseline-approve.yml
 *
 * Uso:
 *   node scripts/squash-baseline.js [opções]
 *
 * Opções:
 *   --up-to <timestamp>   Inclui apenas migrations com timestamp ≤ este valor
 *                         Ex: --up-to 20260724999999
 *   --auto                Usa todas as migrations (ignora --up-to)
 *   --threshold <n>       Override do threshold de aviso (default: 100)
 *   --output <path>       Pasta de saída (default: supabase/migrations)
 *   --version <N>         Número de versão do baseline (default: auto-incremento)
 *   --dry-run             Mostra o que seria gerado sem gravar arquivos
 *
 * Saída:
 *   supabase/migrations/_baseline_vN.candidate.sql
 *   docs/smart-memory/ops/baseline-vN-report.md
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const process = require('process');

// ── Configuração ─────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, '..');
const MIGRATIONS   = path.join(ROOT, 'supabase', 'migrations');
const REPORTS_DIR  = path.join(ROOT, 'docs', 'smart-memory', 'ops');

const ARGS = parseArgs(process.argv.slice(2));
const THRESHOLD = parseInt(ARGS['threshold'] ?? '100', 10);
const DRY_RUN   = ARGS['dry-run'] === true;
const AUTO      = ARGS['auto'] === true;
const UP_TO     = ARGS['up-to'] ?? null;
const OUTPUT    = ARGS['output'] ?? MIGRATIONS;

// ── Padrões de detecção ───────────────────────────────────────────────────────

// Linhas que são quase certamente DML puro (excluídas do baseline)
const DML_PATTERNS = [
  /^\s*INSERT\s+INTO\s+/i,
  /^\s*UPDATE\s+\w/i,
  /^\s*DELETE\s+FROM\s+/i,
  /^\s*COPY\s+\w/i,
];

// Padrões de DDL/controle que DEVEM ser incluídos
const DDL_PATTERNS = [
  /^\s*CREATE\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*DROP\s+/i,
  /^\s*GRANT\s+/i,
  /^\s*REVOKE\s+/i,
  /^\s*BEGIN\s*;?/i,
  /^\s*COMMIT\s*;?/i,
  /^\s*ROLLBACK\s*;?/i,
  /^\s*DO\s+/i,
  /^\s*SELECT\s+cron\./i,
  /^\s*SELECT\s+set_config\s*\(/i,
  /^\s*COMMENT\s+ON\s+/i,
];

// Warnings que merecem atenção manual
const WARNING_PATTERNS = [
  { re: /gen_random_uuid\(\)/i,              code: 'W001', msg: 'gen_random_uuid() — resultado não-determinístico em seeds' },
  { re: /now\(\)\s*$/i,                      code: 'W002', msg: 'now() em DEFAULT — aceitável em CREATE TABLE, verificar em DML' },
  { re: /^\s*DROP\s+TABLE\s+/i,              code: 'W003', msg: 'DROP TABLE detectado — verifique se é intencionalmente irreversível' },
  { re: /^\s*DROP\s+DATABASE\s+/i,           code: 'W004', msg: 'DROP DATABASE — NUNCA incluir em baseline' },
  { re: /current_setting\('app\./i,          code: 'W005', msg: 'GUC app.* — pode falhar em ambiente de dry-run sem GUCs configuradas' },
];

// ── Main ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('\n❌  Erro fatal:', err.message);
  process.exit(1);
});

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  squash-baseline.js — REL-05 AC1');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── 1. Coletar migrations ─────────────────────────────────────────────────
  const allFiles = fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql')
      && !f.startsWith('_')           // exclui _TEMPLATE.sql e _baseline_*.sql
      && !f.startsWith('.')
    )
    .sort();                           // ordem cronológica (timestamp prefix)

  console.log(`\n  Total de migrations encontradas: ${allFiles.length}`);

  if (allFiles.length < THRESHOLD && !AUTO) {
    console.log(`  ⚠️  Abaixo do threshold de ${THRESHOLD} migrations.`);
    console.log(`     Use --auto para forçar geração mesmo abaixo do threshold.`);
    if (!DRY_RUN) process.exit(0);
  }

  // ── 2. Filtrar por --up-to ────────────────────────────────────────────────
  let included = allFiles;
  if (UP_TO && !AUTO) {
    included = allFiles.filter(f => {
      const ts = f.match(/^(\d{14})/)?.[1];
      return ts && ts <= UP_TO;
    });
    console.log(`  Filtrado por --up-to ${UP_TO}: ${included.length} migrations`);
  }

  if (included.length === 0) {
    console.error('  ❌  Nenhuma migration para incluir.');
    process.exit(1);
  }

  const firstTs = included[0].match(/^(\d{14})/)?.[1] ?? '?';
  const lastTs  = included[included.length - 1].match(/^(\d{14})/)?.[1] ?? '?';

  // ── 3. Determinar versão do baseline ─────────────────────────────────────
  const existingBaselines = fs.readdirSync(MIGRATIONS)
    .filter(f => f.match(/^_baseline_v(\d+)\.sql$/))
    .map(f => parseInt(f.match(/^_baseline_v(\d+)/)[1], 10));
  const nextVersion = ARGS['version']
    ? parseInt(ARGS['version'], 10)
    : (existingBaselines.length > 0 ? Math.max(...existingBaselines) + 1 : 1);

  console.log(`  Versão do baseline: v${nextVersion}`);
  console.log(`  Período: ${firstTs} → ${lastTs}`);

  // ── 4. Processar cada migration ───────────────────────────────────────────
  const warnings     = [];
  const includedSeeds = [];
  const excludedDml   = [];
  const sections      = [];

  for (const filename of included) {
    const filepath = path.join(MIGRATIONS, filename);
    const raw      = fs.readFileSync(filepath, 'utf8');
    const lines    = raw.split('\n');

    const includedLines = [];
    let   prevWasBlank  = false;
    let   forceInclude  = false;  // set by -- @include-in-baseline marker

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Marcador explícito para incluir bloco seguinte (ex: seeds críticos)
      if (/--\s*@include-in-baseline/i.test(line)) {
        forceInclude = true;
        includedLines.push(line);
        continue;
      }
      if (forceInclude && line.trim() === '') {
        forceInclude = false;
      }

      // Detectar DML puro (não forçado)
      if (!forceInclude && DML_PATTERNS.some(re => re.test(line))) {
        excludedDml.push({ file: filename, line: i + 1, content: line.trim().slice(0, 80) });
        continue;
      }

      // Verificar warnings
      for (const { re, code, msg } of WARNING_PATTERNS) {
        if (re.test(line)) {
          warnings.push({ file: filename, line: i + 1, code, msg });
        }
      }

      // Compactar linhas em branco consecutivas
      if (line.trim() === '') {
        if (!prevWasBlank) includedLines.push('');
        prevWasBlank = true;
      } else {
        prevWasBlank = false;
        includedLines.push(line);
      }
    }

    if (includedLines.length > 0 && includedLines.some(l => l.trim())) {
      sections.push({
        filename,
        content: includedLines.join('\n').trimEnd(),
      });
    }
  }

  // ── 5. Gerar conteúdo do baseline ─────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const header = [
    `-- ${'═'.repeat(78)}`,
    `-- BASELINE v${nextVersion} — squashed ${included.length} migrations`,
    `-- Generated : ${generatedAt}`,
    `-- Period    : ${firstTs} → ${lastTs}`,
    `-- Script    : scripts/squash-baseline.js (REL-05 AC1)`,
    `--`,
    `-- ⚠️  DO NOT EDIT MANUALLY — arquivo gerado automaticamente.`,
    `-- Para aplicar: abra PR com label baseline-squash-approved`,
    `--               e aguarde baseline-approve.yml renomear para _baseline_v${nextVersion}.sql`,
    `-- ${'═'.repeat(78)}`,
    '',
  ].join('\n');

  const body = sections.map(({ filename, content }) => [
    `-- ${'─'.repeat(78)}`,
    `-- Migration: ${filename}`,
    `-- ${'─'.repeat(78)}`,
    '',
    content,
    '',
  ].join('\n')).join('\n');

  const candidateContent = header + body;
  const candidateHash    = crypto.createHash('sha256').update(candidateContent).digest('hex').slice(0, 12);
  const candidateFile    = `_baseline_v${nextVersion}.candidate.sql`;
  const candidatePath    = path.join(OUTPUT, candidateFile);

  // ── 6. Gravar candidato ───────────────────────────────────────────────────
  if (!DRY_RUN) {
    fs.writeFileSync(candidatePath, candidateContent, 'utf8');
    console.log(`\n  ✅  Candidato gerado: supabase/migrations/${candidateFile}`);
    console.log(`      Tamanho: ${(candidateContent.length / 1024).toFixed(1)} KB`);
    console.log(`      Hash: ${candidateHash}`);
  } else {
    console.log(`\n  [DRY-RUN] Candidato seria: supabase/migrations/${candidateFile}`);
    console.log(`  [DRY-RUN] Tamanho: ${(candidateContent.length / 1024).toFixed(1)} KB`);
  }

  // ── 7. Gerar relatório ────────────────────────────────────────────────────
  const reportFile = `baseline-v${nextVersion}-report-${generatedAt.slice(0, 10)}.md`;
  const reportPath = path.join(REPORTS_DIR, reportFile);

  const warnTable = warnings.length > 0
    ? warnings.map(w => `| ${w.file} | ${w.line} | ${w.code} | ${w.msg} |`).join('\n')
    : '_Nenhum warning detectado._';

  const excludedTable = excludedDml.length > 0
    ? excludedDml.slice(0, 20).map(e => `| ${e.file} | ${e.line} | ${e.content} |`).join('\n')
      + (excludedDml.length > 20 ? `\n_... e mais ${excludedDml.length - 20} linhas DML_` : '')
    : '_Nenhuma linha DML excluída._';

  const report = `---
title: "Baseline v${nextVersion} — Relatório de squash"
type: ops-report
generated: ${generatedAt}
tags: [baseline, squash, rel-05]
---

# Baseline v${nextVersion} — Relatório de squash

## Sumário

| Campo | Valor |
|---|---|
| Versão | v${nextVersion} |
| Migrations incluídas | ${included.length} |
| Período | ${firstTs} → ${lastTs} |
| Linhas DML excluídas | ${excludedDml.length} |
| Warnings | ${warnings.length} |
| Gerado em | ${generatedAt} |
| Hash candidato (SHA-256 prefix) | ${candidateHash} |

## Próximos passos

1. Revisar `supabase/migrations/${candidateFile}` manualmente.
2. Verificar todos os **${warnings.length} warnings** abaixo.
3. Abrir PR com label \`baseline-squash-approved\` para acionar \`baseline-approve.yml\`.
4. O workflow fará dry-run, renomeará para \`_baseline_v${nextVersion}.sql\` e moverá originais para \`archived/v${nextVersion}/\`.

## Warnings (requerem revisão manual)

| Arquivo | Linha | Código | Descrição |
|---|---|---|---|
${warnTable}

## Linhas DML excluídas (amostra)

| Arquivo | Linha | Conteúdo |
|---|---|---|
${excludedTable}

## Migrations incluídas (${included.length})

${included.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}
`;

  if (!DRY_RUN) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`  ✅  Relatório gerado: docs/smart-memory/ops/${reportFile}`);
  } else {
    console.log(`  [DRY-RUN] Relatório seria: docs/smart-memory/ops/${reportFile}`);
  }

  // ── 8. Sumário final ──────────────────────────────────────────────────────
  console.log('\n  ─── Sumário ────────────────────────────────────────────');
  console.log(`  Migrations incluídas : ${included.length}`);
  console.log(`  Linhas DML excluídas : ${excludedDml.length}`);
  console.log(`  Warnings             : ${warnings.length}`);

  if (warnings.length > 0) {
    console.log('\n  ⚠️  Warnings detectados (revisar antes de aprovar):');
    const shown = warnings.slice(0, 10);
    for (const w of shown) {
      console.log(`     [${w.code}] ${w.file}:${w.line} — ${w.msg}`);
    }
    if (warnings.length > 10) console.log(`     ... e mais ${warnings.length - 10} warnings.`);
  }

  console.log('\n  ✅  Candidato pronto para revisão manual.');
  console.log('     Após revisar: git add + PR com label baseline-squash-approved');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!DRY_RUN && warnings.filter(w => w.code === 'W004').length > 0) {
    console.error('  ❌  ERRO CRÍTICO: DROP DATABASE detectado. Remova antes de aprovar.');
    process.exit(1);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}
