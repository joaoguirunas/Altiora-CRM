import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildAltioraInvite, formatConsultorPhone, isAltioraMeetingType } from './altiora-invite-template.ts';

const BASE_INPUT = {
  tipo: 'R1' as const,
  clientName: 'Maria Silva',
  provider: 'Google Meet' as const,
  durationMinutes: 40,
  consultorNome: 'Rafael',
  consultorTelefone: null,
};

Deno.test('sem colaboradores — assinatura idêntica ao comportamento legado (regressão ALTIORA-29)', () => {
  const invite = buildAltioraInvite(BASE_INPUT);
  assertStringIncludes(invite.description, 'Rafael — Altiora Advisory Group');
});

Deno.test('colaboradores ausente (undefined) — mesmo resultado que array vazio', () => {
  const withUndefined = buildAltioraInvite({ ...BASE_INPUT, colaboradores: undefined });
  const withoutField = buildAltioraInvite(BASE_INPUT);
  assertEquals(withUndefined.description, withoutField.description);
});

Deno.test('1 colaborador — "Organizador e Colaborador — Altiora Advisory Group"', () => {
  const invite = buildAltioraInvite({
    ...BASE_INPUT,
    colaboradores: [{ nome: 'André' }],
  });
  assertStringIncludes(invite.description, 'Rafael e André — Altiora Advisory Group');
});

Deno.test('2 colaboradores — vírgula entre os intermediários, "e" antes do último', () => {
  const invite = buildAltioraInvite({
    ...BASE_INPUT,
    colaboradores: [{ nome: 'André' }, { nome: 'Bruna' }],
  });
  assertStringIncludes(invite.description, 'Rafael, André e Bruna — Altiora Advisory Group');
});

Deno.test('colaborador com nome vazio/null é ignorado, sem quebrar a assinatura', () => {
  const invite = buildAltioraInvite({
    ...BASE_INPUT,
    colaboradores: [{ nome: '   ' }, { nome: null }, { nome: 'André' }],
  });
  assertStringIncludes(invite.description, 'Rafael e André — Altiora Advisory Group');
});

Deno.test('sem consultorNome mas com colaboradores — assinatura só com os colaboradores', () => {
  const invite = buildAltioraInvite({
    ...BASE_INPUT,
    consultorNome: null,
    colaboradores: [{ nome: 'André' }, { nome: 'Bruna' }],
  });
  assertStringIncludes(invite.description, 'André e Bruna — Altiora Advisory Group');
});

Deno.test('nem consultorNome nem colaboradores — fallback genérico legado', () => {
  const invite = buildAltioraInvite({ ...BASE_INPUT, consultorNome: null, colaboradores: [] });
  assertStringIncludes(invite.description, '\nAltiora Advisory Group');
});

Deno.test('títulos R1/R2/R3 (ajustados 2026-08-07) permanecem os esperados', () => {
  assertEquals(buildAltioraInvite({ ...BASE_INPUT, tipo: 'R1' }).title, 'Wealth Planning Discovery — Maria Silva');
  assertEquals(buildAltioraInvite({ ...BASE_INPUT, tipo: 'R2' }).title, 'Wealth Planning Presentation — Maria Silva');
  assertEquals(buildAltioraInvite({ ...BASE_INPUT, tipo: 'R3' }).title, 'IUL Implementation — Maria Silva');
});

Deno.test('EXTRA — título padrão da reunião avulsa (o closer troca no modal)', () => {
  const invite = buildAltioraInvite({ ...BASE_INPUT, tipo: 'EXTRA' });
  assertEquals(invite.title, 'Reunião Extra — Maria Silva');
  assertStringIncludes(invite.description, 'Olá, Maria Silva.');
});

Deno.test('isAltioraMeetingType e formatConsultorPhone seguem funcionando (smoke test de regressão)', () => {
  assertEquals(isAltioraMeetingType('R1'), true);
  assertEquals(isAltioraMeetingType('EXTRA'), true);
  assertEquals(isAltioraMeetingType('R4'), false);
  assertEquals(formatConsultorPhone('11912345678'), '+55 (11) 91234-5678');
});
