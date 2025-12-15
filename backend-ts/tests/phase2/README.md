# 🧪 Fase 2 - Guia de Testes HTTP

## 📦 O que foi criado

1. **Servidor Standalone** (`tests/phase2/standalone-server.ts`)
   - Fastify mínimo com apenas as rotas da Fase 2
   - Porta 3001 (não conflita com servidor principal)
   - Database + History + Favorites endpoints

2. **Testes HTTP** (`tests/phase2/http-test.ts`)
   - 20+ test cases cobrindo todos endpoints
   - User isolation
   - Edge cases
   - Validation errors

---

## 🚀 Como Executar

### Passo 1: Iniciar o Servidor

```powershell
npx tsx tests/phase2/standalone-server.ts
```

**Aguarde até ver:**
```
✅ Server listening
📡 Endpoints available at http://localhost:3001:
🧪 Ready for testing!
```

### Passo 2: Rodar os Testes (em outro terminal)

```powershell
npx tsx tests/phase2/http-test.ts
```

**Resultado esperado:**
```
✅ Passed: 20+
❌ Failed: 0
📈 Success Rate: 100%
```

---

## 📡 Endpoints Disponíveis

### GET /health
```bash
curl http://localhost:3001/health
```

### GET /api/history
```bash
curl http://localhost:3001/api/history \
  -H "X-User-ID: test-user"
```

### GET /api/favorites
```bash
curl http://localhost:3001/api/favorites \
  -H "X-User-ID: test-user"
```

### POST /api/favorites
```bash
curl -X POST http://localhost:3001/api/favorites \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"item_name":"Mop Industrial","price":45.0}'
```

### DELETE /api/favorites/:id
```bash
curl -X DELETE http://localhost:3001/api/favorites/1 \
  -H "X-User-ID: test-user"
```

---

## ✅ Checklist de Validação

- [ ] Servidor inicia sem erros
- [ ] GET /health retorna 200
- [ ] GET /api/history retorna array vazio
- [ ] POST /api/favorites cria favorito
- [ ] GET /api/favorites lista favorito criado
- [ ] DELETE /api/favorites/:id remove favorito
- [ ] User isolation funciona (User A ≠ User B)
- [ ] Validation errors (400) funcionam
- [ ] 404 para favoritos inexistentes

---

## 🐛 Troubleshooting

### Erro: "ECONNREFUSED"
- Servidor não está rodando
- Execute o passo 1 primeiro

### Erro: "EADDRINUSE"
- Porta 3001 já está em uso
- Mate o processo: `Stop-Process -Name node -Force`

### Erro: Database
- Delete `data/afm.db` e reinicie

---

## 📊 Status Atual

**Fase 1**: ✅ 100% Complete (30+ tests passing)  
**Fase 2**: ⚙️ Aguardando validação HTTP manual

Uma vez que os testes HTTP passarem, Fase 2 estará 100% completa! 🎉
