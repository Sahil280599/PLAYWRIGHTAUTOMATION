import { test as base } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        const consoleLogs = [];
        const networkLogs = [];

        page.on('console', (msg) => {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        });

        page.on('requestfailed', (request) => {
            networkLogs.push({
                type: 'requestfailed',
                url: request.url(),
                method: request.method(),
                failure: request.failure()?.errorText,
            });
        });

        page.on('response', (response) => {
            if (response.status() >= 400) {
                networkLogs.push({
                    type: 'http_error',
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                });
            }
        });

        await use(page);

        if (testInfo.status !== testInfo.expectedStatus) {
            const dir = path.join(testInfo.outputDir, 'failure-context');
            fs.mkdirSync(dir, { recursive: true });

            const html = await page.content();
            let a11y = null;
            try {
                a11y = await page.accessibility.snapshot();
            } catch {
                a11y = { error: 'Could not capture accessibility snapshot' };
            }

            const screenshotPath = path.join(dir, 'failure.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            fs.writeFileSync(path.join(dir, 'dom.html'), html);
            fs.writeFileSync(path.join(dir, 'a11y.json'), JSON.stringify(a11y, null, 2));
            fs.writeFileSync(path.join(dir, 'console.json'), JSON.stringify(consoleLogs, null, 2));
            fs.writeFileSync(path.join(dir, 'network.json'), JSON.stringify(networkLogs, null, 2));

            const meta = {
                failureContextDir: dir,
                url: page.url(),
                timestamp: new Date().toISOString(),
            };
            fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

            const attachments = [
                ['failure-dom', path.join(dir, 'dom.html'), 'text/html'],
                ['failure-a11y', path.join(dir, 'a11y.json'), 'application/json'],
                ['failure-console', path.join(dir, 'console.json'), 'application/json'],
                ['failure-network', path.join(dir, 'network.json'), 'application/json'],
                ['failure-screenshot', screenshotPath, 'image/png'],
                ['failure-meta', path.join(dir, 'meta.json'), 'application/json'],
            ];

            for (const [name, filePath, contentType] of attachments) {
                await testInfo.attach(name, { path: filePath, contentType });
            }
        }
    },
});

export { expect } from '@playwright/test';
