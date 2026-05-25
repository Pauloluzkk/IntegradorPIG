/**
 * apis/apostadores.js
 * Módulo de integração com a API de Apostadores — api-sd (m-valentim)
 * URL: https://api-sd-df8o.onrender.com
 * Autenticação: Nenhuma (JSON puro)
 * Criptografia: RSA em repouso (transparente para o cliente)
 *
 * Endpoints (via OpenAPI):
 *   GET    /apostadores/
 *   POST   /apostadores/
 *   PUT    /apostadores/{apostador_id}
 *   DELETE /apostadores/{apostador_id}
 *
 * Modelo:
 *   { nome: string, idade: int, chave_pix: string }
 */

const API_APOSTADORES = '/api/apostadores';

const _headers = { 'Content-Type': 'application/json' };

/** Health check */
export async function checkApostadoresHealth() {
    try {
        const res = await fetch(`${API_APOSTADORES}/apostadores/`, {
            signal: AbortSignal.timeout(8000) // Render pode demorar a acordar
        });
        return res.ok;
    } catch {
        return false;
    }
}

export const ApostadoresAPI = {
    /** GET /apostadores/ — lista todos os apostadores */
    async listarTodos() {
        const res = await fetch(`${API_APOSTADORES}/apostadores/`);
        if (!res.ok) throw new Error(`Erro ${res.status} ao listar apostadores`);
        return res.json();
    },

    /**
     * POST /apostadores/
     * Body: { nome: string, idade: int, chave_pix: string }
     */
    async criar({ nome, idade, chave_pix }) {
        const res = await fetch(`${API_APOSTADORES}/apostadores/`, {
            method: 'POST',
            headers: _headers,
            body: JSON.stringify({ nome, idade: Number(idade), chave_pix })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail?.[0]?.msg || `Erro ${res.status} ao criar apostador`);
        }
        return res.json();
    },

    /**
     * PUT /apostadores/{apostador_id}
     * Body: { nome, idade, chave_pix }
     */
    async atualizar(id, { nome, idade, chave_pix }) {
        const res = await fetch(`${API_APOSTADORES}/apostadores/${id}`, {
            method: 'PUT',
            headers: _headers,
            body: JSON.stringify({ nome, idade: Number(idade), chave_pix })
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar apostador`);
        return res.json();
    },

    /** DELETE /apostadores/{apostador_id} */
    async deletar(id) {
        const res = await fetch(`${API_APOSTADORES}/apostadores/${id}`, {
            method: 'DELETE',
            headers: _headers
        });
        if (!res.ok) throw new Error(`Erro ${res.status} ao deletar apostador`);
        try { return await res.json(); } catch { return {}; }
    }
};
