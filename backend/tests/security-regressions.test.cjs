const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

// Execute the real TypeScript handlers with isolated database/Graph substitutes.
// These tests never load credentials, connect to PostgreSQL, or call Microsoft.
function load(file, stubs = {}) {
    const filename = path.resolve(__dirname, '..', file);
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    const requireStub = name => Object.hasOwn(stubs, name) ? stubs[name] : localRequire(name);
    new Function('require', 'module', 'exports', compiled)(requireStub, module, module.exports);
    return module.exports;
}

function route(file, url, db, graph = {}) {
    const noOp = (_req, _res, next) => next();
    const router = load(file, {
        '../db': { prisma: db },
        '../middleware/auth': { authenticateToken: noOp, requireAdmin: noOp },
        '../utils/email': { sendTicketEmail: async () => {} },
        '../utils/userIdentity': { findPortalUser: async () => null },
        '../utils/safeUser': { SAFE_USER_SELECT: { id: true } },
        '../schemas': { userSchema: { partial: () => ({ safeParse: data => ({ success: true, data }) }) } },
        '../services/m365.service': graph
    }).default;
    const layer = router.stack.find(layer => layer.route?.path === url);
    return layer.route.stack.at(-1).handle;
}

async function invoke(handler, { user = { id: 1, role: 'Admin', email: 'it@example.com' }, body = {}, params = { id: '10' } } = {}) {
    let code = 200, data;
    let complete;
    const response = new Promise(resolve => { complete = resolve; });
    const res = { status(n) { code = n; return this; }, json(value) { data = value; complete(); return this; } };
    await handler({ user, body, params }, res);
    await response;
    return { code, data };
}

test('Microsoft login rejects a Graph token belonging to a different identity', { timeout: 2000 }, async () => {
    const originalFetch = global.fetch;
    const originalTenant = process.env.AZURE_TENANT_ID;
    process.env.AZURE_TENANT_ID = 'test-tenant';
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'different-identity' }) });
    try {
        const router = load('src/routes/auth.routes.ts', {
            '../db': { prisma: {} },
            '../utils/email': {},
            '../utils/userIdentity': { findPortalUser: () => { throw new Error('Unexpected identity lookup'); } },
            '../services/hrReview.service': { queueM365ProfileChanges: () => { throw new Error('Unexpected profile mutation'); } },
            'jwks-rsa': () => ({}),
            'jsonwebtoken': { verify: (_token, _key, _options, callback) => callback(null, { oid: 'signed-in-identity', tid: 'test-tenant', email: 'employee@avanamedical.com' }) }
        }).default;
        const handler = router.stack.find(layer => layer.route?.path === '/api/auth/m365').route.stack.at(-1).handle;
        const result = await invoke(handler, { body: { idToken: 'id-token', accessToken: 'unrelated-access-token' } });
        assert.equal(result.code, 401);
        assert.match(result.data.error, /does not match/);
    } finally {
        global.fetch = originalFetch;
        if (originalTenant === undefined) delete process.env.AZURE_TENANT_ID;
        else process.env.AZURE_TENANT_ID = originalTenant;
    }
});

test('ticket sync checks authorization before returning an existing email reply', async () => {
    let commentRead = false;
    const handler = route('src/routes/tickets.routes.ts', '/api/tickets/:id/sync-email-reply', {
        supportTicket: { findUnique: async () => ({ id: 10, userId: 2, assignedToId: 3, user: { managerId: 9 } }) },
        ticketComment: { findUnique: async () => { commentRead = true; return { message: 'private' }; } }
    });
    const result = await invoke(handler, { user: { id: 1, role: 'User' }, body: { message: 'reply', emailMessageId: 'known-id' } });
    assert.equal(result.code, 403);
    assert.equal(commentRead, false);
    const manager = await invoke(handler, { user: { id: 1, role: 'Manager' }, body: { message: 'reply', emailMessageId: 'known-id' } });
    assert.equal(manager.code, 403);
});

