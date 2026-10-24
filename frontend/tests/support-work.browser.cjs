// Optional local browser smoke check. Uses synthetic data, no live app or cloud APIs.
// PLAYWRIGHT_MODULE may point to the bundled Playwright module; CHROME_PATH can select a local browser.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React from 'react'; import { createRoot } from 'react-dom/client';
import WorkLog from './components/tickets/SupportWorkLog';
window.requests=[]; window.notes=[]; window.caseRows=[]; window.activityRows=[];
window.fetch=async(url,options={})=>{
 const route=new URL(url,'http://fixture.local').pathname;
 let value;
 if(options.method==='POST'&&route==='/api/support-work/activities'){
  const data=JSON.parse(options.body); window.requests.push(data); let linked;
  if(['Completed','Cancelled'].includes(data.statusAfter)){data.followUpDate=null;data.nextAction=null;data.waitingReason=null;}
  if(data.createCase){linked={id:window.caseRows.length+1,revision:0,subject:data.subject,contactName:data.contactName,assignedToId:data.assignedToId,assignedTo:{id:1,name:'IT Operator'},activities:[]}; window.caseRows.push(linked);}
  if(data.caseId){linked=window.caseRows.find(c=>c.id===data.caseId); linked.revision++;}
  const activity={...data,id:window.activityRows.length+1,caseId:linked?.id,createdAt:new Date().toISOString(),performedBy:{id:1,name:'IT Operator'},recordedBy:{id:1,name:'IT Operator'},notificationStatus:'Not requested',attachments:'[]'};
  if(linked){Object.assign(linked,{status:data.statusAfter,waitingReason:data.waitingReason,nextAction:data.nextAction,followUpDate:data.followUpDate}); linked.activities.push(activity); linked._count={activities:linked.activities.length};}
  window.activityRows.push(activity); value={activity};
 }else if(route==='/api/support-work') value={cases:window.caseRows};
 else if(route==='/api/support-work/activities') value={activities:[...window.activityRows].reverse()};
 else if(route.startsWith('/api/support-work/cases/')) value=window.caseRows.find(c=>c.id===Number(route.split('/').pop()));
 else throw new Error('Unexpected fixture request: '+route);
 return {ok:true,json:async()=>structuredClone(value)};
};
createRoot(document.getElementById('root')).render(<WorkLog/>);
`;
const context = `export const useAppContext=()=>window.fixtureContext;`;
const auth = `export const useAuth=()=>({user:{id:1,name:'IT Operator',role:'Admin'}});`;

(async () => {
    const output = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'fixture-context', setup(builder) {
        builder.onResolve({ filter: /useAppContext|AuthContext|apiClient/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('useAppContext') ? context : args.path.endsWith('AuthContext') ? auth : `export const API_URL='';`, loader: 'js' }));
    } }] });
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const outputDir = process.env.SUPPORT_QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'avana-support-qa-'));
        fs.mkdirSync(outputDir, { recursive: true });
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
        await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main id="root" style="padding:16px"></main></body></html>' }));
        await page.goto('http://localhost/fixture');
        const css = fs.readdirSync(path.join(root, 'dist/assets')).find(name => /^index-.*\.css$/.test(name));
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'dist/assets', css), 'utf8') });
        await page.evaluate(() => {
            window.fixtureContext = { users: [{ id: 1, name: 'IT Operator', role: 'Admin', status: 'Active' }], assets: [], getHeaders: () => ({ 'Content-Type': 'application/json' }), setNotification: value => window.notes.push(value) };
        });
        await page.addScriptTag({ content: output.outputFiles[0].text });
        await page.getByRole('button', { name: 'Log completed work', exact: true }).click();
        const form = page.getByRole('dialog');
        await form.getByLabel('User / department / contact').fill('Vendor');
        await form.getByLabel('Issue / task').fill('Outlook setup');
        await form.getByLabel('Work done / update').fill('Configured and tested Outlook after a phone call.');
        assert.equal(await form.getByRole('checkbox').isChecked(), false);
        await page.screenshot({ path: path.join(outputDir, 'mobile-entry.png'), fullPage: true });
        await form.getByRole('button', { name: 'Save & add another' }).click();
        await page.waitForFunction(() => window.requests.length === 1);
        assert.equal(await form.getByLabel('Issue / task').inputValue(), '');
        assert.deepEqual(await page.evaluate(() => ({ status: window.requests[0].statusAfter, createCase: window.requests[0].createCase, notify: window.requests[0].notifyEmployee })), { status: 'Completed', createCase: false, notify: false });
        await form.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByRole('button', { name: 'Log request / follow-up', exact: true }).click();
        await form.getByLabel('User / department / contact').fill('Printer vendor');
        await form.getByLabel('Issue / task').fill('Toner delivery');
        await form.getByLabel('Work done / update').fill('Called vendor to arrange toner delivery.');
        await form.getByLabel('Outcome', { exact: true }).selectOption('Waiting');
        await form.getByLabel('Waiting for').selectOption('Vendor');
        await form.getByLabel('Next action').fill('Confirm delivery');
        await form.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForFunction(() => window.requests.length === 2);
        await page.getByRole('button', { name: 'Follow-ups due', exact: true }).click();
        await page.getByRole('button', { name: /Toner delivery/ }).click();
        await page.getByRole('button', { name: 'Add work / follow-up update' }).click();
        await form.getByLabel('Work done / update').fill('Received and verified toner.');
        await form.getByLabel('Outcome', { exact: true }).selectOption('Completed');
        await form.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForFunction(() => window.requests.length === 3);
        assert.deepEqual(await page.evaluate(() => window.caseRows[0].activities.map(row => row.statusAfter)), ['Waiting', 'Completed']);
        await page.getByRole('button', { name: 'Work log', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile page overflows horizontally');
        await page.screenshot({ path: path.join(outputDir, 'mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(outputDir, 'desktop.png'), fullPage: true });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ completedQuickEntry: true, repeatEntry: true, linkedCaseCompletion: true, quietDefault: true, mobileOverflow: false, screenshots: outputDir }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
