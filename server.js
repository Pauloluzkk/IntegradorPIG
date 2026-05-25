const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());

// Helper to copy headers from client request
function getHeaders(req, targetHost) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const lowerKey = key.toLowerCase();
        // Skip host-specific headers that should be set by the new request
        if (!['host', 'connection', 'content-length', 'accept-encoding', 'origin', 'referer'].includes(lowerKey)) {
            headers[key] = value;
        }
    }
    return headers;
}

async function proxyLutadoresRequest(req, res, targetUrl) {
    const url = `${targetUrl}${req.url}`;
    const parsed = new URL(targetUrl);
    const headers = getHeaders(req, parsed.host);
    const options = {
        method: req.method,
        headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        options.headers['content-type'] = 'application/json';
    }

    console.log(`[LUTADORES PROXY] Forwarding ${req.method} ${req.originalUrl} -> ${url}`);
    const response = await fetch(url, options);

    response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    });

    res.status(response.status);
    res.send(await response.text());
}

app.use('/api/lutadores', async (req, res) => {
    const primaryUrl = 'https://lutadores-api-22f61a69f511.herokuapp.com';
    const secondaryUrl = 'https://api-lutadoressd.onrender.com/api';

    if (req.url === '/chave-publica' || req.url === '/handshake') {
        try {
            return await proxyLutadoresRequest(req, res, primaryUrl);
        } catch (err) {
            console.error(`[LUTADORES PROXY ERROR] Handshake/Key retrieval failed:`, err.message);
            res.status(502).json({ error: 'Primary Lutadores API handshake failed', details: err.message });
        }
        return;
    }

    try {
        await proxyLutadoresRequest(req, res, primaryUrl);
    } catch (primaryErr) {
        console.warn(`[LUTADORES FAILOVER] Primary failed (${primaryErr.message}). Trying secondary API...`);
        try {
            await proxyLutadoresRequest(req, res, secondaryUrl);
        } catch (secondaryErr) {
            console.error(`[LUTADORES FATAL] Both Lutadores APIs failed.`);
            res.status(502).json({
                error: 'All Lutadores APIs are offline',
                primaryError: primaryErr.message,
                secondaryError: secondaryErr.message
            });
        }
    }
});

// ==========================================
// LUTAS PROXY (with Failover & Translation)
// ==========================================
function translateLutasToStandard(json) {
    if (Array.isArray(json)) {
        return json.map(item => translateLutasToStandard(item));
    }
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('id_lutador1' in copy) {
            copy.lutador1 = copy.id_lutador1;
            delete copy.id_lutador1;
        }
        if ('id_lutador2' in copy) {
            copy.lutador2 = copy.id_lutador2;
            delete copy.id_lutador2;
        }
        return copy;
    }
    return json;
}

function translateStandardToLutas(json) {
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('lutador1' in copy) {
            copy.id_lutador1 = Number(copy.lutador1);
            delete copy.lutador1;
        }
        if ('lutador2' in copy) {
            copy.id_lutador2 = Number(copy.lutador2);
            delete copy.lutador2;
        }
        return copy;
    }
    return json;
}

async function proxyLutasRequest(req, res, targetUrl, useTranslation) {
    const parsedTarget = new URL(targetUrl);
    const url = `${targetUrl}${req.url}`;
    const headers = getHeaders(req, parsedTarget.host);
    const options = {
        method: req.method,
        headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        let bodyToSend = req.body;
        if (useTranslation) {
            bodyToSend = translateStandardToLutas(req.body);
        }
        options.body = JSON.stringify(bodyToSend);
        options.headers['content-type'] = 'application/json';
    }

    console.log(`[LUTAS PROXY] Forwarding ${req.method} ${req.originalUrl} -> ${url} (translation: ${useTranslation})`);
    const response = await fetch(url, options);

    response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    });

    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        let json = await response.json();
        if (useTranslation) {
            json = translateLutasToStandard(json);
        }
        res.json(json);
    } else {
        res.send(await response.text());
    }
}

app.use('/api/lutas', async (req, res) => {
    const primaryUrl = 'https://bet3m-production.up.railway.app';
    const secondaryUrl = 'https://betting-api-lutas.vercel.app';

    try {
        // Try Primary Lutas API (bet3m)
        await proxyLutasRequest(req, res, primaryUrl, false);
    } catch (primaryErr) {
        console.warn(`[LUTAS FAILOVER] Primary failed (${primaryErr.message}). Trying secondary API...`);
        try {
            // Try Secondary Lutas API (betting-api-lutas)
            await proxyLutasRequest(req, res, secondaryUrl, true);
        } catch (secondaryErr) {
            console.error(`[LUTAS FATAL] Both Lutas APIs failed.`);
            res.status(502).json({
                error: 'All Lutas APIs are offline',
                primaryError: primaryErr.message,
                secondaryError: secondaryErr.message
            });
        }
    }
});

// ==========================================
// APOSTADORES PROXY (with Failover, Translation & Auth)
// ==========================================
async function authRuan() {
    try {
        const res = await fetch("https://api-apostadores-fight-azure.vercel.app/login", {
            method: "POST",
            body: JSON.stringify({ usuario: "admin", senha: "123" }),
            headers: { "Content-Type": "application/json" }
        });
        if (!res.ok) throw new Error(`Ruan auth returned ${res.status}`);
        const data = await res.json();
        return data.token;
    } catch (err) {
        console.error("[APOSTADORES FAILOVER AUTH ERROR] Failed to auth with Ruan API:", err.message);
        throw err;
    }
}

