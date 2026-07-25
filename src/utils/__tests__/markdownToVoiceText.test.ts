/**
 * bi-1 — AC6: Testes unitários markdownToVoiceText
 *
 * Requer vitest (não instalado ainda).
 * Setup: npm add -D vitest && npx vitest run src/utils/__tests__
 */

import { describe, it, expect } from 'vitest';
import { markdownToVoiceText } from '../markdownToVoiceText';

// ── AC2: chart spec válida ────────────────────────────────────────────────────

describe('chart blocks', () => {
  it('AC2 — extracts type + title from valid chart JSON', () => {
    const md = `
# Receita por canal

\`\`\`chart
{ "type": "bar", "title": "Receita por canal", "data": [] }
\`\`\`

Veja a análise acima.
`.trim();

    const result = markdownToVoiceText(md);
    expect(result).toContain('Gráfico de barras: Receita por canal.');
    expect(result).not.toContain('```');
    expect(result).not.toContain('"type"');
  });

  it('AC2 — line chart with title', () => {
    const md = '```chart\n{"type":"line","title":"Evolução de leads"}\n```';
    const result = markdownToVoiceText(md);
    expect(result).toContain('Gráfico de linhas: Evolução de leads.');
  });

  it('AC2 — returns empty for invalid JSON (no JSON noise vocalized)', () => {
    const md = '```chart\nNOT-VALID-JSON\n```\n\nTexto após.';
    const result = markdownToVoiceText(md);
    expect(result).not.toContain('NOT-VALID-JSON');
    expect(result).not.toContain('{');
    expect(result).toContain('Texto após.');
  });

  it('AC2 — returns empty for chart with no title or type', () => {
    const md = '```chart\n{"data": [1,2,3]}\n```\n\nOutro texto.';
    const result = markdownToVoiceText(md);
    // empty phrase → no chart noise
    expect(result).not.toContain('```');
    expect(result).not.toContain('"data"');
  });
});

// ── AC3: tabela 3×3 ───────────────────────────────────────────────────────────

describe('table blocks', () => {
  it('AC3 — converts 3-column table to summary phrase', () => {
    const md = `
| Vendedor | Deals | Receita |
| --- | --- | --- |
| Ana | 10 | 50k |
| Bia | 7  | 35k |
| Carlos | 5 | 25k |
`.trim();

    const result = markdownToVoiceText(md);
    expect(result).toMatch(/Tabela com 3 linhas comparando Vendedor, Deals, Receita/);
    expect(result).not.toContain('|');
    expect(result).not.toContain('---');
  });

  it('AC3 — single data row uses singular', () => {
    const md = `| Nome | Valor |\n| --- | --- |\n| Item A | 100 |`;
    const result = markdownToVoiceText(md);
    expect(result).toMatch(/Tabela com 1 linha comparando Nome, Valor/);
  });

  it('AC3 — table column names are extracted from header', () => {
    const md = `| Canal | Impressões | Cliques | CPC | CPA |\n| --- | --- | --- | --- | --- |\n| Meta | 1000 | 50 | 2 | 10 |\n| Google | 800 | 40 | 3 | 12 |`;
    const result = markdownToVoiceText(md);
    expect(result).toMatch(/Canal, Impressões, Cliques, CPC, CPA/);
  });
});

// ── Mixed: bullets + tabela + chart ──────────────────────────────────────────

describe('mixed content', () => {
  it('strips bullets, tables and charts — returns clean readable text', () => {
    const md = `
## Resumo executivo

O mês fechou com resultados positivos:

- Receita cresceu 12%
- CAC reduziu 5%
- Show rate estável

\`\`\`chart
{ "type": "pie", "title": "Distribuição por canal" }
\`\`\`

| Métrica | Valor |
| --- | --- |
| Receita | R$50k |
| Leads | 120 |

Conclusão: performance sólida.
`.trim();

    const result = markdownToVoiceText(md);

    // Bullets collapsed
    expect(result).not.toMatch(/^[-*+]/m);
    // Table removed
    expect(result).not.toContain('|');
    // Chart extracted as phrase
    expect(result).toContain('Gráfico de pizza: Distribuição por canal.');
    // Table phrase
    expect(result).toMatch(/Tabela com 2 linhas comparando Métrica, Valor/);
    // Heading text preserved (without #)
    expect(result).toContain('Resumo executivo');
    // Natural text preserved
    expect(result).toContain('Conclusão: performance sólida.');
  });
});

