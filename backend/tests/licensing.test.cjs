const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

function load(file, stubs = {}) {
    const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = createRequire(filename);
    new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(stubs, name) ? stubs[name] : name === './licenseCache.service' ? { reconcileM365Assignments() { throw new Error('Unexpected membership cache write'); } } : localRequire(name), module, module.exports);
    return module.exports;
}
const policy = load('src/utils/licensePolicy.ts');
const azureId = '12345678-1234-1234-1234-123456789012';
const skuId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const cloudLicense = { id: 1, name: 'Microsoft 365 Business Standard', isM365: true, skuId, seats: 10 };

function service({ user = {}, after, postError, enabled = 10, consumed = 2, license = cloudLicense } = {}) {
    const posts = [], updates = [];
    let reads = 0;
    const before = { id: azureId, displayName: 'Employee', userPrincipalName: 'employee@example.invalid', usageLocation: 'IN', accountEnabled: true, assignedLicenses: [], licenseAssignmentStates: [], ...user };
    const api = load('src/services/licenseManagement.service.ts', {
        axios: { get: async () => ({ data: reads++ === 0 ? before : { ...before, ...(after || {}) } }), post: async (...args) => { posts.push(args); if (postError) throw postError; return { data: {} }; } },
        '../db': { prisma: { license: { findUnique: async () => license }, user: { findUnique: async () => ({ id: 2, status: 'Active', azureAdId: azureId }), updateMany: async value => updates.push(value) } } },
        '../utils/email': { getGraphAppToken: async () => ({ token: 'test-token' }) },
        '../utils/userIdentity': {}, '../utils/licensePolicy': policy,
        './m365.service': { fetchM365SubscribedSkus: async () => [{ skuId, prepaidUnits: { enabled }, consumedUnits: consumed }] },
        './licenseCache.service': { reconcileM365Assignments: async () => {} }, './zoho.service': {}
    });
    return { ...api, posts, updates };
}

test('provider policy distinguishes Zoho, linked M365 and manual Microsoft desktop software', () => {
    assert.equal(policy.licenseProvider({ name: 'Zoho One' }), 'zoho');
    assert.equal(policy.licenseProvider({ name: 'HR', key: 'ZOHO-PEOPLE-PLUS' }), 'zoho');
    assert.equal(policy.licenseProvider({ name: 'Visio', skuId }), 'm365');
    assert.equal(policy.licenseProvider({ name: 'Office 365' }), 'm365');
    assert.equal(policy.licenseProvider({ name: 'Microsoft Office 2021' }), 'manual');
});

test('M365 assignment changes only the requested SKU using the real Graph endpoint', async () => {
    const s = service({ after: { assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, assignedByGroup: null, state: 'Active' }] } });
    const result = await s.changeM365License(1, 'assign', { userId: 2 });
    assert.equal(result.status, 'confirmed');
    assert.equal(s.posts.length, 1);
    assert.equal(s.posts[0][0], `https://graph.microsoft.com/v1.0/users/${azureId}/assignLicense`);
    assert.deepEqual(s.posts[0][1], { addLicenses: [{ skuId, disabledPlans: [] }], removeLicenses: [] });
    assert.equal(s.updates[0].data.m365LicenseAssigned, true);
});

test('M365 removal preserves other product licenses', async () => {
    const otherSku = 'other-sku';
    const s = service({ user: { assignedLicenses: [{ skuId }, { skuId: otherSku }], licenseAssignmentStates: [{ skuId, assignedByGroup: null, state: 'Active' }] }, after: { assignedLicenses: [{ skuId: otherSku }] } });
    assert.equal((await s.changeM365License(1, 'remove', { azureAdId: azureId })).status, 'confirmed');
    assert.deepEqual(s.posts[0][1], { addLicenses: [], removeLicenses: [skuId] });
    assert.equal(s.updates[0].data.m365LicenseAssigned, true);
});

test('group-managed and unknown-source assignments cannot be removed directly', async () => {
    for (const states of [[{ skuId, assignedByGroup: 'group-id', state: 'Active' }], []]) {
        const s = service({ user: { assignedLicenses: [{ skuId }], licenseAssignmentStates: states } });
        await assert.rejects(s.changeM365License(1, 'remove', { azureAdId: azureId }), /group-managed/);
        assert.equal(s.posts.length, 0);
    }
});

test('missing usage location, exhausted capacity and Zoho products block provisioning', async () => {
    for (const [config, message] of [[{ user: { usageLocation: null } }, /usage location/], [{ enabled: 0, consumed: 0 }, /No Microsoft 365 seats/], [{ license: { name: 'Zoho People Plus', key: 'ZOHO-PEOPLE-PLUS' } }, /Microsoft 365 subscription/]]) {
        const s = service(config);
        await assert.rejects(s.changeM365License(1, 'assign', { userId: 2 }), message);
        assert.equal(s.posts.length, 0);
    }
});

