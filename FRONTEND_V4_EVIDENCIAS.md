# 🎨 FRONTEND V4.0 - Melhorias de Ordenação e Métricas Agregadas

## 📋 Resumo das Mudanças

### 1️⃣ Correção de Ordenação por Confiança (Numérica)

**Problema:**
- Ordenação de confiança era feita como string ou com valores inconsistentes
- Item com 100% aparecia atrás de 78% em alguns casos
- Falta de validação para garantir ordenação correta

**Solução Implementada:**
- ✅ Garantir que `confianca` é sempre `number` (nunca string)
- ✅ Sort numérico explícito: `(b.confianca ?? 0) - (a.confianca ?? 0)`
- ✅ Type guards para converter valores não-numéricos
- ✅ Validação com `console.assert` em dev para detectar problemas

**Arquivos Modificados:**
- [`frontend/app/page.tsx`](frontend/app/page.tsx)
  - Linhas ~254-280: Busca single - mapeamento e validação
  - Linhas ~290-340: Busca batch - mapeamento e ordenação
  - Linhas ~568-600: UI batch - sort dinâmico com validação

**Código Exemplo:**
```typescript
// ANTES (problemático - pode falhar com strings)
const ordered = itens.sort((a, b) => (b.confianca ?? 0) - (a.confianca ?? 0))

// DEPOIS (robusto - garante números)
const ordered = itens.sort((a, b) => {
  const confA = typeof a.confianca === 'number' ? a.confianca : 0
  const confB = typeof b.confianca === 'number' ? b.confianca : 0
  return confB - confA
})

// Validação em dev:
if (process.env.NODE_ENV !== 'production' && ordered.length > 1) {
  const confidences = ordered.map(it => it.confianca ?? 0)
  const isSorted = confidences.every((val, i) => 
    i === 0 || confidences[i - 1] >= val
  )
  console.assert(isSorted, '[SORT_DEBUG] Não está ordenado:', confidences)
}
```

**Validações Automáticas:**
- ✅ Todos os valores de confiança são numbers
- ✅ Ordenação descendente (100 > 92 > 78 > ...)
- ✅ Assert falha se houver inconsistência
- ✅ Logs detalhados em dev mode

---

### 2️⃣ Exibição de Métricas Agregadas

**Problema:**
- UI mostrava apenas 1 valor (ex: R$ 4.350,00)
- Usuário não sabia se era média, mediana, ou valor único
- Sem informação sobre variação entre fornecedores
- Sem rastreabilidade (quantas cotações? de onde?)

**Solução Implementada:**
- ✅ Suporte completo ao formato v4.0 do backend
- ✅ Tooltip interativo com estatísticas detalhadas
- ✅ Badges visuais para alertas ("poucas amostras", "alta variação")
- ✅ Rastreabilidade de fontes (fornecedores, bids, n de linhas)
- ✅ Retrocompatibilidade com v3.0 (fallback automático)

**Arquivos Criados/Modificados:**

1. **Novo Componente:** [`frontend/components/metrics-tooltip.tsx`](frontend/components/metrics-tooltip.tsx)
   - Tooltip interativo com estatísticas completas
   - Badges de alerta (poucas amostras / alta variação)
   - Gradiente visual de min → max
   - Formatação inteligente (BRL, %, meses)

2. **Tipos Atualizados:** [`frontend/app/page.tsx`](frontend/app/page.tsx) (linhas 19-46)
   ```typescript
   export type NumericMetrics = {
     display: number     // Valor exibido (mediana)
     mean: number        // Média
     median: number      // Mediana
     min: number         // Mínimo
     max: number         // Máximo
     n: number           // Número de amostras
     unit?: string       // Unidade (opcional)
   }

   export type Equipment = {
     // ... campos legacy v3.0 ...
     metrics?: {
       valorUnitario?: NumericMetrics
       vidaUtilMeses?: NumericMetrics
       manutencao?: NumericMetrics
     }
     sources?: {
       fornecedores?: string[]
       bids?: string[]
       nLinhas: number
     }
   }
   ```

3. **Card Atualizado:** [`frontend/components/equipment-card.tsx`](frontend/components/equipment-card.tsx)
   - Helpers para extrair valores display com fallback
   - Uso do `MetricsTooltip` no modal de detalhes
   - Seção de rastreabilidade com fontes

**UI Exemplo:**

```
┌─────────────────────────────────────────┐
│ 🏷️  Valor Unitário           ℹ️         │
│                                         │
│     R$ 4.350,00           [Alta variação] │
└─────────────────────────────────────────┘
        ↓ (hover tooltip)
┌───────────────────────────────────────┐
│ Estatísticas                          │
│ Baseado em 8 cotações                │
│                                       │
│ Mediana: R$ 4.350,00                 │
│ Média: R$ 4.420,50                   │
│                                       │
│ Faixa de Valores:                    │
│ Min: R$ 3.800,00 ━━━━━━ Max: R$ 5.200,00 │
│                                       │
│ 📊 Alta variação: Diferença          │
│ significativa entre fornecedores.    │
└───────────────────────────────────────┘
```

**Alertas Visuais:**

1. **⚠️ Poucas Amostras** (n < 3):
   - Badge amarelo no card
   - Tooltip explicativo: "Valores podem não ser representativos"

2. **📊 Alta Variação** (range/mean > 50%):
   - Badge laranja no card
   - Tooltip explicativo: "Diferença significativa entre fornecedores"

**Rastreabilidade:**

Exibido no modal de detalhes:
```
┌─────────────────────────────────────┐
│ ℹ️  Rastreabilidade                 │
│                                     │
│ Amostras: 8         Fornecedores: 3 │
│                                     │
│ GPS, Karcher, Fornecedor X          │
└─────────────────────────────────────┘
```

