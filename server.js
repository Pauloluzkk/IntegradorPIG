const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());

// ==========================================
// HELPER: Copy relevant headers from client request
// ==========================================
function getHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const lowerKey = key.toLowerCase();
        if (!['host', 'connection', 'content-length', 'accept-encoding', 'origin', 'referer'].includes(lowerKey)) {
            headers[key] = value;
        }
    }
    return headers;
}

// ==========================================
// HELPER: Try fetch, return { response, body } or throw
// Does NOT touch Express res — just fetches data.
// ==========================================
async function tryFetch(url, options, label) {
    console.log(`[${label}] Trying ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });

    const text = await response.text();

    if (response.status >= 500) {
        throw new Error(`HTTP ${response.status} from ${url}: ${text.substring(0, 200)}`);
    }

    return { status: response.status, headers: response.headers, text };
}

// ==========================================
// HELPER: Send a fetched result to Express res
// ==========================================
function sendResult(res, result) {
    result.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    });
    res.status(result.status);
    res.send(result.text);
}

// ==========================================
// HELPER: Build fetch options from Express req
// ==========================================
function buildFetchOptions(req, extraHeaders = {}) {
    const headers = { ...getHeaders(req), ...extraHeaders };
    const options = { method: req.method, headers };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        options.headers['content-type'] = 'application/json';
    }

    return options;
}

// ==========================================
// HELPER: Generic failover proxy
// targets = [{ url, label, transform?, buildOptions? }]
// ==========================================
async function proxyWithFailover(req, res, targets) {
    const errors = [];

    for (const target of targets) {
        try {
            const options = target.buildOptions
                ? await target.buildOptions(req)
                : buildFetchOptions(req);

            const fullUrl = `${target.url}${req.url}`;
            const result = await tryFetch(fullUrl, options, target.label);

            // Apply response translation if needed
            if (target.transformResponse) {
                const contentType = result.headers.get('content-type') || '';
                if (contentType.includes('application/json') && result.text.trim()) {
                    try {
                        let json = JSON.parse(result.text);
                        json = target.transformResponse(json);
                        result.text = JSON.stringify(json);
                    } catch (parseErr) {
                        // If JSON parse fails, send raw text anyway
                        console.warn(`[${target.label}] JSON transform failed: ${parseErr.message}`);
                    }
                }
            }

            sendResult(res, result);
            return; // Success — stop trying
        } catch (err) {
            console.warn(`[${target.label} FAILED] ${err.message}`);
            errors.push({ target: target.label, error: err.message });
        }
    }

    // All targets failed
    console.error(`[PROXY FATAL] All targets failed for ${req.method} ${req.originalUrl}`);
    res.status(502).json({
        error: 'All API targets are offline',
        details: errors
    });
}


// ==========================================
// LUTADORES PROXY
// ==========================================
app.use('/api/lutadores', async (req, res) => {
    // Handshake/key routes are RSA-specific, only work with primary
    if (req.url === '/chave-publica' || req.url === '/handshake') {
        return proxyWithFailover(req, res, [
            { url: 'https://lutadores-api-22f61a69f511.herokuapp.com', label: 'LUTADORES-PRIMARY' }
        ]);
    }

    await proxyWithFailover(req, res, [
        { url: 'https://lutadores-api-22f61a69f511.herokuapp.com', label: 'LUTADORES-PRIMARY' },
        { url: 'https://api-lutadoressd.onrender.com/api', label: 'LUTADORES-SECONDARY (PedroHPedroso)' }
    ]);
});


// ==========================================
// LUTAS PROXY
// ==========================================
function translateLutasToStandard(json) {
    if (Array.isArray(json)) return json.map(translateLutasToStandard);
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('id_lutador1' in copy) { copy.lutador1 = copy.id_lutador1; delete copy.id_lutador1; }
        if ('id_lutador2' in copy) { copy.lutador2 = copy.id_lutador2; delete copy.id_lutador2; }
        return copy;
    }
    return json;
}

function translateStandardToLutas(body) {
    if (body && typeof body === 'object') {
        const copy = { ...body };
        if ('lutador1' in copy) { copy.id_lutador1 = Number(copy.lutador1); delete copy.lutador1; }
        if ('lutador2' in copy) { copy.id_lutador2 = Number(copy.lutador2); delete copy.lutador2; }
        return copy;
    }
    return body;
}

app.use('/api/lutas', async (req, res) => {
    await proxyWithFailover(req, res, [
        {
            url: 'https://bet3m-production.up.railway.app',
            label: 'LUTAS-PRIMARY (bet3m/joaofoguin)'
        },
        {
            url: 'https://betting-api-lutas.vercel.app',
            label: 'LUTAS-SECONDARY (nanadebet)',
            transformResponse: translateLutasToStandard,
            buildOptions: (req) => {
                const opts = buildFetchOptions(req);
                // Translate body for writes
                if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
                    opts.body = JSON.stringify(translateStandardToLutas(req.body));
                }
                return opts;
            }
        }
    ]);
});


// ==========================================
// APOSTADORES PROXY
// ==========================================
async function authRuan() {
    const res = await fetch("https://api-apostadores-fight-azure.vercel.app/login", {
        method: "POST",
        body: JSON.stringify({ usuario: "admin", senha: "123" }),
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Ruan auth returned ${res.status}`);
    const data = await res.json();
    return data.token;
}