function translateApostadoresToStandard(json) {
    if (Array.isArray(json)) {
        return json.map(item => translateApostadoresToStandard(item));
    }
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('chavePix' in copy) {
            copy.chave_pix = copy.chavePix;
            delete copy.chavePix;
        }
        return copy;
    }
    return json;
}

function translateStandardToApostadores(json) {
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('chave_pix' in copy) {
            copy.chavePix = copy.chave_pix;
            delete copy.chave_pix;
        }
        return copy;
    }
    return json;
}

async function proxyApostadoresRequest(req, res, targetUrl, useTranslation, useAuth) {
    const parsedTarget = new URL(targetUrl);
    const url = `${targetUrl}${req.url}`;
    const headers = getHeaders(req, parsedTarget.host);

    if (useAuth) {
        const token = await authRuan();
        headers['authorization'] = `Bearer ${token}`;
    }

    const options = {
        method: req.method,
        headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        let bodyToSend = req.body;
        if (useTranslation) {
            bodyToSend = translateStandardToApostadores(req.body);
        }
        options.body = JSON.stringify(bodyToSend);
        options.headers['content-type'] = 'application/json';
    }

    console.log(`[APOSTADORES PROXY] Forwarding ${req.method} ${req.originalUrl} -> ${url} (translation: ${useTranslation}, auth: ${useAuth})`);
    const response = await fetch(url, options);

    response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    });

    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        let json = await response.json();
        if (useTranslation) {
            json = translateApostadoresToStandard(json);
        }
        res.json(json);
    } else {
        res.send(await response.text());
    }
}

app.use('/api/apostadores', async (req, res) => {
    const primaryUrl = 'https://api-sd-df8o.onrender.com';
    const secondaryUrl = 'https://api-apostadores-fight-azure.vercel.app';

    try {
        // Try Primary (m-valentim / Render)
        await proxyApostadoresRequest(req, res, primaryUrl, false, false);
    } catch (primaryErr) {
        console.warn(`[APOSTADORES FAILOVER] Primary failed (${primaryErr.message}). Trying secondary API...`);
        try {
            // Try Secondary (Ruan / Vercel, requires translation & auth)
            await proxyApostadoresRequest(req, res, secondaryUrl, true, true);
        } catch (secondaryErr) {
            console.error(`[APOSTADORES FATAL] Both Apostadores APIs failed.`);
            res.status(502).json({
                error: 'All Apostadores APIs are offline',
                primaryError: primaryErr.message,
                secondaryError: secondaryErr.message
            });
        }
    }
});

// ==========================================
// APOSTAS PROXY (with Failover & Translation)
// ==========================================
function translateApostasToStandard(json) {
    if (Array.isArray(json)) {
        return json.map(item => translateApostasToStandard(item));
    }
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('idApostador' in copy) {
            copy.id_apostador = copy.idApostador;
            delete copy.idApostador;
        }
        if ('idLuta' in copy) {
            copy.id_luta = copy.idLuta;
            delete copy.idLuta;
        }
        if ('idLutador1' in copy) {
            copy.id_lutador = copy.idLutador1;
            delete copy.idLutador1;
        }
        if ('idLutador2' in copy) {
            delete copy.idLutador2;
        }
        return copy;
    }
    return json;
}

function translateStandardToApostas(json) {
    if (json && typeof json === 'object') {
        const copy = { ...json };
        if ('id_apostador' in copy) {
            copy.idApostador = Number(copy.id_apostador);
            delete copy.id_apostador;
        }
        if ('id_luta' in copy) {
            copy.idLuta = Number(copy.id_luta);
            delete copy.id_luta;
        }
        if ('id_lutador' in copy) {
            copy.idLutador1 = Number(copy.id_lutador);
            copy.idLutador2 = null;
            delete copy.id_lutador;
        }
        return copy;
    }
    return json;
}

async function proxyApostasRequest(req, res, targetUrl, useTranslation) {
    const parsedTarget = new URL(targetUrl);
    const url = `${targetUrl}${req.url}`;
    const headers = getHeaders(req, parsedTarget.host);
    const options = {
        method: req.method,
        headers: headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        let bodyToSend = req.body;
        if (useTranslation) {
            bodyToSend = translateStandardToApostas(req.body);
        }
        options.body = JSON.stringify(bodyToSend);
        options.headers['content-type'] = 'application/json';
    }

    console.log(`[APOSTAS PROXY] Forwarding ${req.method} ${req.originalUrl} -> ${url} (translation: ${useTranslation})`);
    const response = await fetch(url, options);

    response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    });

    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        let json = await response.json();
        if (useTranslation) {
            json = translateApostasToStandard(json);
        }
        res.json(json);
    } else {
        res.send(await response.text());
    }
}

app.use('/api/apostas', async (req, res) => {
    const primaryUrl = 'https://api-aposta-lutas.vercel.app';
    const secondaryUrl = 'http://187.77.235.119:5555';

    try {
        // Try Primary (JWT / Vercel)
        await proxyApostasRequest(req, res, primaryUrl, false);
    } catch (primaryErr) {
        console.warn(`[APOSTAS FAILOVER] Primary failed (${primaryErr.message}). Trying secondary API...`);
        try {
            // Try Secondary (China API)
            await proxyApostasRequest(req, res, secondaryUrl, true);
        } catch (secondaryErr) {
            console.error(`[APOSTAS FATAL] Both Apostas APIs failed.`);
            res.status(502).json({
                error: 'All Apostas APIs are offline',
                primaryError: primaryErr.message,
                secondaryError: secondaryErr.message
            });
        }
    }
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
