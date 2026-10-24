const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'index.css'), 'utf8');
const approved = new Set(['#b27f0d', '#172025', '#404131', '#d7d0bc', '#aab2b2']);

test('first-party UI colors stay within the approved five-color palette', () => {
    const failures = [];
    function walk(dir) {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'dist', 'tests'].includes(item.name)) continue;
            const file = path.join(dir, item.name);
            if (item.isDirectory()) walk(file);
            else if (/\.(tsx?|css)$/.test(file)) {
                const source = fs.readFileSync(file, 'utf8');
                for (const match of source.matchAll(/(?<![\w&])#(?:[a-f\d]{8}|[a-f\d]{6}|[a-f\d]{4}|[a-f\d]{3})\b/gi)) {
                    if (!approved.has(match[0].toLowerCase())) failures.push(`${file}: ${match[0]}`);
                }
                for (const match of source.matchAll(/(?:bg|text|border|from|via|to|ring)-(?:brand|slate|gray|red|green|blue|amber|orange|emerald|indigo|sky|yellow|pink|purple|white|black)[\w/-]*/g)) {
                    failures.push(`${file}: ${match[0]}`);
                }
            }
        }
    }
    walk(root);
    assert.deepEqual(failures, []);
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
    assert.ok(contrast('#172025', '#b27f0d') >= 4.5);
    assert.ok(contrast('#d7d0bc', '#172025') >= 4.5);
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
    const localRequire = name => {
        if (name.endsWith('/useAppContext')) return { useAppContext: () => context };
        if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { name: 'UI Reviewer', role: 'Admin' }, logout() {} }) };
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
