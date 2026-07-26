---
title: Casos de Uso V1 — CRM Altiora
type: reference
updated: 2026-07-25
tags: [altiora, casos-de-uso, v1, referrals]
---

# Casos de Uso V1 — CRM Altiora Gestão de Referrals

Fonte: "CRM Altiora casos de uso — gestão de referrals", Versão 1.0, 24/07/2026, Ivanderlei Mendes.

## Pipeline — 13 Etapas

1. Novo referral
2. Encaminhado ao comercial
3. Contato iniciado
4. R1 agendada
5. R1 realizada
6. Análise Finvity
7. R2 agendada
8. R2 realizada
9. R3 agendada
10. R3 realizada / fechamento
11. Em contratação
12. Ganho
13. Perdido

## Perfis de Usuário

- **Administrador/RevOps** — Ivanderlei. Acesso amplo, configuração, indicadores, correções.
- **Gestor Comercial** — André. Recebe referrals, distribui closers, acompanha pipeline.
- **Closer** — Marco, Ellen, Kayan. Conduz contato, reuniões e fechamento.

## /01 — Casos de Uso Gerais

### UC01 · Autenticar Usuário (RF-01)
- Ator: Admin/RevOps, Gestor Comercial ou Closer
- Pós: Sessão com permissões do perfil
- Fluxo: login → valida identidade → aplica perfil → redireciona para página inicial permitida
- FA-01: Recuperar acesso (e-mail de redefinição)
- FE-01: Credenciais inválidas/conta bloqueada — sem revelar dados sensíveis
- Req: RNF-02 · RNF-03 · RNF-09

### UC02 · Consultar e Editar Perfil (RF-01, RF-10)
- Ator: Usuário autenticado
- Pós: Dados atualizados, histórico registrado
- Fluxo: acessar perfil → apresenta nome, contato, função, fuso horário, integrações → alterar → validar → salvar
- FA-01: Campos administrados centralmente (somente Admin/RevOps altera)
- FE-01: Dados inválidos — destaca campos e retorna para edição
- Req: RNF-02 · RNF-03 · RNF-05

### UC03 · Pesquisar e Filtrar Referrals (RF-21)
- Ator: Usuário autenticado
- Pós: Lista de referrals filtrada por perfil
- Filtros: nome, e-mail, telefone, etapa, closer, origem, data, reunião, produto, motivo de perda
- FA-01: Salvar visão de filtro (quando habilitada)
- FE-01: Nenhum resultado — mantém filtros disponíveis
- Req: RNF-02 · RNF-05 · RNF-06

### UC04 · Consultar Ficha e Histórico do Referral (RF-06, RF-07)
- Ator: Usuário com acesso ao referral
- Pós: Ficha consultada, informações disponíveis
- Fluxo: selecionar referral → exibe contato, origem, responsável, etapa, próxima ação, reuniões, links, anexos, observações, status → linha do tempo → iniciar ação permitida
- FA-01: Dados restritos — oculta documentos/valores/campos fora do perfil
- FE-01: Referral inexistente — informa e retorna à lista
- Req: RNF-02 · RNF-03 · RNF-05 · RNF-09

## /02 — Administrador / RevOps

### UC05 · Gerenciar Usuários e Permissões (RF-01)
- Ator: Administrador/RevOps
- Pós: Conta criada/atualizada/bloqueada/reativada com auditoria
- Fluxo: acessa gestão → apresenta contas/perfis/status → cria ou seleciona → define dados, perfil, escopo → valida conflitos → salva → registra
- FA-01: Bloquear ou reativar usuário
- FE-01: Perfil incompatível ou usuário duplicado
- Req: RNF-02 · RNF-03 · RNF-09

### UC06 · Configurar Etapas e Parâmetros do Pipeline (RF-05, RF-20)
- Ator: Administrador/RevOps
- Pós: Parâmetros atualizados sem apagar histórico
- Fluxo: acessar configurações → apresenta etapas, campos obrigatórios, alertas → alterar parâmetro → informa impactos → confirma → salva e versiona
- FA-01: Reordenar ou desativar etapa futura (confirma e preserva histórico)
- FE-01: Alteração incompatível com referrals ativos — bloqueia ou exige estratégia de migração
- Req: RNF-01 · RNF-03 · RNF-05

