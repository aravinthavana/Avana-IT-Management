const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'index.css'), 'utf8');
test('the original theme and status colors remain available after the color rollback', () => {
    assert.doesNotMatch(css, /--color-\*: initial/);
    assert.match(css, /--color-brand-600:\s*#936709/);
    assert.match(css, /--color-slate-50:\s*#faf9f6/);
    const login = fs.readFileSync(path.join(root, 'components/auth/Login.tsx'), 'utf8');
    assert.match(login, /#f35325/);
    assert.match(login, /#81bc06/);
    const assets = fs.readFileSync(path.join(root, 'components/assets/AssetManagement.tsx'), 'utf8');
    assert.match(assets, /bg-green-/);
    assert.match(assets, /bg-red-/);
});

function luminance(hex) {
    const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return values.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
    const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}
test('theme text and primary-button pairs meet 4.5:1 contrast', () => {
    const themeBlocks = [css.match(/:root\s*\{([^}]+)\}/)[1], css.match(/\.dark\s*\{([^}]+)\}/)[1]];
    for (const block of themeBlocks) {
        const values = Object.fromEntries([...block.matchAll(/--ui-([\w-]+):\s*(#[a-f\d]{6})/g)].map(match => [match[1], match[2]]));
        for (const foreground of ['ink', 'quiet']) {
            for (const background of ['canvas', 'surface', 'muted']) {
                assert.ok(contrast(values[foreground], values[background]) >= 4.5, `${foreground} on ${background}`);
            }
        }
    }
    const accent = css.match(/--color-accent:\s*(#[a-f\d]{6})/)[1];
    const onAccent = css.match(/--color-on-accent:\s*(#[a-f\d]{6})/)[1];
    assert.ok(contrast(onAccent, accent) >= 4.5);
});

function dialogHarness() {
    const listeners = new Set(), cleanups = [];
    let nextDialog;
    const document = {
        body: { style: { overflow: 'auto' } },
        activeElement: null,
        addEventListener: (_type, callback) => listeners.add(callback),
        removeEventListener: (_type, callback) => listeners.delete(callback)
    };
    const makeControl = (visible = true) => ({
        isConnected: true, getClientRects: () => visible ? [{}] : [], closest: () => null,
        focus() { document.activeElement = this; }
    });
    const trigger = makeControl();
    trigger.focus();
    const source = fs.readFileSync(path.join(root, 'hooks/useDialogAccessibility.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    new Function('require', 'exports', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', compiled)(
        () => ({ useRef: value => ({ current: value === null ? nextDialog : value }), useEffect: callback => cleanups.push(callback()) }),
        exports, document, callback => { callback(); return 1; }, () => {}
    );
    function open(onClose) {
        const first = makeControl(), hidden = makeControl(false), last = makeControl();
        nextDialog = { querySelectorAll: () => [first, hidden, last], querySelector: () => null, contains: item => [first, hidden, last].includes(item), focus() { document.activeElement = this; } };
        exports.useDialogAccessibility(true, onClose);
        return { first, last, close: cleanups.at(-1) };
    }
    function key(value, shiftKey = false) {
        const event = { key: value, shiftKey, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
        [...listeners].forEach(callback => callback(event));
        return event;
    }
    return { open, key, document, trigger, listeners };
}

test('dialogs trap Tab in both directions, ignore hidden controls and restore focus', () => {
    const h = dialogHarness();
    const dialog = h.open(() => {});
    assert.equal(h.document.activeElement, dialog.first);
    assert.equal(h.document.body.style.overflow, 'hidden');
    dialog.last.focus();
    assert.equal(h.key('Tab').prevented, true);
    assert.equal(h.document.activeElement, dialog.first);
    h.key('Tab', true);
    assert.equal(h.document.activeElement, dialog.last);
    dialog.close();
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.document.body.style.overflow, 'auto');
    assert.equal(h.listeners.size, 0);
});

test('Escape closes only the top dialog and nested scroll locks release in order', () => {
    const h = dialogHarness(), closed = [];
    const outer = h.open(() => closed.push('outer'));
    const inner = h.open(() => closed.push('inner'));
    h.key('Escape');
    assert.deepEqual(closed, ['inner']);
    inner.close();
    assert.equal(h.document.body.style.overflow, 'hidden');
    assert.equal(h.document.activeElement, outer.first);
    h.key('Escape');
    assert.deepEqual(closed, ['inner', 'outer']);
    outer.close();
    assert.equal(h.document.body.style.overflow, 'auto');
});

function loadComponent(file, context) {
    const filename = path.resolve(root, file);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true
    } }).outputText;
    const module = { exports: {} };
    let stateIndex = 0;
    const localRequire = name => {
        if (name.endsWith('/useAppContext')) return { useAppContext: () => context };
        if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { name: 'UI Reviewer', role: 'Admin' }, logout() {} }) };
        if (name.endsWith('/apiClient')) return { apiClient() { throw new Error('Unexpected HTTP request in markup test'); } };
        if (name.endsWith('/Modal') && context.inlineDialog) return { default: ({ title, children }) => React.createElement('section', { 'aria-label': title }, children), __esModule: true };
        if (name === 'react' && (context.initialProvider || context.initialMembers)) return {
            ...React,
            useState(value) {
                stateIndex++;
                const initial = filename.endsWith('LicenseManagement.tsx') && value === 'm365' ? context.initialProvider || value
                    : filename.endsWith('LicenseAssignmentModal.tsx') && stateIndex === 1 ? context.initialMembers || value : value;
                return React.useState(initial);
            }
        };
        if (!name.startsWith('.')) return require(name);
        const resolved = path.resolve(path.dirname(filename), name);
        const candidate = ['.tsx', '.ts'].map(extension => resolved + extension).find(fs.existsSync);
        return loadComponent(path.relative(root, candidate), context);
    };
    new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
    return module.exports;
}

test('every main view has a visible header title and closed menus stay out of keyboard navigation', () => {
    for (const view of ['dashboard', 'assets', 'users', 'onboarding', 'requests', 'audits', 'tickets', 'kb', 'licenses', 'departments', 'branches', 'purchases', 'profile']) {
        const { default: Header } = loadComponent('components/layout/Header.tsx', { view, theme: 'light' });
        const html = renderToStaticMarkup(React.createElement(Header, { isSidebarOpen: false, setSidebarOpen() {} }));
        assert.match(html, /<h1[^>]*>[^<]+<\/h1>/, view);
        assert.match(html, /id="theme-options" hidden=""/);
        assert.match(html, /id="account-options" hidden=""/);
        assert.match(html, /aria-label="Open navigation"/);
    }
});

test('mobile navigation exposes its state and filtered links without conditional hook calls', () => {
    const originalWindow = global.window;
    global.window = { matchMedia: () => ({ matches: true }) };
    try {
        const context = { view: 'assets', assetFilters: [], assetRequests: [], tickets: [] };
        const { default: Sidebar } = loadComponent('components/layout/Sidebar.tsx', context);
        const open = renderToStaticMarkup(React.createElement(Sidebar, { isSidebarOpen: true, setSidebarOpen() {} }));
        assert.match(open, /role="dialog" aria-modal="true" aria-label="Main navigation"/);
        assert.match(open, /aria-current="page"/);
        assert.match(open, /aria-label="Close sidebar"/);
        const closed = renderToStaticMarkup(React.createElement(Sidebar, { isSidebarOpen: false, setSidebarOpen() {} }));
        assert.match(closed, /-translate-x-full invisible/);
        assert.doesNotMatch(closed, /aria-modal="true"/);
    } finally { global.window = originalWindow; }
});

test('signature coordinates follow the finger when the canvas is scaled on a phone', () => {
    const { getCanvasPoint } = loadComponent('components/handovers/SignatureCanvas.tsx', {});
    const canvas = { width: 400, height: 200, getBoundingClientRect: () => ({ left: 20, top: 40, width: 200, height: 100 }) };
    assert.deepEqual(getCanvasPoint(canvas, 120, 90), { x: 200, y: 100 });
    assert.deepEqual(getCanvasPoint(canvas, 220, 140), { x: 400, y: 200 });
    assert.deepEqual(getCanvasPoint(canvas, -10, -10), { x: 0, y: 0 });
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    assert.equal(getCanvasPoint(canvas, 1, 1), null);
});

const licenseFixtures = [
    { id: 1, name: 'Microsoft 365 Business Standard', category: 'Cloud', isM365: true, skuId: 'sku-1', seats: 10, assignments: [], status: 'Active' },
    { id: 2, name: 'Zoho People Plus', key: 'ZOHO-PEOPLE-PLUS', category: 'HR', seats: 123, assignments: [], status: 'Active' },
    { id: 3, name: 'Design software', category: 'Software', seats: 5, assignments: [], status: 'Active' }
];

test('license page separates provider actions and hides cloud edit, seat-purchase and delete controls', () => {
    for (const provider of ['m365', 'zoho', 'manual']) {
        const context = { licenses: licenseFixtures, initialProvider: provider };
        const { default: Page } = loadComponent('components/licenses/LicenseManagement.tsx', context);
        const html = renderToStaticMarkup(React.createElement(Page));
        if (provider === 'manual') {
            assert.match(html, /Add software/);
            assert.match(html, /Manage assignments/);
            assert.match(html, /Edit details/);
        } else {
            assert.doesNotMatch(html, />Edit details<|>Delete<|>Add purchased seats<|>\+ Add software</);
            assert.match(html, provider === 'zoho' ? /View users/ : /Manage Microsoft 365 users/);
        }
    }
});

test('Zoho user panel has search and source membership without assignment/removal controls', () => {
    const context = { licenses: licenseFixtures, users: [], assets: [], inlineDialog: true,
        initialMembers: { provider: 'zoho', mode: 'live', eligibleUsers: [], members: [{ id: 'z1', displayName: 'Zoho Employee', email: 'employee@example.invalid', removable: true, assignmentSource: 'Zoho People' }] } };
    const { default: Panel } = loadComponent('components/licenses/LicenseAssignmentModal.tsx', context);
    const html = renderToStaticMarkup(React.createElement(Panel, { isOpen: true, onClose() {}, license: licenseFixtures[1] }));
    assert.match(html, /Search assigned users/);
    assert.match(html, /Zoho Employee/);
    assert.doesNotMatch(html, /Review assignment|Remove assignment|Remove license|Assign in Microsoft/);
});

test('Microsoft user panel offers removal only for direct assignments', () => {
    const context = { licenses: licenseFixtures, users: [], assets: [], inlineDialog: true,
        initialMembers: { provider: 'm365', mode: 'live', seats: 10, assignedSeats: 2, availableSeats: 8, eligibleUsers: [], members: [
            { id: 'direct', displayName: 'Direct Employee', assignmentSource: 'Direct', removable: true },
            { id: 'group', displayName: 'Group Employee', assignmentSource: 'Group managed', removable: false, note: 'Change membership in Entra.' }
        ] } };
    const { default: Panel } = loadComponent('components/licenses/LicenseAssignmentModal.tsx', context);
    const html = renderToStaticMarkup(React.createElement(Panel, { isOpen: true, onClose() {}, license: licenseFixtures[0] }));
    assert.equal((html.match(/>Remove license<\/button>/g) || []).length, 1);
    assert.match(html, /Group managed/);
    assert.match(html, /Change membership in Entra/);
});

test('pending informational notices are not labeled as successful operations', () => {
    const { default: Notification } = loadComponent('components/ui/Notification.tsx', {});
    const html = renderToStaticMarkup(React.createElement(Notification, { notification: { type: 'info', message: 'Microsoft confirmation pending.' }, onClear() {} }));
    assert.match(html, /Information/);
    assert.doesNotMatch(html, /Success/);
    assert.match(html, /role="status"/);
});
