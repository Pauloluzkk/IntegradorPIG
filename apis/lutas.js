/**
 * apis/lutas.js
 * Módulo de integração com a API de Lutas — bet3m
 * URL: https://bet3m-production.up.railway.app
 * Autenticação: Header X-API-KEY
 */

const API_LUTAS = '/api/lutas';
const API_KEY = 'bet3M-UENP';

const _headers = {
    'X-API-KEY': API_KEY,
    'Content-Type': 'application/json'
};

/** Verifica se a API está respondendo (health check) */
export async function checkLutasHealth() {
    try {
        const res = await fetch(`${API_LUTAS}/lutas`, { headers: _headers, signal: AbortSignal.timeout(5000) });
        return res.ok || res.status === 200;
    } catch {
        return false;
    }
}

export const LutasAPI = {
    /** GET /lutas — lista todas as lutas */
    async listarTodas() {
        const res = await fetch(`${API_LUTAS}/lutas`, { headers: _headers });
        if (!res.ok) throw new Error(`Erro ${res.status} ao listar lutas`);
        return res.json();
    },

    /** GET /lutas/:id */
    async buscarPorId(id) {
        const res = await fetch(`${API_LUTAS}/lutas/${id}`, { headers: _headers });
        if (!res.ok) throw new Error(`Luta ${id} não encontrada`);
        return res.json();
    },

    /**
     * POST /lutas
     * Body: { horario, data, lutador1, lutador2 }
     */
    async criar({ horario, data, lutador1, lutador2 }) {
        const res = await fetch(`${API_LUTAS}/lutas`, {
            method: 'POST',
            headers: _headers,
            body: JSON.stringify({ horario, data, lutador1: Number(lutador1), lutador2: Number(lutador2) })
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao criar luta`);
        return res.json();
    },

    /**
     * PUT /lutas/:id
     * Body: { horario, data, lutador1, lutador2 }
     */
    async atualizar(id, campos) {
        const res = await fetch(`${API_LUTAS}/lutas/${id}`, {
            method: 'PUT',
            headers: _headers,
            body: JSON.stringify({
                ...campos,
                lutador1: Number(campos.lutador1),
                lutador2: Number(campos.lutador2)
            })
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar luta`);
        return res.json();
    },

    /** DELETE /lutas/:id */
    async deletar(id) {
        const res = await fetch(`${API_LUTAS}/lutas/${id}`, {
            method: 'DELETE',
            headers: _headers
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao deletar luta`);
        // Retorna JSON se disponível, ou objeto vazio
        try { return await res.json(); } catch { return {}; }
    }
};