### UC07 · Monitorar Integrações e Falhas (RF-20, RF-23)
- Ator: Administrador/RevOps
- Pós: Status das integrações consultado, ações de contingência disponíveis
- Fluxo: painel de integrações (e-mail, Google Calendar, WhatsApp, Elephan, Finvity) com status e última sincronização → seleciona falha → mostra contexto e referral afetado → reprocessa/marca manual/registra observação
- FA-01: Integração desativada na V1 — informa como não obrigatória + procedimento manual
- FE-01: Serviço externo indisponível — registra e mantém operação manual disponível
- Req: RNF-03 · RNF-04 · RNF-06

### UC08 · Corrigir Dados e Falhas de Automação (RF-23, RF-07)
- Ator: Administrador/RevOps ou Gestor Comercial autorizado
- Pós: Registro corrigido sem apagar evidência anterior
- Fluxo: acessa ficha ou fila de falhas → apresenta dados atuais e origem → seleciona ação de correção → exige confirmação para campos críticos → confirma → salva antes/depois, autor e motivo
- FA-01: Mesclar referrals duplicados (escolhe principal, transfere informações, preserva referências)
- FE-01: Correção gera conflito de integridade — informa e bloqueia
- Req: RNF-01 · RNF-03 · RNF-04

### UC09 · Consultar Indicadores Operacionais (RF-19)
- Ator: Administrador/RevOps ou Gestor Comercial
- Pós: Indicadores apresentados por período/filtros/permissões
- Indicadores: referrals recebidos, atribuição, contato, resposta, reuniões, comparecimento, conversão, ciclo, ganhos, perdas
- Filtros: período, closer, origem, etapa
- FA-01: Indicador dependente de SLA — apresenta tempo medido sem classificar cumprimento (SLA ainda não definido)
- FE-01: Dados insuficientes — informa limitação sem estimativas não suportadas
- Req: RNF-02 · RNF-05 · RNF-06

## /03 — Gestor Comercial

### UC10 · Receber Referral Automaticamente por E-mail (RF-02)
- Ator: Matheus/Avenue (via e-mail de handoff)
- Pós: Referral criado na etapa "Novo referral" com origem, data/hora, conteúdo e vínculo ao e-mail
- Fluxo: Avenue envia e-mail → valida remetente, destinatário e conteúdo mínimo → verifica duplicata → extrai dados → cria referral → registra origem → notifica Gestor Comercial
- FA-01: Dados incompletos — cria com pendência de validação, orienta gestor a completar
- FE-01: E-mail inválido ou duplicado — não cria referral, registra na fila de revisão com motivo
- Req: RNF-01 · RNF-03 · RNF-04 · RNF-09

### UC11 · Cadastrar Referral Manualmente (RF-03)
- Ator: Admin/RevOps, Gestor Comercial ou Closer autorizado
- Pós: Referral válido criado, identificado como cadastro manual, disponível no pipeline
- Fluxo: seleciona "Novo referral manual" → apresenta campos mínimos → usuário informa cliente, contato, origem, data handoff, observações → procura duplicatas → revisa e confirma → cria e registra autor, data, origem manual
- FA-01: Closer sem permissão padrão — somente quando perfil possui autorização específica
- FE-01: Possível duplicidade — exibe registros semelhantes (cancelar, abrir existente ou confirmar com justificativa)
- Req: RNF-01 · RNF-02 · RNF-03

### UC12 · Atribuir Referral ao Closer (RF-04)
- Ator: Gestor Comercial (apoiado por integração de e-mail)
- Pós: Referral com Closer responsável, data de atribuição e histórico da decisão
- Fluxo: gestor encaminha/responde e-mail com Closer → sistema reconhece destinatário → associa ao Closer → move para "Encaminhado ao comercial" → registra data, gestor, Closer, origem da atribuição → notifica Closer
- FA-01: Atribuição manual — gestor abre referral, escolhe Closer e confirma; sistema registra que foi manual
- FE-01: Closer não reconhecido ou múltiplos destinatários — mantém sem atribuição automática e solicita decisão manual
- Req: RNF-01 · RNF-03 · RNF-04

### UC13 · Corrigir Atribuição Automática (RF-04, RF-23)
- Ator: Gestor Comercial ou Administrador/RevOps
- Pós: Responsável atualizado, envolvidos notificados, histórico anterior preservado
- Fluxo: abre referral → seleciona "Alterar responsável" → apresenta responsável atual e Closers disponíveis → escolhe novo Closer e informa motivo quando solicitado → verifica conflitos de atividades e reuniões → confirma → atualiza, mantém histórico e notifica
- FA-01: Manter atividades com o responsável anterior (escolhe quais tasks/reuniões permanecem vinculadas ao anterior)
- FE-01: Novo Closer inativo ou sem acesso — bloqueia e solicita outra escolha
- Req: RNF-01 · RNF-02 · RNF-03

