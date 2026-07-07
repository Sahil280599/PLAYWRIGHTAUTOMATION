import fs from 'fs';
import path from 'path';

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
}

export default class BugReportReporter {
    onBegin(config) {
        this.outputDir = path.join(config.rootDir || process.cwd(), 'bug-reports');
        fs.mkdirSync(this.outputDir, { recursive: true });
    }

    onTestEnd(test, result) {
        if (result.status === 'passed' || result.status === 'skipped') {
            return;
        }

        const failureContext = result.attachments?.find((a) => a.name === 'failure-meta')?.path;
        const failureContextDir = failureContext
            ? path.dirname(failureContext)
            : null;

        const report = {
            title: `[AUTO] ${test.title}`,
            suite: test.parent?.title,
            file: test.location?.file,
            line: test.location?.line,
            environment: {
                project: test.parent?.project()?.name,
                baseURL: test.parent?.project()?.use?.baseURL,
                ci: !!process.env.CI,
            },
            stepsToReproduce: result.steps?.map((step) => step.title) ?? [],
            expected: 'All assertions pass',
            actual: result.error?.message ?? `Test ${result.status}`,
            attachments: result.attachments?.map((a) => ({
                name: a.name,
                path: a.path,
                contentType: a.contentType,
            })) ?? [],
            failureContextDir,
            duration: result.duration,
            retry: result.retry,
            timestamp: new Date().toISOString(),
        };

        const file = path.join(this.outputDir, `${slugify(test.title)}-${Date.now()}.json`);
        fs.writeFileSync(file, JSON.stringify(report, null, 2));
    }
}
