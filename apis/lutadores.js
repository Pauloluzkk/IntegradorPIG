/**
 * apis/lutadores.js
 * Módulo de integração com a API de Lutadores — NanadeFight
 * URL: https://lutadores-api-22f61a69f511.herokuapp.com
 * Criptografia: RSA-OAEP 2048 bidirecional (handshake obrigatório)
 */

const API_LUTADORES = '/api/lutadores';

let _privateKey = null;
let _servidorPublicKey = null;
let _initialized = false;

/**
 * Inicializa o handshake RSA-OAEP com o servidor de lutadores.
 * Deve ser chamado antes de qualquer operação CRUD.
 */
export async function initLutadoresAPI() {
    try {
        // 1. Buscar chave pública do servidor
        const res = await fetch(`${API_LUTADORES}/chave-publica`);
        if (!res.ok) throw new Error(`Servidor retornou ${res.status}`);
        const { publicKey: spkiB64 } = await res.json();

        const spkiBytes = Uint8Array.from(atob(spkiB64), c => c.charCodeAt(0));
        _servidorPublicKey = await crypto.subtle.importKey(
            'spki',
            spkiBytes,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );

        // 2. Gerar par de chaves do cliente
        const kp = await crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );
        _privateKey = kp.privateKey;

        // 3. Enviar chave pública ao servidor (handshake)
        const spki = await crypto.subtle.exportKey('spki', kp.publicKey);
        const pubB64 = btoa(String.fromCharCode(...new Uint8Array(spki)));

        const handshakeRes = await fetch(`${API_LUTADORES}/handshake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: pubB64 })
        });
        if (!handshakeRes.ok) throw new Error('Handshake falhou');

        _initialized = true;
        return true;
    } catch (err) {
        _initialized = false;
        throw new Error(`Lutadores init: ${err.message}`);
    }
}

/**
 * Descriptografa a resposta RSA-OAEP do servidor.
 * Respostas criptografadas vêm como array de chunks Base64.
 */
async function _decryptResponse(res) {
    const text = await res.text();
    let sanitizedText;
    if (res.headers.get('X-Content-Encrypted') !== 'true') {
        sanitizedText = text.replace(/""([^"]+)""/g, '"$1"');
    } else {
        const chunks = JSON.parse(text);
        const bytes = [];
        for (const chunk of chunks) {
            const cb = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
            const plain = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, _privateKey, cb);
            bytes.push(...new Uint8Array(plain));
        }
        const decryptedText = new TextDecoder().decode(new Uint8Array(bytes));
        sanitizedText = decryptedText.replace(/""([^"]+)""/g, '"$1"');
    }
    return JSON.parse(sanitizedText);
}

function _checkInit() {
    if (!_initialized) throw new Error('API de Lutadores não inicializada. Aguarde o handshake.');
}

export const LutadoresAPI = {
    /** GET /lutadores — lista todos */
    async listarTodos() {
        _checkInit();
        const res = await fetch(`${API_LUTADORES}/lutadores`);
        if (!res.ok) throw new Error(`Erro ${res.status} ao listar lutadores`);
        return _decryptResponse(res);
    },

    /** GET /lutadores/:id */
    async buscarPorId(id) {
        _checkInit();
        const res = await fetch(`${API_LUTADORES}/lutadores/${id}`);
        if (!res.ok) throw new Error(`Lutador ${id} não encontrado`);
        return _decryptResponse(res);
    },

    /** POST /lutadores?nome=&apelido=&categoria=&arte= */
    async criar({ nome, apelido, categoria, arte }) {
        _checkInit();
        const qs = new URLSearchParams({ nome, apelido, categoria, arte });
        const res = await fetch(`${API_LUTADORES}/lutadores?${qs}`, { method: 'POST' });
        if (!res.ok) throw new Error(`Erro ${res.status} ao criar lutador`);
        return _decryptResponse(res);
    },

    /** PUT /lutadores/:id?campos */
    async atualizar(id, campos) {
        _checkInit();
        const qs = new URLSearchParams(campos);
        const res = await fetch(`${API_LUTADORES}/lutadores/${id}?${qs}`, { method: 'PUT' });
        if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar lutador`);
        return _decryptResponse(res);
    },

    /** DELETE /lutadores/:id */
    async deletar(id) {
        _checkInit();
        const res = await fetch(`${API_LUTADORES}/lutadores/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Erro ${res.status} ao deletar lutador`);
        return _decryptResponse(res);
    }
};

export function isLutadoresReady() { return _initialized; }

/** Mapeamentos de display */
export const CATEGORIAS = { '1': 'Peso Leve', '2': 'Peso Médio', '3': 'Peso Pesado' };
export const ARTES = { '1': 'Boxe', '2': 'Karatê', '3': 'Muay Thai' };
