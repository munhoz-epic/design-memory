# design-memory Fork — Start Here (Retomada de Contexto)

> Criado: 13 Abril 2026 | Para retomar trabalho após reinício

---

## Estado Atual: Ativo — Anthropic API integrado, instalado globalmente

### O que já foi feito

- Fork clonado: `~/epic/design-memory` (munhoz-epic/design-memory)
- `@anthropic-ai/sdk` adicionado como dependência
- `src/interpret/llm.client.ts` — branch Anthropic com `stripMarkdownCodeBlock()`, auto-detecção provider
- `src/analyze/layout.spec.ts` — branch Anthropic vision, `resizeForAnthropic()` via sharp (max 7900px)
- `src/analyze/layout.spec.fix.ts` — coerção `content.items` objetos → strings
- `src/cli/main.ts` — flag `--provider`, default de modelo removido do Commander
- `src/cli/cmd.learn.ts` + `cmd.diff.ts` — auto-detecção por env var
- Instalado globalmente: `npm run build && npm install -g .`
- Testado com sucesso: primer.style + afferolab.com.br

### O que falta

- Contribuir fixes de volta para o upstream (opcional)
- Testar com `--provider openai` para confirmar compatibilidade mantida
- Testar sites com outros perfis de screenshot

---

## Arquivos-Chave

| Arquivo | O que é |
|---------|---------|
| `src/interpret/llm.client.ts` | Integração LLM — branches OpenAI e Anthropic |
| `src/analyze/layout.spec.ts` | Análise visual via screenshot — resize + branch Anthropic |
| `src/analyze/layout.spec.fix.ts` | Coerção de schema Zod para outputs LLM |
| `src/cli/cmd.learn.ts` | Comando principal: auto-detecção de provider |
| `package.json` | Dependências: sharp, @anthropic-ai/sdk, openai |

## Memory Files

| Arquivo | Conteúdo |
|---------|---------|
| `DESIGN-MEMORY.md` | Status, arquivos modificados, decisões, histórico |
| `DESIGN-MEMORY-LEARNINGS.md` | Anthropic API quirks, CLI defaults, imagens, secrets |

---

## Como Usar

```bash
# Setup
export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY ~/.secrets/epic.env | cut -d= -f2 | tr -d '"')

# Extrair (usa Claude automaticamente)
mkdir -p /epic/ui-library/references/<domain>
cd /epic/ui-library/references/<domain>
design-memory learn <url>

# Output em .design-memory/: style.md, components.md, layout.md, principles.md, skills/
```

---

## Próximo Passo

Dizer: **"retomar design-memory"**
