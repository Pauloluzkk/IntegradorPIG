# 🥊 IntegradorPIG — Integrador de APIs NanadeFight
> Painel integrador para o sistema distribuído de apostas — UENP Sistemas Distribuídos 2025
---
## 🌐 Como abrir
Abra o arquivo `index.html` diretamente no navegador (Chrome ou Edge recomendados).
> ⚠️ **Importante:** Como usamos ES Modules (`type="module"`) e chamadas para APIs externas (HTTPS), o arquivo funciona melhor servido por um servidor local. Para isso:
```bash
# Opção 1: Live Server (VS Code)
# Instale a extensão "Live Server" e clique em "Go Live"
# Opção 2: Python
python -m http.server 3000
# Opção 3: Node.js
npx serve .
```
---
## 🗂️ Estrutura
```
IntegradorPIG/
├── index.html        ← Dashboard principal (ponto de entrada único)
├── style.css         ← Design system dark + glassmorphism
├── integrador.js     ← Orquestrador central (navegação, health checks, UI)
└── apis/
    ├── lutadores.js  ← API RSA-OAEP (seu grupo)
    ├── lutas.js      ← API X-API-KEY (bet3m)
    ├── apostas.js    ← API JWT Bearer (aposta-lutas)
    └── apostadores.js← API REST puro (api-sd)
```
---
## 📡 APIs Integradas
| Seção | URL de Produção | Autenticação | Criptografia |
|---|---|---|---|
| 🥋 **Lutadores** | `https://lutadores-api-22f61a69f511.herokuapp.com` | Nenhuma | RSA-OAEP 2048 bidirecional |
| ⚔️ **Lutas** | `https://bet3m-production.up.railway.app` | `X-API-KEY: bet3M-UENP` | JWT + RSA-PSS |
| 💰 **Apostas** | `https://api-aposta-lutas.vercel.app` | JWT Bearer (login) | RSA-2048 assimétrica |
| 👤 **Apostadores** | `https://api-sd-df8o.onrender.com` | Nenhuma | RSA em repouso |
---
## 🔐 Fluxo de Autenticação
### Lutadores (RSA-OAEP automático)
Ao abrir o painel, o integrador realiza automaticamente o handshake:
1. `GET /chave-publica` → obtém chave RSA do servidor
2. Gera par de chaves RSA no browser (Web Crypto API)
3. `POST /handshake` → registra a chave pública do browser
4. Todas as respostas chegam criptografadas e são descriptografadas automaticamente
### Apostas (JWT manual)
1. Clique na aba **Apostas**
2. Crie uma conta ou faça login com usuário/senha
3. O token JWT é armazenado em memória e enviado automaticamente em todas as requisições
---
## 🛠️ Adicionando outras APIs
Para adicionar as demais APIs do sistema (nanadebet, betting_api, apostadores-fight):
1. Crie um novo arquivo em `apis/novaapi.js` seguindo o padrão dos módulos existentes
2. Importe o módulo em `integrador.js`
3. Adicione um botão de navegação em `index.html`
4. Adicione a seção correspondente no HTML
5. Implemente o render + CRUD no `integrador.js`
---
## ⚠️ Limitações conhecidas
- **CORS**: Algumas APIs podem bloquear requisições cross-origin do browser. Se ocorrer, consulte o grupo responsável para liberar CORS para `*` ou para a URL do integrador.
- **Cold Start**: APIs no Render/Railway podem demorar 10–30s para responder na primeira requisição (plano gratuito hiberna o servidor).
- **nanadebet / betting_api / apostadores-fight**: Não foi possível acessar os READMEs completos desses repositórios. Os módulos para essas APIs devem ser adicionados quando as URLs de produção forem confirmadas.
---
## 🧪 Tecnologias
- HTML5 + CSS3 Vanilla + JavaScript ES Modules
- Web Crypto API (RSA-OAEP no browser)
- Zero dependências externas
- Design: Dark mode + Glassmorphism + Inter (Google Fonts)