test('ticket sync rejects a message linked to another ticket and prevents sender spoofing', async () => {
    const handler = route('src/routes/tickets.routes.ts', '/api/tickets/:id/sync-email-reply', {
        supportTicket: { findUnique: async () => ({ id: 10, userId: 1, user: { managerId: 9 } }) },
        ticketComment: { findUnique: async () => ({ ticketId: 20 }) }
    });
    assert.equal((await invoke(handler, { body: { message: 'reply', emailMessageId: 'other-ticket' } })).code, 409);
    assert.equal((await invoke(handler, { user: { id: 1, role: 'User', email: 'user@example.com' }, body: { message: 'reply', emailMessageId: 'other-ticket', senderEmail: 'it@example.com' } })).code, 403);
});

function offboarding({ revoke = false, disable = false, remaining = 0, owned = true } = {}) {
    const writes = [], events = [];
    const db = {
        user: { findUnique: async () => ({ id: 2, email: 'employee@example.com', status: 'Active', m365LicenseAssigned: true }), update: async ({ data }) => { writes.push(data); return { id: 2, ...data }; } },
        asset: { findFirst: async () => owned ? { id: 5 } : null, count: async () => remaining, update: async () => { events.push('asset'); } },
        assetHistory: { create: async () => {} },
        licenseAssignment: { deleteMany: async () => { events.push('delete'); } },
        $transaction: async fn => fn(db)
    };
    const handler = route('src/routes/users.routes.ts', '/api/offboarding/process', db, {
        revokeM365Licenses: async () => { events.push('revoke'); return { success: revoke, error: 'Graph unavailable' }; },
        updateM365User: async () => { events.push('disable'); return { success: disable, error: 'Graph unavailable' }; }
    });
    return { handler, writes, events };
}

test('failed cloud offboarding preserves portal licenses and remains retryable', async () => {
    const { handler, events } = offboarding();
    const { data } = await invoke(handler, { body: { userId: 2, revokeAllLicenses: true, disableM365: true } });
    assert.equal(data.offboardingStatus, 'In Progress');
    assert.equal(data.offboardingCompletedDate, null);
    assert.equal(data.m365LicenseRevoked, false);
    assert.equal(data.m365AccountDisabled, false);
    assert.equal(data.operationErrors.length, 2);
    assert.ok(!events.includes('delete'));
});

test('successful cloud actions are recorded before license reclamation', async () => {
    const { handler, events } = offboarding({ revoke: true, disable: true });
    const { data } = await invoke(handler, { body: { userId: 2, revokeAllLicenses: true, disableM365: true } });
    assert.equal(data.offboardingStatus, 'Completed');
    assert.equal(data.m365LicenseRevoked, true);
    assert.equal(data.m365AccountDisabled, true);
    assert.ok(events.indexOf('revoke') < events.indexOf('delete'));
});

test('remaining assets prevent completion, and invalid asset ownership prevents cloud calls', async () => {
    const pending = offboarding({ remaining: 1 });
    assert.equal((await invoke(pending.handler, { body: { userId: 2 } })).data.offboardingStatus, 'In Progress');
    const invalid = offboarding({ owned: false });
    assert.equal((await invoke(invalid.handler, { body: { userId: 2, assetReturn: { assetId: 5 }, revokeAllLicenses: true } })).code, 400);
    assert.deepEqual(invalid.events, []);
});

test('Managers cannot edit their own IT flags or push their profile to Graph', async () => {
    let data;
    const handler = route('src/routes/users.routes.ts', '/api/users/:id', {
        user: { update: async input => { data = input.data; return { id: 1, email: 'manager@example.com', ...input.data }; } }
    }, { updateM365User: () => { throw new Error('Unexpected Graph push'); } });
    const result = await invoke(handler, { user: { id: 1, role: 'Manager' }, params: { id: '1' }, body: { name: 'Manager', offboardingStatus: 'Completed', m365AccountDisabled: true, employeeId: 'FAKE' } });
    assert.equal(result.code, 200);
    assert.deepEqual(data, { name: 'Manager' });
});

test('HR identity matches normalized IDs and whole aliases, rejecting ambiguous matches', async () => {
    let users = [{ id: 1, email: 'new@example.com', employeeId: 'AMD-177', emailAliases: '["old@example.com"]' }];
    const { findPortalUser } = load('src/utils/userIdentity.ts', { '../db': { prisma: { user: { findMany: async () => users } } } });
    assert.equal((await findPortalUser('unknown@example.com', 'AMD_177')).id, 1);
    assert.equal((await findPortalUser('old@example.com')).id, 1);
    assert.equal(await findPortalUser('ld@example.com'), null);
    users.push({ id: 2, email: 'other@example.com', employeeId: 'AMD_177' });
    await assert.rejects(findPortalUser('unknown@example.com', 'AMD177'), /Multiple/);
});