### UC14 · Visualizar o Pipeline da Equipe (RF-05)
- Ator: Gestor Comercial
- Pós: Situação consolidada da equipe visível; pode abrir referrals permitidos
- Fluxo: acessa pipeline → referrals por etapa → cada card mostra responsável, tempo na etapa, última atividade e próxima ação → filtra por Closer, origem, período ou situação → abre referral ou inicia ação de gestão
- FA-01: Visualização em lista — alterna do quadro para lista ordenável sem perder filtros
- FE-01: Falha de carregamento parcial — informa e permite tentar novamente sem alterar dados
- Req: RNF-05 · RNF-06 · RNF-07

### UC15 · Acompanhar Referrals sem Responsável ou Próxima Ação (RF-09, RF-20)
- Ator: Gestor Comercial
- Pós: Pendências críticas identificadas e encaminhadas para correção
- Fluxo: acessa visão de pendências → lista referrals sem responsável, sem próxima ação, sem contato ou parados além do limite configurado → seleciona pendência → exibe contexto e ações possíveis → atribui responsável / define ação / ajusta prazo / solicita atualização ao Closer → registra resolução
- FA-01: SLA ainda não definido — utiliza tempo decorrido e limites operacionais configuráveis, sem rotular cumprimento de SLA oficial
- FE-01: Pendência já resolvida em outra sessão — atualiza e informa que nenhuma nova ação é necessária
- Req: RNF-03 · RNF-05 · RNF-06

### UC16 · Encerrar Referral como Perdido (RF-17)
- Ator: Closer ou Gestor Comercial
- Pós: Referral encerrado como Perdido com etapa da perda, motivo obrigatório e histórico preservado
- Fluxo: seleciona "Encerrar como perdido" → apresenta lista fechada de motivos + campo de observações → escolhe motivo, informa possibilidade de retomada e confirma → valida campos obrigatórios → move para Perdido e registra autor, data, etapa e motivo
- FA-01: Reabrir negócio — Gestor Comercial seleciona Reabrir, define etapa de retorno e próximo passo; preserva encerramento anterior no histórico
- FE-01: Motivo não informado — não permite concluir e destaca campo obrigatório
- Req: RNF-01 · RNF-03 · RNF-05

## /04 — Closer

### UC17 · Visualizar Referrals Atribuídos (RF-05, RF-06)
- Ator: Closer
- Pós: Closer visualiza sua carteira ativa com prioridades e próximos passos
- Fluxo: acessa "Minha carteira" → sistema apresenta somente referrals permitidos ao perfil → organizados por etapa, pendência e próxima ação → aplica filtros ou ordenação → abre ficha e inicia atividade necessária
- FA-01: Referral compartilhado — exibe com indicação do responsável principal
- FE-01: Referral redistribuído — remove acesso operacional quando aplicável e informa alteração do responsável
- Req: RNF-02 · RNF-05 · RNF-06

### UC18 · Registrar Primeiro Contato (RF-08)
- Ator: Closer
- Pós: Data, canal, resposta e resultado do primeiro contato registrados; tempo desde handoff calculável
- Fluxo: abre referral → seleciona "Registrar contato" → sistema apresenta data/hora, canal, resposta e resultado → Closer confirma/ajusta data e preenche resultado → valida → registra, atualiza última atividade, move para "Contato iniciado" quando aplicável → solicita próxima ação
- FA-01: Contato registrado automaticamente pelo WhatsApp — quando integração ativa, sugere dados da conversa
- FE-01: Data anterior ao recebimento do referral — informa inconsistência e solicita correção antes de salvar
- Req: RNF-01 · RNF-03 · RNF-05

### UC19 · Definir Próxima Ação (RF-09)
- Ator: Closer ou Gestor Comercial
- Pós: Referral com próxima ação, responsável e data prevista visíveis no pipeline
- Fluxo: abre referral → seleciona "Próxima ação" → sistema apresenta tipo, descrição, responsável e prazo → usuário informa os dados → valida responsável e data → salva e atualiza card do pipeline
- FA-01: Sem data definida — permite salvar somente quando a regra da etapa autoriza e marca como pendente de prazo
- FE-01: Responsável sem acesso ao referral — bloqueia atribuição e solicita responsável válido
- Req: RNF-01 · RNF-03 · RNF-05

