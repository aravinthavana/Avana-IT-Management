const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const express = require('express');
const ExcelJS = require('exceljs');
function load(file, stubs = {}) {
    const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const local = createRequire(filename);
    new Function('require', 'module', 'exports', source)(name => Object.hasOwn(stubs, name) ? stubs[name] : local(name), module, module.exports);
    return module.exports;
}
const policy = load('src/utils/supportWork.ts');
const report = load('src/services/supportWorkReport.service.ts', { '../utils/supportWork': policy });
const importing = load('src/services/supportWorkImport.service.ts', { '../utils/supportWork': policy });
const entry = (extra = {}) => ({ clientRequestId: crypto.randomUUID(), workDate: '2026-10-16', subject: 'Battery replacement', contactName: 'Employee / vendor',
    channel: 'Phone', workDone: 'Replaced the battery and checked it.', statusAfter: 'Completed', ...extra });

function database() {
    let state = { cases: [], activities: [], attachments: [] };
    const users = [{ id: 1, role: 'Admin', status: 'Active', name: 'IT One', email: 'it@example.invalid' }, { id: 2, role: 'Admin', status: 'Active', name: 'IT Two' }, { id: 3, role: 'User', status: 'Active', name: 'Employee', email: 'employee@example.invalid' }];
    const decorate = row => row && ({ ...row, performedBy: users.find(u => u.id === row.performedById), recordedBy: users.find(u => u.id === row.recordedById) });
    const match = (row, where) => Object.entries(where || {}).every(([key, value]) => typeof value === 'object' && value !== null ?
        (value.in ? value.in.includes(row[key]) : (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte)) : row[key] === value);
    const models = target => ({
        user: { findUnique: async ({ where }) => users.find(u => u.id === where.id) }, asset: { findUnique: async () => null },
        supportWorkCase: {
            findUnique: async ({ where, include }) => { const row = target.cases.find(c => match(c, where)); return row && { ...row, ...(include?.activities ? { activities: target.activities.filter(a => a.caseId === row.id).map(decorate) } : {}) }; },
            findMany: async () => target.cases,
            create: async ({ data }) => { const row = { id: target.cases.length + 1, revision: 0, ...data }; target.cases.push(row); return row; },
            updateMany: async ({ where, data }) => { const row = target.cases.find(c => match(c, where)); if (!row) return { count: 0 }; Object.assign(row, { ...data, revision: row.revision + (data.revision?.increment || 0) }); return { count: 1 }; }
        },
        supportWorkActivity: {
            findUnique: async ({ where }) => target.activities.find(a => match(a, where)),
            findFirst: async ({ where }) => target.activities.filter(a => match(a, where)).sort((a, b) => b.workDate - a.workDate || b.id - a.id)[0],
            findMany: async ({ where }) => target.activities.filter(a => match(a, where)).map(decorate),
            create: async ({ data }) => { const row = { id: target.activities.length + 1, createdAt: new Date(), notificationStatus: 'Not requested', ...data }; target.activities.push(row); return decorate(row); },
            update: async ({ where, data }) => { const row = target.activities.find(a => match(a, where)); Object.assign(row, data); return decorate(row); }
        },
        supportWorkAttachment: { create: async ({ data }) => { const row = { id: crypto.randomUUID(), ...data }; target.attachments.push(row); return row; }, findUnique: async ({ where }) => target.attachments.find(row => row.id === where.id) }
    });
    return new Proxy({}, { get(_target, key) {
        if (key === 'state') return () => state;
        if (key === '$transaction') return async callback => { const snapshot = structuredClone(state); const result = await callback(models(snapshot)); state = snapshot; return result; };
        return models(state)[key];
    } });
}
async function api(t, { role = 'Admin', mailResult = true } = {}) {
    const db = database(), sent = [];
    const guard = load('src/middleware/auth.ts', { '../db': { prisma: {} } }).requireAdmin;
    const router = load('src/routes/supportWork.routes.ts', {
        '../db': { prisma: db }, '../middleware/auth': { authenticateToken: (req, _res, next) => { req.user = { id: 1, role }; next(); }, requireAdmin: guard },
        '../utils/supportWork': policy, '../services/supportWorkReport.service': report, '../services/supportWorkImport.service': importing,
        '../services/supportWorkEmail.service': { sendSupportWorkSummary: async (...values) => { sent.push(values); return mailResult; } }
    }).default;
    const app = express(); app.use(express.json()); app.use(router);
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const request = async (method, url, body) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/support-work${url}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { code: response.status, body: await response.json(), headers: response.headers };
    };
    return { request, db, sent };
}

