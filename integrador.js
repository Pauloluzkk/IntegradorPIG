/**
 * integrador.js — Orquestrador Central
 * IntegradorPIG — NanadeFight · UENP Sistemas Distribuídos 2025
 *
 * Responsabilidades:
 *  - Inicializar todos os módulos de API em paralelo
 *  - Controlar navegação entre seções
 *  - Gerenciar estado global da UI
 *  - Exibir status de saúde das APIs
 *  - Tratar erros de forma amigável
 */

import { initLutadoresAPI, LutadoresAPI, isLutadoresReady, CATEGORIAS, ARTES }
    from './apis/lutadores.js';
import { LutasAPI }
    from './apis/lutas.js';
import {
    ApostasAPI, apostasLogin, apostasRegistrar, apostasLogout,
    isApostasAuthenticated, checkApostasHealth
} from './apis/apostas.js';
import { ApostadoresAPI, checkApostadoresHealth }
    from './apis/apostadores.js';

/* ============================================================
   UTILITÁRIOS DE UI
   ============================================================ */
function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${msg}`;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3100);
}

function setDot(id, state) {
    const dot = document.getElementById(`dot-${id}`);
    const pill = document.getElementById(`pill-${id}`);
    if (!dot || !pill) return;
    dot.className = `status-dot ${state}`;
    const dotPill = pill.querySelector('.dot');
    if (dotPill) {
        dotPill.className = `dot ${state}`;
        dotPill.textContent = state === 'online' ? '●' : state === 'offline' ? '●' : '●';
    }
}

function showModal(msg, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-msg').textContent = msg;
    overlay.style.display = 'flex';
    const btnConfirm = document.getElementById('modal-confirm');
    const btnCancel = document.getElementById('modal-cancel');
    const cleanup = () => { overlay.style.display = 'none'; };
    btnConfirm.onclick = () => { cleanup(); onConfirm(); };
    btnCancel.onclick = cleanup;
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const SECTIONS = ['lutadores', 'lutas', 'apostas', 'apostadores'];
const PAGE_URLS = {
    lutadores: 'https://lutadores-api-22f61a69f511.herokuapp.com',
    lutas: 'https://bet3m-production.up.railway.app',
    apostas: 'https://api-aposta-lutas.vercel.app',
    apostadores: 'https://api-sd-df8o.onrender.com'
};

function navigate(section) {
    SECTIONS.forEach(s => {
        document.getElementById(`section-${s}`)?.classList.remove('active');
        document.getElementById(`nav-${s}`)?.classList.remove('active');
    });
    document.getElementById(`section-${section}`)?.classList.add('active');
    document.getElementById(`nav-${section}`)?.classList.add('active');

    // Atualiza topbar
    document.getElementById('page-title').textContent =
        section.charAt(0).toUpperCase() + section.slice(1);
    document.getElementById('page-url').textContent = PAGE_URLS[section] || '';
}

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.section));
});

/* ============================================================
   HEALTH CHECKS
   ============================================================ */
async function runHealthChecks() {
    // Lutadores — verificado via init
    // Lutas
    try {
        const r = await fetch('/api/lutas/lutas', {
            headers: { 'X-API-KEY': 'bet3M-UENP' },
            signal: AbortSignal.timeout(6000)
        });
        setDot('lutas', r.ok ? 'online' : 'offline');
    } catch { setDot('lutas', 'offline'); }

    // Apostas
    const apostasOk = await checkApostasHealth();
    setDot('apostas', apostasOk ? 'online' : 'offline');

    // Apostadores
    const apostadoresOk = await checkApostadoresHealth();
    setDot('apostadores', apostadoresOk ? 'online' : 'offline');
}

/* ============================================================
   ==================  LUTADORES  ==========================
   ============================================================ */
function categoriaLabel(v) { return CATEGORIAS[v] || v; }
function arteLabel(v) { return ARTES[v] || v; }

function renderLutadores(data) {
    const tbody = document.getElementById('tbody-lutadores');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum lutador cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(l => `
    <tr>
      <td>${l.id ?? '—'}</td>
      <td><strong>${l.nome}</strong></td>
      <td>${l.apelido}</td>
      <td><span class="badge badge-blue">${categoriaLabel(l.categoria)}</span></td>
      <td><span class="badge badge-orange">${arteLabel(l.arte)}</span></td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" onclick="editLutador(${JSON.stringify(l).replace(/"/g, '&quot;')})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteLutador(${l.id},'${l.nome}')">🗑️</button>
      </td>
    </tr>`).join('');
}

async function loadLutadores() {
    try {
        const data = await LutadoresAPI.listarTodos();
        renderLutadores(Array.isArray(data) ? data : [data]);
    } catch (e) {
        document.getElementById('tbody-lutadores').innerHTML =
            `<tr><td colspan="6" class="empty">❌ ${e.message}</td></tr>`;
    }
}

window.editLutador = function (l) {
    document.getElementById('lut-nome').value = l.nome;
    document.getElementById('lut-apelido').value = l.apelido;
    document.getElementById('lut-categoria').value = l.categoria;
    document.getElementById('lut-arte').value = l.arte;
    document.getElementById('lut-edit-id').value = l.id;
    document.getElementById('form-lutador-title').textContent = `Editar Lutador #${l.id}`;
    document.getElementById('form-lutador').style.display = 'block';
};

window.deleteLutador = function (id, nome) {
    showModal(`Excluir o lutador "${nome}" (ID ${id})?`, async () => {
        try {
            await LutadoresAPI.deletar(id);
            toast('Lutador excluído!', 'success');
            await loadLutadores();
        } catch (e) { toast(e.message, 'error'); }
    });
};

document.getElementById('btn-novo-lutador').addEventListener('click', () => {
    document.getElementById('lut-edit-id').value = '';
    document.getElementById('form-lutador-title').textContent = 'Novo Lutador';
    ['lut-nome', 'lut-apelido'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('lut-categoria').value = '1';
    document.getElementById('lut-arte').value = '1';
    document.getElementById('form-lutador').style.display = 'block';
});

document.getElementById('btn-cancel-lutador').addEventListener('click', () => {
    document.getElementById('form-lutador').style.display = 'none';
});

document.getElementById('btn-save-lutador').addEventListener('click', async () => {
    const nome = document.getElementById('lut-nome').value.trim();
    const apelido = document.getElementById('lut-apelido').value.trim();
    const categoria = document.getElementById('lut-categoria').value;
    const arte = document.getElementById('lut-arte').value;
    const editId = document.getElementById('lut-edit-id').value;

    if (!nome || !apelido) { toast('Preencha nome e apelido.', 'error'); return; }

    const btn = document.getElementById('btn-save-lutador');
    btn.disabled = true;
    try {
        if (editId) {
            await LutadoresAPI.atualizar(editId, { nome, apelido, categoria, arte });
            toast('Lutador atualizado!', 'success');
        } else {
            await LutadoresAPI.criar({ nome, apelido, categoria, arte });
            toast('Lutador criado!', 'success');
        }
        document.getElementById('form-lutador').style.display = 'none';
        await loadLutadores();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

/* ============================================================
   ==================  LUTAS  ==============================
   ============================================================ */
function renderLutas(data) {
    const tbody = document.getElementById('tbody-lutas');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma luta cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(l => `
    <tr>
      <td>${l.id ?? '—'}</td>
      <td>${l.data ?? '—'}</td>
      <td>${l.horario ?? '—'}</td>
      <td><span class="badge badge-blue">#${l.lutador1}</span></td>
      <td><span class="badge badge-red">#${l.lutador2}</span></td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" onclick="editLuta(${JSON.stringify(l).replace(/"/g, '&quot;')})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteLuta(${l.id})">🗑️</button>
      </td>
    </tr>`).join('');
}

async function loadLutas() {
    document.getElementById('tbody-lutas').innerHTML =
        '<tr><td colspan="6" class="empty">Carregando…</td></tr>';
    try {
        const data = await LutasAPI.listarTodas();
        renderLutas(Array.isArray(data) ? data : [data]);
    } catch (e) {
        document.getElementById('tbody-lutas').innerHTML =
            `<tr><td colspan="6" class="empty">❌ ${e.message}</td></tr>`;
        toast(e.message, 'error');
    }
}

window.editLuta = function (l) {
    document.getElementById('luta-data').value = l.data ?? '';
    document.getElementById('luta-horario').value = l.horario ?? '';
    document.getElementById('luta-lutador1').value = l.lutador1;
    document.getElementById('luta-lutador2').value = l.lutador2;
    document.getElementById('luta-edit-id').value = l.id;
    document.getElementById('form-luta-title').textContent = `Editar Luta #${l.id}`;
    document.getElementById('form-luta').style.display = 'block';
};

window.deleteLuta = function (id) {
    showModal(`Excluir a Luta #${id}?`, async () => {
        try {
            await LutasAPI.deletar(id);
            toast('Luta excluída!', 'success');
            await loadLutas();
        } catch (e) { toast(e.message, 'error'); }
    });
};

document.getElementById('btn-nova-luta').addEventListener('click', () => {
    document.getElementById('luta-edit-id').value = '';
    document.getElementById('form-luta-title').textContent = 'Nova Luta';
    ['luta-data', 'luta-horario', 'luta-lutador1', 'luta-lutador2']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('form-luta').style.display = 'block';
});

document.getElementById('btn-cancel-luta').addEventListener('click', () => {
    document.getElementById('form-luta').style.display = 'none';
});

document.getElementById('btn-save-luta').addEventListener('click', async () => {
    const data = document.getElementById('luta-data').value;
    const horario = document.getElementById('luta-horario').value;
    const lutador1 = document.getElementById('luta-lutador1').value;
    const lutador2 = document.getElementById('luta-lutador2').value;
    const editId = document.getElementById('luta-edit-id').value;

    if (!data || !horario || !lutador1 || !lutador2) {
        toast('Preencha todos os campos.', 'error'); return;
    }

    const btn = document.getElementById('btn-save-luta');
    btn.disabled = true;
    const campos = { data, horario: `${horario}:00`, lutador1, lutador2 };
    try {
        if (editId) {
            await LutasAPI.atualizar(editId, campos);
            toast('Luta atualizada!', 'success');
        } else {
            await LutasAPI.criar(campos);
            toast('Luta criada!', 'success');
        }
        document.getElementById('form-luta').style.display = 'none';
        await loadLutas();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

/* ============================================================
   ==================  APOSTAS  ============================
   ============================================================ */
document.getElementById('btn-apostas-login').addEventListener('click', async () => {
    const usuario = document.getElementById('apostas-usuario').value.trim();
    const senha = document.getElementById('apostas-senha').value;
    if (!usuario || !senha) { toast('Preencha usuário e senha.', 'error'); return; }

    const btn = document.getElementById('btn-apostas-login');
    btn.disabled = true;
    try {
        await apostasLogin(usuario, senha);
        document.getElementById('apostas-token-status').textContent = `✅ Autenticado como "${usuario}"`;
        toast('Login realizado com sucesso!', 'success');
        document.getElementById('table-apostas').style.display = 'block';
        document.getElementById('btn-nova-aposta').disabled = false;
        await loadApostas();
    } catch (e) {
        toast(e.message, 'error');
        document.getElementById('apostas-token-status').textContent = `❌ ${e.message}`;
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('btn-apostas-registrar').addEventListener('click', async () => {
    const usuario = document.getElementById('apostas-usuario').value.trim();
    const senha = document.getElementById('apostas-senha').value;
    if (!usuario || !senha) { toast('Preencha usuário e senha.', 'error'); return; }

    const btn = document.getElementById('btn-apostas-registrar');
    btn.disabled = true;
    try {
        await apostasRegistrar(usuario, senha);
        toast('Conta criada! Faça login agora.', 'success');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

function renderApostas(data) {
    const tbody = document.getElementById('tbody-apostas');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma aposta registrada.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(a => `
    <tr>
      <td>${a.id ?? '—'}</td>
      <td><strong>R$ ${parseFloat(a.valor).toFixed(2)}</strong></td>
      <td><span class="badge badge-red">Luta #${a.id_luta}</span></td>
      <td><span class="badge badge-blue">Lutador #${a.id_lutador}</span></td>
      <td><span class="badge badge-orange">Apostador #${a.id_apostador}</span></td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" onclick="editAposta(${JSON.stringify(a).replace(/"/g, '&quot;')})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteAposta(${a.id})">🗑️</button>
      </td>
    </tr>`).join('');
}

async function loadApostas() {
    document.getElementById('tbody-apostas').innerHTML =
        '<tr><td colspan="6" class="empty">Carregando…</td></tr>';
    try {
        const data = await ApostasAPI.listarTodas();
        renderApostas(Array.isArray(data) ? data : [data]);
    } catch (e) {
        document.getElementById('tbody-apostas').innerHTML =
            `<tr><td colspan="6" class="empty">❌ ${e.message}</td></tr>`;
    }
}

window.editAposta = function (a) {
    document.getElementById('aposta-valor').value = a.valor;
    document.getElementById('aposta-id-luta').value = a.id_luta;
    document.getElementById('aposta-id-lutador').value = a.id_lutador;
    document.getElementById('aposta-id-apostador').value = a.id_apostador;
    document.getElementById('aposta-edit-id').value = a.id;
    document.getElementById('form-aposta-title').textContent = `Editar Aposta #${a.id}`;
    document.getElementById('form-aposta').style.display = 'block';
};

window.deleteAposta = function (id) {
    showModal(`Excluir a Aposta #${id}?`, async () => {
        try {
            await ApostasAPI.deletar(id);
            toast('Aposta excluída!', 'success');
            await loadApostas();
        } catch (e) { toast(e.message, 'error'); }
    });
};

document.getElementById('btn-nova-aposta').addEventListener('click', () => {
    if (!isApostasAuthenticated()) { toast('Faça login primeiro!', 'error'); return; }
    document.getElementById('aposta-edit-id').value = '';
    document.getElementById('form-aposta-title').textContent = 'Nova Aposta';
    ['aposta-valor', 'aposta-id-luta', 'aposta-id-lutador', 'aposta-id-apostador']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('form-aposta').style.display = 'block';
});

document.getElementById('btn-cancel-aposta').addEventListener('click', () => {
    document.getElementById('form-aposta').style.display = 'none';
});

document.getElementById('btn-save-aposta').addEventListener('click', async () => {
    const valor = document.getElementById('aposta-valor').value;
    const id_luta = document.getElementById('aposta-id-luta').value;
    const id_lutador = document.getElementById('aposta-id-lutador').value;
    const id_apostador = document.getElementById('aposta-id-apostador').value;
    const editId = document.getElementById('aposta-edit-id').value;

    if (!valor || !id_luta || !id_lutador || !id_apostador) {
        toast('Preencha todos os campos.', 'error'); return;
    }

    const btn = document.getElementById('btn-save-aposta');
    btn.disabled = true;
    const campos = { valor, id_luta, id_lutador, id_apostador };
    try {
        if (editId) {
            await ApostasAPI.atualizar(editId, campos);
            toast('Aposta atualizada!', 'success');
        } else {
            await ApostasAPI.criar(campos);
            toast('Aposta registrada!', 'success');
        }
        document.getElementById('form-aposta').style.display = 'none';
        await loadApostas();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

/* ============================================================
   ================  APOSTADORES  ==========================
   ============================================================ */
function renderApostadores(data) {
    const tbody = document.getElementById('tbody-apostadores');
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum apostador cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(a => `
    <tr>
      <td>${a.id ?? '—'}</td>
      <td><strong>${a.nome}</strong></td>
      <td>${a.idade}</td>
      <td><code style="font-size:0.8rem;color:var(--text-muted)">${a.chave_pix}</code></td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" onclick="editApostador(${JSON.stringify(a).replace(/"/g, '&quot;')})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteApostador(${a.id},'${a.nome}')">🗑️</button>
      </td>
    </tr>`).join('');
}

async function loadApostadores() {
    document.getElementById('tbody-apostadores').innerHTML =
        '<tr><td colspan="5" class="empty">Carregando…</td></tr>';
    try {
        const data = await ApostadoresAPI.listarTodos();
        renderApostadores(Array.isArray(data) ? data : [data]);
    } catch (e) {
        document.getElementById('tbody-apostadores').innerHTML =
            `<tr><td colspan="5" class="empty">❌ ${e.message}</td></tr>`;
        toast(e.message, 'error');
    }
}

window.editApostador = function (a) {
    document.getElementById('apost-nome').value = a.nome;
    document.getElementById('apost-idade').value = a.idade;
    document.getElementById('apost-pix').value = a.chave_pix;
    document.getElementById('apost-edit-id').value = a.id;
    document.getElementById('form-apostador-title').textContent = `Editar Apostador #${a.id}`;
    document.getElementById('form-apostador').style.display = 'block';
};

window.deleteApostador = function (id, nome) {
    showModal(`Excluir o apostador "${nome}" (ID ${id})?`, async () => {
        try {
            await ApostadoresAPI.deletar(id);
            toast('Apostador excluído!', 'success');
            await loadApostadores();
        } catch (e) { toast(e.message, 'error'); }
    });
};

document.getElementById('btn-novo-apostador').addEventListener('click', () => {
    document.getElementById('apost-edit-id').value = '';
    document.getElementById('form-apostador-title').textContent = 'Novo Apostador';
    ['apost-nome', 'apost-idade', 'apost-pix'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('form-apostador').style.display = 'block';
});

document.getElementById('btn-cancel-apostador').addEventListener('click', () => {
    document.getElementById('form-apostador').style.display = 'none';
});

document.getElementById('btn-save-apostador').addEventListener('click', async () => {
    const nome = document.getElementById('apost-nome').value.trim();
    const idade = document.getElementById('apost-idade').value;
    const chave_pix = document.getElementById('apost-pix').value.trim();
    const editId = document.getElementById('apost-edit-id').value;

    if (!nome || !idade || !chave_pix) { toast('Preencha todos os campos.', 'error'); return; }

    const btn = document.getElementById('btn-save-apostador');
    btn.disabled = true;
    try {
        if (editId) {
            await ApostadoresAPI.atualizar(editId, { nome, idade, chave_pix });
            toast('Apostador atualizado!', 'success');
        } else {
            await ApostadoresAPI.criar({ nome, idade, chave_pix });
            toast('Apostador criado!', 'success');
        }
        document.getElementById('form-apostador').style.display = 'none';
        await loadApostadores();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

/* ============================================================
   LOAD ao trocar de aba (lazy loading)
   ============================================================ */
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const s = btn.dataset.section;
        if (s === 'lutas') loadLutas();
        if (s === 'apostadores') loadApostadores();
        if (s === 'apostas' && isApostasAuthenticated()) loadApostas();
    });
});

/* ============================================================
   INICIALIZAÇÃO PRINCIPAL
   ============================================================ */
(async function main() {
    // Lutadores — handshake RSA
    setDot('lutadores', 'loading');
    try {
        await initLutadoresAPI();
        setDot('lutadores', 'online');
        toast('API de Lutadores conectada com RSA-OAEP! 🔐', 'success');

        // Mostrar tabela e esconder spinner
        document.getElementById('init-lutadores').style.display = 'none';
        document.getElementById('table-lutadores').style.display = 'block';

        await loadLutadores();
    } catch (e) {
        setDot('lutadores', 'offline');
        document.getElementById('init-lutadores').innerHTML =
            `<span>❌</span><p>API de Lutadores offline: ${e.message}</p>`;
        toast('API de Lutadores indisponível.', 'error');
    }

    // Apostadores — carrega imediatamente (sem auth)
    await loadApostadores();

    // Lutas — carrega imediatamente (sem auth)
    // (será carregado quando o usuário navegar)

    // Health checks paralelos
    runHealthChecks();

    // Recheck a cada 60 segundos
    setInterval(runHealthChecks, 60_000);
})();
