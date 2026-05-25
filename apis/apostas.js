/**
 * apis/apostas.js
 * Módulo de integração com a API de Apostas — api-aposta-lutas
 * URL: https://api-aposta-lutas.vercel.app
 * Autenticação: JWT Bearer Token (login obrigatório)
 * Criptografia: RSA-2048 assimétrico (tokens JWT RS256)
 */

const API_APOSTAS = '/api/apostas';

let _token = null;

function _authHeaders() {
    if (!_token) throw new Error('Não autenticado. Faça login primeiro.');
    return {
        'Authorization': `Bearer ${_token}`,
        'Content-Type': 'application/json'
    };
}

/** Verifica se há token JWT salvo na sessão */
export function isApostasAuthenticated() {
    return Boolean(_token);
}

export function getApostasToken() { return _token; }

/**
 * POST /auth/registrar
 * Cria uma nova conta na API de apostas
 */
export async function apostasRegistrar(usuario, senha) {
    const res = await fetch(`${API_APOSTAS}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.mensagem || `Erro ${res.status} ao registrar`);
    }
    return res.json();
}

/**
 * POST /auth/login
 * Autentica e armazena o JWT em memória
 */
export async function apostasLogin(usuario, senha) {
    const res = await fetch(`${API_APOSTAS}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.mensagem || `Erro ${res.status} ao fazer login`);
    }
    const data = await res.json();
    _token = data.token;
    return data;
}

export function apostasLogout() { _token = null; }

/** Health check */
export async function checkApostasHealth() {
    try {
        // Tenta endpoint público (retorna 401 em vez de timeout se online)
        const res = await fetch(`${API_APOSTAS}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: '__health__', senha: '__check__' }),
            signal: AbortSignal.timeout(5000)
        });
        // 401 ou 400 = servidor online mas credenciais erradas = OK
        return res.status === 401 || res.status === 400 || res.status === 422 || res.ok;
    } catch {
        return false;
    }
}

export const ApostasAPI = {
    /**
     * GET /apostas?id_apostador=X
     * Lista apostas (opcionalmente filtradas por apostador)
     */
    async listarTodas(idApostador = null) {
        const url = idApostador
            ? `${API_APOSTAS}/apostas?id_apostador=${idApostador}`
            : `${API_APOSTAS}/apostas`;
        const res = await fetch(url, { headers: _authHeaders() });
        if (!res.ok) throw new Error(`Erro ${res.status} ao listar apostas`);
        return res.json();
    },

    /**
     * POST /apostas
     * Body: { valor, id_luta, id_lutador, id_apostador }
     */
    async criar({ valor, id_luta, id_lutador, id_apostador }) {
        const res = await fetch(`${API_APOSTAS}/apostas`, {
            method: 'POST',
            headers: _authHeaders(),
            body: JSON.stringify({
                valor: parseFloat(valor),
                id_luta: Number(id_luta),
                id_lutador: Number(id_lutador),
                id_apostador: Number(id_apostador)
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Erro ${res.status} ao criar aposta`);
        }
        return res.json();
    },

    /**
     * PUT /apostas/:id
     * Body: { valor, id_luta, id_lutador, id_apostador }
     */
    async atualizar(id, campos) {
        const res = await fetch(`${API_APOSTAS}/apostas/${id}`, {
            method: 'PUT',
            headers: _authHeaders(),
            body: JSON.stringify({
                valor: parseFloat(campos.valor),
                id_luta: Number(campos.id_luta),
                id_lutador: Number(campos.id_lutador),
                id_apostador: Number(campos.id_apostador)
            })
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar aposta`);
        return res.json();
    },

    /** DELETE /apostas/:id */
    async deletar(id) {
        const res = await fetch(`${API_APOSTAS}/apostas/${id}`, {
            method: 'DELETE',
            headers: _authHeaders()
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao deletar aposta`);
        try { return await res.json(); } catch { return {}; }
    }
};