test('failed HR Graph push does not mutate portal data or resolve the notification', async () => {
    let transactions = 0;
    const { applyHrChange } = load('src/services/zoho.service.ts', {
        '../db': { prisma: { hrChangeNotification: { findUnique: async () => ({ status: 'Pending', fieldName: 'Job Title', zohoValue: 'New title', employeeEmail: 'user@example.com' }) }, $transaction: async () => { transactions++; } } },
        '../utils/userIdentity': { findPortalUser: async () => ({ id: 1, azureAdId: 'azure-id' }) },
        './m365.service': { updateM365User: async () => ({ success: false, error: 'Graph unavailable' }) }
    });
    await assert.rejects(applyHrChange(1, 1, true), /Graph unavailable/);
    assert.equal(transactions, 0);
});

test('M365 HR approvals apply the M365 value and resolve within the portal transaction', async () => {
    const notification = { id: 1, status: 'Pending', source: 'Microsoft 365', fieldName: 'Job Title', m365Value: 'Cloud title', zohoValue: 'HR title', employeeEmail: 'user@example.com' };
    let portalData, resolved = false;
    const db = {
        hrChangeNotification: {
            findUnique: async () => notification,
            updateMany: async () => { resolved = true; return { count: 1 }; },
            findUniqueOrThrow: async () => ({ ...notification, status: 'Applied' })
        },
        user: { update: async ({ data }) => { portalData = data; } },
        $transaction: async fn => fn(db)
    };
    const { applyHrChange } = load('src/services/zoho.service.ts', {
        '../db': { prisma: db }, '../utils/userIdentity': { findPortalUser: async () => ({ id: 1 }) }, './m365.service': {}
    });
    assert.equal((await applyHrChange(1, 1)).status, 'Applied');
    assert.deepEqual(portalData, { jobTitle: 'Cloud title' });
    assert.equal(resolved, true);
    notification.fieldName = 'New User Detected';
    await assert.rejects(applyHrChange(1, 1), /Unsupported/);
});

test('cloud-cleared nullable fields are queued for explicit approval', async () => {
    let created;
    const { queueM365ProfileChanges } = load('src/services/hrReview.service.ts', {
        '../db': { prisma: { hrChangeNotification: { findMany: async () => [], create: async ({ data }) => { created = data; } } } }
    });
    await queueM365ProfileChanges({ name: 'Employee', email: 'employee@example.com', mobile: '9999999999' }, { mobile: null });
    assert.equal(created.fieldName, 'Mobile');
    assert.equal(created.m365Value, null);
    assert.equal(created.currentValue, '9999999999');
});

test('M365 blank-field differences are queued without modifying portal records', async () => {
    const created = [];
    const { queueM365ProfileChanges } = load('src/services/hrReview.service.ts', {
        '../db': { prisma: { hrChangeNotification: { findMany: async () => [], create: async ({ data }) => created.push(data) } } }
    });
    await queueM365ProfileChanges({ name: 'Employee', email: 'employee@example.com', jobTitle: null }, { jobTitle: 'Engineer' });
    assert.equal(created.length, 1);
    assert.equal(created[0].source, 'Microsoft 365');
    assert.equal(created[0].m365Value, 'Engineer');
    assert.equal(created[0].currentValue, null);
});

test('production API URL ignores a legacy Render URL; development keeps its configured URL', () => {
    const filename = path.resolve(__dirname, '../../frontend/utils/apiClient.ts');
    const prefix = fs.readFileSync(filename, 'utf8').split('export async function')[0];
    function evaluate(env) {
        const compiled = ts.transpileModule(prefix.replace(/import\.meta/g, 'meta'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS }
        }).outputText;
        const exports = {};
        new Function('meta', 'exports', compiled)({ env }, exports);
        return exports.API_URL;
    }
    assert.equal(evaluate({ PROD: true, VITE_API_URL: 'https://legacy.onrender.com' }), '');
    assert.equal(evaluate({ PROD: false, VITE_API_URL: 'http://localhost:9000/' }), 'http://localhost:9000');
    assert.equal(evaluate({ PROD: false }), 'http://localhost:8080');
});