### UC20 · Atualizar Etapa do Pipeline (RF-05, RF-07, RF-23)
- Ator: Closer, Gestor Comercial ou Administrador/RevOps autorizado
- Pós: Etapa atualizada, campos obrigatórios da etapa de destino preenchidos, mudança registrada
- Fluxo: solicita mover para outra etapa → apresenta campos obrigatórios da etapa de destino → usuário preenche dados pendentes → valida transição e informa quando houver salto de etapas → confirma → atualiza etapa e registra origem, destino, autor e data
- FA-01: Retornar para etapa anterior / Pular etapas — mantém histórico / exige confirmação e valida campos obrigatórios da etapa de destino
- FE-01: Campo obrigatório ausente — não conclui e destaca campos necessários
- Req: RNF-01 · RNF-03 · RNF-05

### UC21 · Agendar Reunião pelo Google Calendar (RF-10, RF-11)
- Ator: Closer
- Pós: Reunião criada no Google Calendar vinculada ao referral, com data/hora, participantes e link do Meet
- Fluxo: seleciona "Agendar reunião" → solicita tipo (R1/R2/R3), data/hora, duração e participantes → consulta calendário conectado e valida fuso horário → Closer confirma horário → cria evento e Google Meet → salva vínculo no referral e atualiza etapa correspondente
- FA-01: Agendamento manual de contingência — Closer registra data, horário e link criados externamente quando integração indisponível
- FE-01: Conflito de agenda ou falha de autorização — informa e não cria evento duplicado
- Req: RNF-04 · RNF-05 · RNF-08 · RNF-09

### UC22 · Reagendar ou Cancelar Reunião (RF-10, RF-11)
- Ator: Closer
- Pós: Evento e referral refletem novo horário ou cancelamento, preservando histórico anterior
- Fluxo: abre reunião vinculada → seleciona Reagendar ou Cancelar → reagendamento consulta disponibilidade e fuso → confirma alteração e informa motivo quando aplicável → atualiza ou cancela evento no Google Calendar → registra no histórico e atualiza próxima ação
- FA-01: Evento criado fora da integração — permite atualizar manualmente data, status e link
- FE-01: Falha ao atualizar calendário — informa e não confirma mudança como sincronizada
- Req: RNF-01 · RNF-04 · RNF-08

### UC23 · Registrar Realização e Comparecimento da Reunião (RF-11, RF-12)
- Ator: Closer
- Pós: Reunião marcada como realizada/não realizada/no-show com resultado e próximo passo
- Fluxo: acessa reunião após horário previsto → solicita status e comparecimento → Closer informa se ocorreu, se cliente compareceu e o resultado → quando ausência: registra motivo conhecido → salva e solicita próximo passo ou reagendamento → atualiza etapa quando aplicável
- FA-01: Reunião realizada sem agendamento prévio — Closer registra manualmente tipo, data, participantes e resultado
- FE-01: Status incompatível com a etapa — alerta e solicita confirmação ou correção da etapa antes de concluir
- Req: RNF-01 · RNF-03 · RNF-05

### UC24 · Registrar Informações da R1 (RF-11, RF-15)
- Ator: Closer
- Pós: Diagnóstico, comparecimento, score disponível, alertas e próximo passo associados à R1
- Fluxo: abre registro da R1 → sistema apresenta campos de diagnóstico definidos no playbook → Closer revisa dados importados da Elephan, quando disponíveis → completa ou corrige campos permitidos → registra resultado e data prevista da R2 → sistema salva e atualiza o referral
- FA-01: Preenchimento totalmente manual — quando Elephan não retorna dados, mantém todos os campos disponíveis para preenchimento pelo Closer
- FE-01: Dados importados conflitantes — destaca a divergência e exige revisão antes de consolidar campos críticos
- Req: RNF-01 · RNF-03 · RNF-04 · RNF-09

### UC25 · Registrar Análise do Finvity (RF-16)
- Ator: Closer
- Pós: Referral contém link/anexo do relatório Finvity, dores, necessidades e produtos sugeridos
- Fluxo: acessa etapa "Análise Finvity" → sistema solicita link ou anexo do relatório → Closer registra dores, necessidades e produtos sugeridos → valida vínculo do arquivo ou URL → Closer confirma → sistema salva e disponibiliza contexto para a R2
- FA-01: Importação por API — quando integração ativa, sistema recebe relatório e campos disponíveis; Closer revisa e confirma
- FE-01: Link inválido ou arquivo não permitido — informa e não conclui o registro até correção
- Req: RNF-01 · RNF-02 · RNF-09