test('accepted but unverified changes remain pending and do not update portal flags', async () => {
    const s = service();
    assert.equal((await s.changeM365License(1, 'assign', { userId: 2 })).status, 'pending');
    assert.equal(s.updates.length, 0);
});

test('cloud errors are not reported as successful assignments', async () => {
    const failed = service({ postError: new Error('Graph rejected request') });
    await assert.rejects(failed.changeM365License(1, 'assign', { userId: 2 }), /Graph rejected/);
    assert.equal(failed.updates.length, 0);
    const errored = service({ after: { assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, state: 'ActiveWithError', error: 'DependencyViolation' }] } });
    await assert.rejects(errored.changeM365License(1, 'assign', { userId: 2 }), /DependencyViolation/);
    assert.equal(errored.updates.length, 0);
});

test('already-assigned licenses are idempotent and retain existing service-plan settings', async () => {
    const s = service({ user: { assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, assignedByGroup: null }] } });
    assert.equal((await s.changeM365License(1, 'assign', { userId: 2 })).status, 'confirmed');
    assert.equal(s.posts.length, 0);
});

function router(db) {
    const noop = function authenticateToken(_req, _res, next) { next(); };
    const admin = function requireAdmin(_req, _res, next) { next(); };
    return load('src/routes/licenses.routes.ts', {
        '../db': { prisma: db }, '../utils/licensePolicy': policy,
        '../services/licenseManagement.service': { LicenseActionError: class extends Error {} },
        '../middleware/auth': { authenticateToken: noop, requireAdmin: admin },
        '../schemas': load('src/schemas.ts')
    }).default;
}
async function invoke(router, method, url, body = {}) {
    let status = 200, value;
    const route = router.stack.find(l => l.route?.path === url && l.route.methods[method]).route;
    assert.equal(route.stack[1].handle.name, 'requireAdmin');
    await route.stack.at(-1).handle({ body, params: { id: '1' }, user: { role: 'Admin' } }, { status(code) { status = code; return this; }, json(data) { value = data; return this; } });
    return { status, value };
}

test('generic assignment APIs cannot edit Zoho or fake a Microsoft assignment locally', async () => {
    for (const license of [{ id: 1, name: 'Zoho People', assignments: [] }, { ...cloudLicense, assignments: [] }]) {
        const r = router({ license: { findUnique: async () => license }, licenseAssignment: { findUnique: async () => ({ id: 1, license }) } });
        assert.equal((await invoke(r, 'post', '/api/license-assignments', { licenseId: 1, userId: 2 })).status, 409);
        assert.equal((await invoke(r, 'delete', '/api/license-assignments/:id')).status, 409);
        assert.equal((await invoke(r, 'delete', '/api/licenses/:id')).status, 409);
        assert.equal((await invoke(r, 'put', '/api/licenses/:id', { name: 'Updated', category: 'Cloud', seats: 99 })).status, 409);
    }
});

test('manual creation cannot impersonate a cloud subscription', async () => {
    const r = router({});
    assert.equal((await invoke(r, 'post', '/api/licenses', { name: 'Zoho One', category: 'HR', seats: 5 })).status, 409);
});

test('Zoho details are a read-only active employee roster, including unmatched people', async () => {
    const api = load('src/services/licenseManagement.service.ts', {
        axios: {}, '../db': { prisma: { license: { findUnique: async () => ({ name: 'Zoho People Plus', key: 'ZOHO-PEOPLE-PLUS', assignments: [] }) } } },
        '../utils/email': {}, '../utils/userIdentity': {}, '../utils/licensePolicy': policy, './m365.service': {},
        './zoho.service': { fetchZohoEmployees: async () => [{ employeeId: 'AMD_1', email: 'one@example.invalid', fullName: 'Employee', status: 'Active' }, { email: 'old@example.invalid', status: 'Resigned' }] }
    });
    const details = await api.licenseDetails(1);
    assert.equal(details.members.length, 1);
    assert.equal(details.members[0].removable, false);
    assert.equal(details.members[0].employeeId, 'AMD_1');
    assert.equal(details.seats, undefined);
});