test('private work logs reject employees and managers on reads, writes, exports and attachments', async t => {
    for (const role of ['User', 'Manager']) {
        const { request } = await api(t, { role });
        for (const [method, url, body] of [['GET', ''], ['GET', '/activities?start=2026-10-09&end=2026-10-16'], ['GET', '/report.xlsx'], ['GET', '/cases/1'], ['GET', '/attachments/private'], ['POST', '/activities', entry()], ['POST', '/import', {}], ['POST', '/import/preview', {}], ['POST', '/attachments', {}]]) {
            assert.equal((await request(method, url, body)).code, 403, `${role} ${url}`);
        }
    }
});
test('completed phone work saves once, without a portal employee, case or email', async t => {
    const { request, db, sent } = await api(t);
    const payload = entry();
    const first = await request('POST', '/activities', payload);
    assert.equal(first.code, 201); assert.equal(first.body.activity.statusAfter, 'Completed');
    assert.equal(first.body.activity.recordedById, 1); assert.equal(db.state().cases.length, 0); assert.equal(sent.length, 0);
    assert.equal((await request('POST', '/activities', payload)).body.duplicate, true);
    assert.equal(db.state().activities.length, 1);
});
test('ongoing cases require a next action, waiting reason and follow-up date', () => {
    for (const extra of [{ statusAfter: 'Open' }, { createCase: true, statusAfter: 'Open' }, { createCase: true, statusAfter: 'Waiting', nextAction: 'Call vendor', followUpDate: '2026-10-17' }, { createCase: true, statusAfter: 'Waiting', waitingReason: 'Vendor', nextAction: 'Call vendor', followUpDate: '2026-10-15' }]) assert.equal(policy.workInput.safeParse(entry(extra)).success, false);
    assert.equal(policy.workInput.safeParse(entry({ createCase: true, statusAfter: 'Waiting', waitingReason: 'Vendor', nextAction: 'Call vendor', followUpDate: '2026-10-17' })).success, true);
    assert.equal(policy.workInput.safeParse(entry({ followUpDate: '2026-10-01' })).success, true, 'hidden old follow-up does not block completion');
});
test('case updates keep earlier outcomes, detect stale writes and preserve current state when backdated', async t => {
    const { request, db } = await api(t);
    const created = await request('POST', '/activities', entry({ createCase: true, statusAfter: 'Waiting', waitingReason: 'Vendor', nextAction: 'Check delivery', followUpDate: '2026-10-17' }));
    const id = created.body.activity.caseId;
    assert.equal((await request('POST', '/activities', entry({ caseId: id, caseRevision: 0 }))).code, 201);
    assert.equal(db.state().cases[0].status, 'Completed'); assert.equal(db.state().cases[0].followUpDate, null);
    assert.equal(db.state().activities[0].statusAfter, 'Waiting');
    const stale = await request('POST', '/activities', entry({ caseId: id, caseRevision: 0 }));
    assert.equal(stale.code, 409); assert.equal(db.state().activities.length, 2);
    const earlier = await request('POST', '/activities', entry({ caseId: id, caseRevision: 1, workDate: '2026-10-10', statusAfter: 'Open', nextAction: 'Get quote', followUpDate: '2026-10-11' }));
    assert.equal(earlier.code, 201); assert.equal(db.state().cases[0].status, 'Completed');
});
test('performer and recorder are separate, and non-IT assignees are rejected atomically', async t => {
    const { request, db } = await api(t);
    const saved = await request('POST', '/activities', entry({ performedById: 2, affectedUserId: 3 }));
    assert.equal(saved.body.activity.performedById, 2); assert.equal(saved.body.activity.affectedUserId, 3); assert.equal(saved.body.activity.recordedById, 1);
    assert.equal((await request('POST', '/activities', entry({ affectedUserId: 999 }))).code, 400);
    const invalid = await request('POST', '/activities', entry({ createCase: true, assignedToId: 3 }));
    assert.equal(invalid.code, 400); assert.equal(db.state().cases.length, 0); assert.equal(db.state().activities.length, 1);
});
test('email is explicit, server-addressed, and a mail failure still returns the saved entry', async t => {
    const { request, db, sent } = await api(t, { mailResult: false });
    const result = await request('POST', '/activities', entry({ contactUserId: 3, notifyEmployee: true }));
    assert.equal(result.code, 201); assert.equal(result.body.activity.notificationStatus, 'Failed');
    assert.equal(db.state().activities.length, 1); assert.equal(sent[0][0], 'employee@example.invalid');
    assert.equal(policy.workInput.safeParse(entry({ notifyEmployee: true })).success, false);
});
test('weekly queries use inclusive work dates and the performer, not creation date or recorder', async t => {
    const { request } = await api(t);
    for (const [workDate, performedById] of [['2026-10-08', 1], ['2026-10-09', 1], ['2026-10-16', 1], ['2026-10-17', 1], ['2026-10-16', 2]]) await request('POST', '/activities', entry({ workDate, performedById }));
    const result = await request('GET', '/activities?start=2026-10-09&end=2026-10-16&technicianId=1');
    assert.equal(result.body.activities.length, 2); assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal((await request('GET', '/activities?start=2026-10-16&end=2026-10-09')).code, 400);
    assert.equal(policy.dateOnly.safeParse('2026-02-30').success, false);
});
test('Excel export preserves all six columns, typed dates, literal text and original imported statuses', async () => {
    const buffer = await report.buildWorkReport([{ workDate: new Date('2026-10-16T00:00:00Z'), contactName: '=1+1', subject: 'Battery', workDone: '+SUM(A1:A2)', statusAfter: 'Waiting', waitingReason: 'Verification', originalStatus: 'Payment Done - Awaiting Confirmation' }]);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Work Report');
    assert.deepEqual(sheet.getRow(1).values.slice(1), ['Sl. No', 'Date', 'User/Department', 'Issue', 'Description', 'Status']);
    assert.equal(sheet.getCell('C2').value, '=1+1'); assert.equal(sheet.getCell('E2').value, '+SUM(A1:A2)');
    assert.ok(sheet.getCell('B2').value instanceof Date); assert.equal(sheet.getCell('F2').value, 'Payment Done - Awaiting Confirmation');
    assert.equal((await importing.previewWorkImport(buffer)).rows.length, 1);
});
test('import preview reads source dates and statuses, rejects invalid files and does not execute formulas', async () => {
    const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Work Report');
    sheet.addRow(['Sl. No', 'Date', 'User/Department', 'Issue', 'Description', 'Status']);
    sheet.addRow([1, '05-10-2026', 'Vendor', 'Toner', 'Asked for approval', 'Awaiting Approval']);
    sheet.addRow([2, '16-10-2026', 'IT', 'Website', { formula: '1+1', result: 'Cached work note' }, 'Completed']);
    const data = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await importing.previewWorkImport(data);
    assert.equal(preview.start, '2026-10-05'); assert.equal(preview.end, '2026-10-16');
    assert.equal(preview.rows[0].waitingReason, 'Approval'); assert.equal(preview.rows[1].workDone, 'Cached work note');
    assert.deepEqual(preview.errors, []); assert.equal(preview.rows[0].importKey, (await importing.previewWorkImport(data)).rows[0].importKey);
    await assert.rejects(importing.previewWorkImport(Buffer.from('not xlsx')), /Invalid XLSX/);
});
test('reviewed import groups a case through completion, preserves row statuses, skips duplicates and sends no email', async t => {
    const { request, db, sent } = await api(t);
    const row = { importKey: 'a'.repeat(64), row: 2, workDate: '2026-10-09', contactName: 'Vendor', subject: 'Battery', workDone: 'Quote shared', originalStatus: 'Awaiting Approval', statusAfter: 'Waiting', waitingReason: 'Approval', group: 'Battery' };
    const payload = { performedById: 1, followUpDate: '2026-10-24', nextAction: 'Review outstanding work', rows: [row, { ...row, importKey: 'b'.repeat(64), row: 3, workDate: '2026-10-16', workDone: 'Replacement checked', originalStatus: 'Resolved', statusAfter: 'Completed', waitingReason: null }] };
    const result = await request('POST', '/import', payload);
    assert.equal(result.code, 201); assert.equal(result.body.imported, 2); assert.equal(db.state().cases.length, 1);
    assert.equal(db.state().cases[0].status, 'Completed'); assert.equal(db.state().activities[0].originalStatus, 'Awaiting Approval');
    assert.equal(db.state().activities[0].caseId, db.state().activities[1].caseId); assert.equal(sent.length, 0);
    assert.equal((await request('POST', '/import', payload)).body.skipped, 2); assert.equal(db.state().activities.length, 2);
});
test('invalid import rolls back earlier rows and does not invent cases for ungrouped ongoing work', async t => {
    const { request, db } = await api(t);
    const row = { importKey: 'c'.repeat(64), row: 2, workDate: '2026-10-09', contactName: 'IT', subject: 'Task', workDone: 'Worked', originalStatus: 'Completed', statusAfter: 'Completed', waitingReason: null, group: '' };
    const result = await request('POST', '/import', { performedById: 1, followUpDate: '2026-10-24', nextAction: 'Review', rows: [row, { ...row, importKey: 'd'.repeat(64), row: 3, statusAfter: 'Open' }] });
    assert.equal(result.code, 400); assert.equal(db.state().activities.length, 0); assert.equal(db.state().cases.length, 0);
});