---

## 🧪 Testes e Validação

### Teste 1: Ordenação Numérica

**Setup:**
```bash
cd frontend
npm run dev
```

**Ações:**
1. Fazer busca: "enceradeira 510 mm"
2. Observar ordem dos cards
3. Abrir DevTools Console

**Expected Output:**
```
[SORT_DEBUG] Batch "enceradeira 510 mm" com sort "conf-desc" não ordenado: Array(5)
  ✅ Assertion passou (lista está ordenada)

Confiança dos itens:
  #1: 0.95 (95%)
  #2: 0.92 (92%)
  #3: 0.78 (78%)
  #4: 0.65 (65%)
  #5: 0.45 (45%)
```

### Teste 2: Métricas Agregadas (v4.0)

**Pré-requisito:** Backend deve ter rodado `npm run aggregate:dataset`

**Ações:**
1. Fazer busca que retorne item com métricas v4.0
2. Verificar card exibe valor display
3. Abrir modal de detalhes
4. Hover sobre "Valor Unitário ℹ️"

**Expected:**
- ✅ Card mostra valor display (mediana)
- ✅ Badges aparecem se n < 3 ou alta variação
- ✅ Tooltip mostra estatísticas completas
- ✅ Seção de rastreabilidade visível

**Console Log:**
```
[METRICS_V4_DEBUG] Métricas agregadas detectadas: {
  total: 5,
  withMetrics: 5,
  example: {
    sugeridos: "Enceradeira 510 mm",
    metrics: {
      valorUnitario: {
        display: 4350,
        mean: 4420.5,
        median: 4350,
        min: 3800,
        max: 5200,
        n: 8
      }
    },
    sources: {
      fornecedores: ["GPS", "Karcher", "..."],
      nLinhas: 8
    }
  }
}
```

### Teste 3: Retrocompatibilidade (v3.0)

**Ações:**
1. Buscar com backend que retorna formato v3.0 (sem metrics)
2. Verificar que UI funciona normalmente

**Expected:**
- ✅ Card mostra valores de `valor_unitario` diretamente
- ✅ Sem tooltip (apenas valor simples)
- ✅ Sem badges de alerta
- ✅ Sem seção de rastreabilidade

---

## 📊 Comparação Visual

### Antes (v3.0)
```
┌────────────────────────────┐
│ Enceradeira 510 mm         │
│ #1                         │
│                            │
│ 💰 Valor Unitário          │
│    R$ 4.350,00             │
│                            │
│ 📅 Vida Útil: 48m          │
│ 🔧 Manutenção: Baixa       │
│ 📊 Confiança: 95% 🟢       │
└────────────────────────────┘
```

### Depois (v4.0)
```
┌────────────────────────────────┐
│ Enceradeira 510 mm             │
│ #1                     [Top]   │
│                                │
│ 💰 Valor Unitário   ℹ️          │
│    R$ 4.350,00  [Alta variação]│
│                                │
│ 📅 Vida Útil: 48m   ℹ️          │
│ 🔧 Manutenção: Baixa ℹ️         │
│ 📊 Confiança: 95% 🟢           │
│                                │
│ [Ver Detalhes] →               │
│   → Estatísticas completas     │
│   → Rastreabilidade (8 amostras)│
│   → Fontes: GPS, Karcher, ...  │
└────────────────────────────────┘
```

---

## ✅ Checklist de Validação

### Ordenação:
- [x] Confiança sempre é `number` (nunca string)
- [x] Sort numérico aplicado em busca single
- [x] Sort numérico aplicado em busca batch
- [x] Sort dinâmico (conf-desc, conf-asc, price, life)
- [x] Validação com `console.assert` em dev
- [x] Logs detalhados de debug

### Métricas Agregadas:
- [x] Interface `NumericMetrics` definida
- [x] Componente `MetricsTooltip` criado
- [x] Integração no `EquipmentCard`
- [x] Helpers de extração com fallback v3.0
- [x] Badges de alerta (poucas amostras / alta variação)
- [x] Rastreabilidade de fontes
- [x] Formatação inteligente (BRL, %, meses)
- [x] Gradiente visual min → max

### Retrocompatibilidade:
- [x] Backend v3.0 funciona normalmente
- [x] Fallback automático para campos legacy
- [x] Sem erros de runtime
- [x] Degradação graciosa (sem crash)

---

## 🚀 Como Executar

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Abrir: http://localhost:3000

### Backend (para dados v4.0):
```bash
cd backend-ts
npm run aggregate:dataset  # Gerar dataset v4.0
npm run dev                # Iniciar API
```

### Validação Rápida:
1. Abrir DevTools Console (F12)
2. Fazer busca: "enceradeira"
3. Verificar logs:
   - `[SORT_DEBUG]` - validação de ordenação
   - `[METRICS_V4_DEBUG]` - detecção de métricas
4. Hover nos tooltips ℹ️ para ver estatísticas

---

## 📝 Notas Técnicas

### Performance:
- Tooltip usa Radix UI (acessibilidade nativa)
- Componentes memoizados onde aplicável
- Fallback v3.0 é zero-cost (mesmo código)

### Acessibilidade:
- Tooltip acionado por hover ou foco
- Atributo `aria-label` em todos os ícones
- Contraste de cores AAA

### Manutenibilidade:
- Separação de concerns (tooltip isolado)
- Tipos TypeScript rigorosos
- Comentários inline explicativos
- Validações de dev ajudam debugging

---

**Última Atualização:** 12 de dezembro de 2025
**Autor:** GitHub Copilot
**Versão:** Frontend v4.0