function translateApostadoresToStandard(json) {
    if (Array.isArray(json)) return json.map(translateApostadoresToStandard);
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('chavePix' in copy) { copy.chave_pix = copy.chavePix; delete copy.chavePix; }
        return copy;
    }
    return json;
}

function translateStandardToApostadores(body) {
    if (body && typeof body === 'object') {
        const copy = { ...body };
        if ('chave_pix' in copy) { copy.chavePix = copy.chave_pix; delete copy.chave_pix; }
        return copy;
    }
    return body;
}

app.use('/api/apostadores', async (req, res) => {
    await proxyWithFailover(req, res, [
        {
            url: 'https://api-sd-df8o.onrender.com',
            label: 'APOSTADORES-PRIMARY (m-valentim)'
        },
        {
            url: 'https://api-apostadores-fight-azure.vercel.app',
            label: 'APOSTADORES-SECONDARY (RuanTirabassi)',
            transformResponse: translateApostadoresToStandard,
            buildOptions: async (req) => {
                const opts = buildFetchOptions(req);
                // Auth + body translation
                const token = await authRuan();
                opts.headers['authorization'] = `Bearer ${token}`;
                if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
                    opts.body = JSON.stringify(translateStandardToApostadores(req.body));
                }
                return opts;
            }
        }
    ]);
});


// ==========================================
// APOSTAS PROXY
// ==========================================
function translateApostasToStandard(json) {
    if (Array.isArray(json)) return json.map(translateApostasToStandard);
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('idApostador' in copy) { copy.id_apostador = copy.idApostador; delete copy.idApostador; }
        if ('idLuta' in copy) { copy.id_luta = copy.idLuta; delete copy.idLuta; }
        if ('idLutador1' in copy) { copy.id_lutador = copy.idLutador1; delete copy.idLutador1; }
        if ('idLutador2' in copy) { delete copy.idLutador2; }
        return copy;
    }
    return json;
}

function translateStandardToApostas(body) {
    if (body && typeof body === 'object') {
        const copy = { ...body };
        if ('id_apostador' in copy) { copy.idApostador = Number(copy.id_apostador); delete copy.id_apostador; }
        if ('id_luta' in copy) { copy.idLuta = Number(copy.id_luta); delete copy.id_luta; }
        if ('id_lutador' in copy) { copy.idLutador1 = Number(copy.id_lutador); copy.idLutador2 = null; delete copy.id_lutador; }
        return copy;
    }
    return body;
}

app.use('/api/apostas', async (req, res) => {
    await proxyWithFailover(req, res, [
        {
            url: 'https://api-aposta-lutas.vercel.app',
            label: 'APOSTAS-PRIMARY (educalza)'
        },
        {
            url: 'http://187.77.235.119:5555',
            label: 'APOSTAS-SECONDARY (nanadebet)',
            transformResponse: translateApostasToStandard,
            buildOptions: (req) => {
                const opts = buildFetchOptions(req);
                if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
                    opts.body = JSON.stringify(translateStandardToApostas(req.body));
                }
                return opts;
            }
        }
    ]);
});


// ==========================================
// STATIC FRONTEND SERVING
// ==========================================
app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 IntegradorPIG Gateway is running at http://localhost:${PORT}`);
    console.log(`📂 Serving FrontEnd files statically`);
    console.log(`🔌 Proxies active on /api/lutadores, /api/lutas, /api/apostadores, /api/apostas`);
    console.log(`====================================================`);
});
