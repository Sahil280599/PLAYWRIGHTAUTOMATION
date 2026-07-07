import { findTests, summarizeTestStatus } from './testResults.js';

const BUSINESS_LABELS = {
    login: 'User authentication and login flow',
    dashboard: 'Dashboard access after login',
    'pre-trade': 'Pre-trade disclosure compliance validation',
    disclosure: 'Regulatory disclosure content verification',
    pdf: 'PDF document accuracy checks',
    excel: 'Excel ground truth data validation',
};

function toBusinessLanguage(title) {
    const lower = title.toLowerCase();
    for (const [keyword, label] of Object.entries(BUSINESS_LABELS)) {
        if (lower.includes(keyword)) {
            return label;
        }
    }
    return title;
}

function collectAllTests(results) {
    return findTests(results, '');
}

export function summarizeSuite(results) {
    const tests = collectAllTests(results);
    const bySuite = {};

    for (const { title, test } of tests) {
        const parts = title.split(' > ');
        const suiteName = parts.length > 1 ? parts.slice(0, -1).join(' > ') : 'General';
        const testName = parts[parts.length - 1];
        const status = summarizeTestStatus(test);

        if (!bySuite[suiteName]) {
            bySuite[suiteName] = { passed: 0, failed: 0, skipped: 0, flaky: 0, tests: [] };
        }

        bySuite[suiteName][status.status === 'passed' ? 'passed' :
            status.status === 'skipped' ? 'skipped' : 'failed']++;

        if (status.retries > 0 && status.status === 'passed') {
            bySuite[suiteName].flaky++;
        }

        bySuite[suiteName].tests.push({
            name: testName,
            status: status.status,
            businessMeaning: toBusinessLanguage(testName),
            durationMs: status.duration,
            retries: status.retries,
        });
    }

    const totalPassed = tests.filter((t) => summarizeTestStatus(t.test).status === 'passed').length;
    const totalFailed = tests.filter((t) => summarizeTestStatus(t.test).status === 'failed').length;
    const totalSkipped = tests.filter((t) => summarizeTestStatus(t.test).status === 'skipped').length;

    const lines = [
        '# Test Run Summary (Living Documentation)',
        '',
        `**Overall:** ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`,
        '',
    ];

    for (const [suiteName, data] of Object.entries(bySuite)) {
        lines.push(`## ${suiteName}`);
        lines.push(`_${data.passed} passed, ${data.failed} failed${data.flaky ? `, ${data.flaky} flaky (passed after retry)` : ''}_`);
        lines.push('');

        for (const t of data.tests) {
            const icon = t.status === 'passed' ? '✅' : t.status === 'skipped' ? '⏭️' : '❌';
            const flakyNote = t.retries > 0 ? ' _(flaky — passed after retry)_' : '';
            lines.push(`${icon} **${t.name}**${flakyNote}`);
            lines.push(`   - Validated: ${t.businessMeaning}`);
            lines.push(`   - Duration: ${t.durationMs}ms`);
        }
        lines.push('');
    }

    lines.push('---');
    lines.push('*This summary is auto-generated from Playwright test results for stakeholder review.*');

    return {
        markdown: lines.join('\n'),
        stats: { totalPassed, totalFailed, totalSkipped, suites: Object.keys(bySuite).length },
        bySuite,
    };
}