### UC26 · Registrar Informações da R2 (RF-11, evolução RF-15)
- Ator: Closer
- Pós: Produto apresentado, objeções, interesse, próximo passo e data da R3 registrados
- Fluxo: abre registro da R2 → sistema apresenta contexto da R1 e da análise Finvity → Closer registra produto apresentado, objeções e nível de interesse → informa resultado e próximo passo → quando aplicável, informa data prevista da R3 → sistema salva e atualiza a etapa
- FA-01: Dados da Elephan disponíveis — apresenta resumo e score importados para revisão antes da confirmação
- FE-01: R2 sem análise Finvity registrada — alerta sobre ausência e permite prosseguir somente com confirmação autorizada
- Req: RNF-01 · RNF-03 · RNF-05 · RNF-09

### UC27 · Registrar Informações e Resultado da R3 (RF-11, RF-17, RF-18)
- Ator: Closer
- Pós: Resultado da R3, estrutura confirmada e decisão de avançar/perder/continuar negociação registrados
- Fluxo: abre registro da R3 → sistema apresenta histórico e proposta preliminar → Closer registra comparecimento, resultado e estrutura confirmada → informa se cliente decidiu avançar → se avançar: move para "Em contratação"; se não: apresenta encerramento como perdido ou próxima ação → salva resultado e histórico
- FA-01: Negociação contínua — Closer mantém referral ativo, registra objeção e define próxima ação
- FE-01: Campos de fechamento incompletos — impede conclusão da etapa e solicita dados obrigatórios
- Req: RNF-01 · RNF-03 · RNF-05 · RNF-09

### UC28 · Acompanhar Processo de Contratação (RF-18)
- Ator: Closer
- Pós: Documentos, exames, entrevista financeira, underwriting e pendências atualizados manualmente
- Fluxo: acessa acompanhamento da contratação → sistema apresenta parceiro, documentos, exames, entrevista e underwriting → Closer atualiza itens disponíveis e suas datas → registra pendências e próxima ação → sistema salva e atualiza última atividade → quando emissão confirmada: disponibiliza "Registrar ganho"
- FA-01: Produto sem alguma etapa padrão — Closer marca item como não aplicável e registra observação
- FE-01: Documento restrito sem permissão — bloqueia acesso e orienta a solicitar autorização
- Req: RNF-01 · RNF-02 · RNF-03 · RNF-09

### UC29 · Registrar Negócio Ganho (RF-18)
- Ator: Closer ou Gestor Comercial
- Pós: Referral marcado como Ganho com data, valor, parceiro e prêmio confirmado
- Fluxo: seleciona "Registrar ganho" → sistema apresenta campos finais → usuário informa data de emissão, valor final, parceiro emissor e prêmio confirmado → valida campos obrigatórios → confirma → move para Ganho e registra fechamento
- FA-01: Correção posterior ao fechamento — Gestor/Admin corrige dado com histórico de antes/depois
- FE-01: Emissão ainda não confirmada — não permite marcar como Ganho e mantém em contratação
- Req: RNF-01 · RNF-03 · RNF-09

### UC30 · Anexar Documentos e Links (RF-22)
- Ator: Closer, Gestor Comercial ou Administrador/RevOps autorizado
- Pós: Arquivo ou link associado ao referral com categoria, autor e data
- Fluxo: seleciona "Adicionar documento ou link" → sistema solicita arquivo/URL, categoria e descrição → usuário informa os dados → valida formato, tamanho, URL e permissão → armazena referência e registra a ação → conteúdo disponível para perfis autorizados
- FA-01: Substituir versão de documento — mantém versão anterior no histórico quando exigido
- FE-01: Arquivo rejeitado ou potencialmente inseguro — informa formato ou restrição aplicável
- Req: RNF-01 · RNF-02 · RNF-03 · RNF-09

## Integrações V1

| Integração | Papel | Status V1 |
|---|---|---|
| E-mail (handoff Avenue) | Entrada automática de referrals | Obrigatória |
| Google Calendar | Agendamento R1/R2/R3 com Meet | Importante |
| Elephan | Importar dados pós-R1 | Importante (FA: manual) |
| Finvity | Análise financeira (link/anexo) | V1 mínima: link/anexo; ideal: API |
| WhatsApp (próprio do Closer) | Contato via canal já utilizado | Importante (FA: manual) |