// ── AC4: sumarizador (> 600 chars) ───────────────────────────────────────────

describe('summarizer', () => {
  it('AC4 — text below 600 chars is returned verbatim', () => {
    const shortText = 'A receita cresceu 12% este mês. O CAC reduziu 5%. Excelentes resultados.';
    const result = markdownToVoiceText(shortText);
    expect(result).toBe(shortText);
  });

  it('AC4 — text above 600 chars is truncated with panel reference', () => {
    const longSentences = Array.from({ length: 20 }, (_, i) =>
      `Frase número ${i + 1} com dados relevantes sobre vendas e performance do período.`,
    ).join(' ');

    expect(longSentences.length).toBeGreaterThan(600);

    const result = markdownToVoiceText(longSentences);
    expect(result.length).toBeLessThan(longSentences.length);
    expect(result).toContain('Veja o painel para detalhes completos.');
  });

  it('AC4 — opts.maxChars overrides default 600 threshold', () => {
    const text = 'Resultado positivo. Performance acima da meta.';
    // With very low maxChars, should summarize even short text
    const resultNormal = markdownToVoiceText(text);
    expect(resultNormal).toBe(text); // under 600 → verbatim

    const resultShortMax = markdownToVoiceText(text, { maxChars: 10 });
    // Over threshold → summarized/truncated
    expect(resultShortMax).toContain('Veja o painel para detalhes completos.');
  });

  it('AC4 — summarizer preserves sentences with numbers', () => {
    const textWithNumbers = [
      'Este é o relatório mensal de performance.',
      'Receita total: R$ 120.000.',
      'CAC médio: R$ 350.',
      'Show rate: 68%.',
      'Leads gerados: 450 no período.',
      'Taxa de conversão: 12%.',
      'Pipeline total: R$ 800.000.',
      'Churn rate: 2,1%.',
      'NPS: 72 pontos.',
    ].join(' ');

    const paddedText = textWithNumbers + ' '.repeat(100) + 'Análise completa disponível no painel.';
    if (paddedText.length > 600) {
      const result = markdownToVoiceText(paddedText);
      // Should prioritize numeric sentences
      expect(result).toMatch(/\d|%|R\$/);
    }
  });
});

// ── AC1: markdown formatting removal ─────────────────────────────────────────

describe('markdown formatting removal', () => {
  it('removes bold/italic markers', () => {
    const result = markdownToVoiceText('**Receita** cresceu _muito_ este mês.');
    expect(result).not.toContain('**');
    expect(result).not.toContain('_');
    expect(result).toContain('Receita');
    expect(result).toContain('muito');
  });

  it('removes inline code backticks', () => {
    const result = markdownToVoiceText('Use `supabase.from()` para consultar.');
    expect(result).not.toContain('`');
    expect(result).toContain('supabase.from()');
  });

  it('removes raw URLs', () => {
    const result = markdownToVoiceText('Acesse https://app.growthsales.com.br/dashboard para ver.');
    expect(result).not.toContain('https://');
    expect(result).toContain('Acesse');
    expect(result).toContain('para ver.');
  });

  it('preserves link text, removes URL', () => {
    const result = markdownToVoiceText('Veja o [painel de métricas](https://app.growthsales.com.br).');
    expect(result).toContain('painel de métricas');
    expect(result).not.toContain('https://');
    expect(result).not.toContain('(');
  });

  it('handles empty string input', () => {
    expect(markdownToVoiceText('')).toBe('');
  });

  it('handles malformed markdown without throwing', () => {
    expect(() => markdownToVoiceText('```\n\n```\n**unclosed bold')).not.toThrow();
  });
});