test('Microsoft details use tenant counts and protect inherited assignments', async () => {
    let reconciled = false;
    const db = {
        license: { findUnique: async () => ({ ...cloudLicense, assignments: [] }), update: async () => {} },
        user: { findMany: async () => [] },
        licenseAssignment: { deleteMany: async () => { reconciled = true; } },
        $transaction: async fn => fn(db)
    };
    const api = load('src/services/licenseManagement.service.ts', {
        axios: {}, '../db': { prisma: db }, '../utils/email': { getGraphAppToken: async () => ({ token: 'test' }) },
        '../utils/userIdentity': { findPortalUser: async () => null }, '../utils/licensePolicy': policy,
        './licenseCache.service': { reconcileM365Assignments: async () => { reconciled = true; } },
        './m365.service': {
            fetchAllM365Users: async () => [
                { id: azureId, displayName: 'Direct user', userPrincipalName: 'direct@example.invalid', assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, assignedByGroup: null, state: 'Active' }] },
                { id: 'group-user', displayName: 'Group user', userPrincipalName: 'group@example.invalid', assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, assignedByGroup: 'group-id', state: 'Active' }] }
            ],
            fetchM365SubscribedSkus: async () => [{ skuId, consumedUnits: 7, prepaidUnits: { enabled: 10 } }]
        }, './zoho.service': {}
    });
    const details = await api.licenseDetails(1);
    assert.equal(details.assignedSeats, 7);
    assert.equal(details.availableSeats, 3);
    assert.equal(details.members[0].removable, true);
    assert.equal(details.members[1].removable, false);
    assert.equal(reconciled, true);
});

test('an incomplete Microsoft roster never clears cached assignments', async () => {
    let touched = false;
    const api = load('src/services/licenseManagement.service.ts', {
        axios: {}, '../db': { prisma: { license: { findUnique: async () => cloudLicense }, user: { findMany: async () => [] }, $transaction: async () => { touched = true; } } },
        '../utils/email': { getGraphAppToken: async () => ({ token: 'test' }) }, '../utils/userIdentity': {}, '../utils/licensePolicy': policy,
        './m365.service': { fetchAllM365Users: async () => [{ id: azureId }], fetchM365SubscribedSkus: async () => [{ skuId }] }, './zoho.service': {}
    });
    await assert.rejects(api.licenseDetails(1), /incomplete assignment snapshot/);
    assert.equal(touched, false);
});

test('Zoho reads subsequent pages and recognizes the documented Employee Status field', async () => {
    const oldEnv = [process.env.ZOHO_CLIENT_ID, process.env.ZOHO_CLIENT_SECRET, process.env.ZOHO_REFRESH_TOKEN];
    process.env.ZOHO_CLIENT_ID = 'test-id'; process.env.ZOHO_CLIENT_SECRET = 'test-secret'; process.env.ZOHO_REFRESH_TOKEN = 'test-refresh';
    const indices = [];
    try {
        const api = load('src/services/zoho.service.ts', {
            axios: { post: async () => ({ data: { access_token: 'test-token', expires_in: 3600 } }), get: async (_url, options) => {
                indices.push(options.params.sIndex);
                return { data: options.params.sIndex === 1 ? Array.from({ length: 200 }, (_, i) => ({ 'Email address': `employee${i}@example.invalid`, 'Employee Status': 'Active' }))
                    : [{ 'Email address': 'departed@example.invalid', 'Employee Status': 'Resigned' }] };
            } }, '../db': { prisma: {} }, '../utils/userIdentity': {}, './m365.service': {}
        });
        const employees = await api.fetchZohoEmployees();
        assert.equal(employees.length, 201);
        assert.equal(employees[200].status, 'Resigned');
        assert.deepEqual(indices, [1, 201]);
    } finally {
        ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN'].forEach((key, i) => { if (oldEnv[i] === undefined) delete process.env[key]; else process.env[key] = oldEnv[i]; });
    }
});

test('cloud roster reconciliation locks the subscription first and deduplicates user links', async () => {
    const actions = [];
    const db = {
        license: { update: async input => actions.push(['lock', input.data.seats]) },
        licenseAssignment: { deleteMany: async () => actions.push(['clear']), createMany: async input => actions.push(['create', input.data]) },
        $transaction: async callback => callback(db)
    };
    const { reconcileM365Assignments } = load('src/services/licenseCache.service.ts', { '../db': { prisma: db } });
    await reconcileM365Assignments(1, [2, 2, 3], 0);
    assert.deepEqual(actions, [['lock', 0], ['clear'], ['create', [{ licenseId: 1, userId: 2 }, { licenseId: 1, userId: 3 }]]]);
});

test('an incomplete per-user response cannot falsely confirm license removal', async () => {
    const s = service({ user: { assignedLicenses: [{ skuId }], licenseAssignmentStates: [{ skuId, assignedByGroup: null }] }, after: { assignedLicenses: undefined } });
    await assert.rejects(s.changeM365License(1, 'remove', { azureAdId: azureId }), /complete license record/);
    assert.equal(s.updates.length, 0);
});
