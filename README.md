# 🥊 IntegradorPIG — Integrador de APIs NanadeFight
> Painel integrador e API Gateway para o sistema distribuído de apostas — UENP Sistemas Distribuídos 2025.

Este projeto atua como um **API Gateway / Proxy reverso** e painel unificado. Ele resolve os problemas de **CORS** do navegador e implementa mecanismos de **failover** (backup) automático e tradução de dados entre as APIs alternativas da classe.

---

## 📡 Arquitetura de Integração e APIs

O integrador está conectado às seguintes APIs, com suporte a failover no backend:

| Módulo | Tipo | Provedor Principal | Provedor de Backup (Failover) |
|---|---|---|---|
| 🥋 **Lutadores** | Encrypted / Plain | `https://lutadores-api-22f61a69f511.herokuapp.com` (Grupo UENP) | `https://api-lutadoressd.onrender.com/api` (PedroHPedroso/API_LutadoresSD) |
| ⚔️ **Lutas** | REST | `https://bet3m-production.up.railway.app` (joaofoguin/betting_api) | `https://betting-api-lutas.vercel.app` (vitorhhiguchi/api-nanadebet) |
| 💰 **Apostas** | REST / JWT | `https://api-aposta-lutas.vercel.app` (educalza/api-aposta-lutas) | `http://187.77.235.119:5555` (Vitor/nanadebet) |
| 👤 **Apostadores** | REST | `https://api-sd-df8o.onrender.com` (m-valentim/api-sd) | `https://api-apostadores-fight-azure.vercel.app` (RuanTirabassi/api-apostadores-fight) |

---

## 🛠️ Instalação

Antes de rodar o projeto, certifique-se de que você possui o **Node.js** instalado em sua máquina.

1. Abra a pasta do integrador no terminal:
   ```bash
   cd "SistemaApostas/IntegradorPIG"
   ```

2. Instale as dependências necessárias:
   ```bash
   npm install
   ```

---

## 🚀 Como Executar

### 1. Iniciar o API Gateway & Servidor Estático
Para rodar o servidor Express local na porta `5500`:

```bash
# Modo padrão (produção)
npm start

# Modo desenvolvimento (reinicia automaticamente ao alterar arquivos)
npm run dev
```

O servidor estará rodando em: **[http://localhost:5500](http://localhost:5500)**.

### 2. Acessar o Painel
Basta abrir o link **[http://localhost:5500](http://localhost:5500)** no seu navegador. O frontend será carregado estaticamente pelo Express e todas as requisições de API passarão pelo backend local, resolvendo o CORS e garantindo que o dashboard funcione mesmo se alguns servidores dos outros grupos estiverem offline.

---

## 🧠 Como funciona o Failover e Tradução (API Gateway)

Quando você realiza uma chamada no frontend (ex: `fetch('/api/lutas')`):
1. O backend proxy intercepta a requisição.
2. Tenta fazer a chamada para a **API Principal**.
3. Se a API Principal estiver offline (cair no `catch`), o backend automaticamente tenta chamar a **API de Backup**.
4. Caso a API de Backup utilize campos com nomes diferentes (ex: `id_lutador1` em vez de `lutador1` no JSON), o backend **traduz automaticamente** os dados antes de retornar ao navegador, garantindo que o painel do frontend continue funcionando perfeitamente sem quebrar a interface.
5. Para a API de **Apostadores (RuanTirabassi)**, o backend também realiza automaticamente a autenticação de administrador no fallback.