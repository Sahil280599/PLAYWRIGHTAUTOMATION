import fs from 'fs';
import path from 'path';
import * as z from 'zod';
import { PATHS, PROJECT_ROOT } from './lib/paths.js';
import { buildHealReport } from './lib/heal.js';
import { formatJiraBugReport, loadLatestBugReport } from './lib/jira.js';
import { summarizeSuite } from './lib/summarize.js';
import {
    computeVariance,
    findTestByTitle,
    groupErrors,
    loadJsonResults,
    summarizeTestStatus,
} from './lib/testResults.js';

export function registerTools(server) {
    server.registerTool(
        'get_test_results',
        {
            description: 'Read Playwright JSON test results from the last run',
            inputSchema: z.object({
                resultsPath: z.string().optional().describe('Path to test-results.json (defaults to project root)'),
            }),
        },
        async ({ resultsPath }) => {
            const filePath = resultsPath
                ? path.resolve(PROJECT_ROOT, resultsPath)
                : PATHS.testResults;

            if (!fs.existsSync(filePath)) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'No test results found. Run: npm run test:ci',
                            expectedPath: filePath,
                        }, null, 2),
                    }],
                };
            }

            return { content: [{ type: 'text', text: fs.readFileSync(filePath, 'utf-8') }] };
        }
    );

    server.registerTool(
        'list_page_objects',
        {
            description: 'List all Page Object Model files and their contents',
            inputSchema: z.object({
                includeContent: z.boolean().optional().describe('Include file contents (default true)'),
            }),
        },
        async ({ includeContent = true }) => {
            if (!fs.existsSync(PATHS.pagesDir)) {
                return { content: [{ type: 'text', text: '[]' }] };
            }

            const files = fs.readdirSync(PATHS.pagesDir).filter((f) => f.endsWith('.js'));
            const result = files.map((file) => {
                const filePath = path.join(PATHS.pagesDir, file);
                return {
                    file,
                    path: `Pages/${file}`,
                    content: includeContent ? fs.readFileSync(filePath, 'utf-8') : undefined,
                };
            });

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );

    server.registerTool(
        'heal_locator',
        {
            description: 'Suggest healed locators from failure context (DOM, a11y tree, network logs)',
            inputSchema: z.object({
                brokenSelector: z.string().describe('The locator that failed, e.g. //button[normalize-space()=\'Login\']'),
                failureContextDir: z.string().describe('Path to failure-context folder from test output'),
                pageObjectFile: z.string().optional().describe('Page object file to patch, e.g. Pages/loginPage.js'),
            }),
        },
        async ({ brokenSelector, failureContextDir, pageObjectFile }) => {
            const resolvedDir = path.isAbsolute(failureContextDir)
                ? failureContextDir
                : path.resolve(PROJECT_ROOT, failureContextDir);

            let pomContent = null;
            if (pageObjectFile) {
                const pomPath = path.resolve(PROJECT_ROOT, pageObjectFile);
                if (fs.existsSync(pomPath)) {
                    pomContent = fs.readFileSync(pomPath, 'utf-8');
                }
            }

            const report = buildHealReport({
                brokenSelector,
                failureContextDir: resolvedDir,
                pageObjectFile,
                fs,
                path,
            });

            if (pomContent) {
                report.pageObjectSnippet = pomContent;
            }

            return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
        }
    );

    server.registerTool(
        'generate_test',
        {
            description: 'Gather context to generate a new Playwright test following project conventions',
            inputSchema: z.object({
                userStory: z.string().describe('What the test should validate'),
                targetUrl: z.string().describe('URL or path to test against'),
                useExistingPOM: z.string().optional().describe('Page object to reuse, e.g. loginPage'),
                outputFile: z.string().optional().describe('Suggested spec path, e.g. tests/e2e/myFeature.spec.js'),
            }),
        },
        async ({ userStory, targetUrl, useExistingPOM, outputFile }) => {
            const exampleSpecPath = path.join(PATHS.testsDir, 'e2e/logintest.spec.js');
            const exampleSpec = fs.existsSync(exampleSpecPath)
                ? fs.readFileSync(exampleSpecPath, 'utf-8')
                : '';

            let pomCode = '';
            if (useExistingPOM) {
                const pomFile = useExistingPOM.endsWith('.js') ? useExistingPOM : `${useExistingPOM}.js`;
                const pomPath = path.join(PATHS.pagesDir, pomFile);
                if (fs.existsSync(pomPath)) {
                    pomCode = fs.readFileSync(pomPath, 'utf-8');
                }
            }

            const authFixturePath = path.join(PROJECT_ROOT, 'fixtures/auth.fixture.js');
            const authFixture = fs.existsSync(authFixturePath)
                ? fs.readFileSync(authFixturePath, 'utf-8')
                : '';

            const context = {
                instruction: 'Generate a complete Playwright spec file matching project style. Write the file to the suggested output path.',
                userStory,
                targetUrl,
                suggestedOutput: outputFile ?? `tests/e2e/${userStory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.spec.js`,
                conventions: [
                    'Import { test, expect } from fixtures/healing.fixture.js (or auth.fixture.js if login needed)',
                    'Use Page Object Model from Pages/',
                    'No try-catch blocks in tests',
                    'No waitForTimeout — use waitForSelector, waitForLoadState, or expect().toBeVisible()',
                    'No console.log in test files',
                    'Use getByRole / getByPlaceholder over XPath',
                ],
                styleReference: exampleSpec,
                authFixtureReference: authFixture,
                pageObject: pomCode || undefined,
                baseURL: 'https://opensource-demo.orangehrmlive.com',
            };

            return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
        }
    );

    server.registerTool(
        'diagnose_flaky',
        {
            description: 'Analyze flaky test patterns across multiple test result runs',
            inputSchema: z.object({
                testTitle: z.string().describe('Test title or partial match'),
                resultsPaths: z.array(z.string()).optional().describe('Paths to test-results JSON files. Defaults to test-results.json'),
            }),
        },
        async ({ testTitle, resultsPaths }) => {
            const pathsToRead = (resultsPaths?.length ? resultsPaths : ['test-results.json'])
                .map((p) => path.resolve(PROJECT_ROOT, p));

            const history = [];
            for (const filePath of pathsToRead) {
                const results = loadJsonResults(filePath, fs);
                if (!results) {
                    history.push({ file: filePath, error: 'File not found' });
                    continue;
                }

                const match = findTestByTitle(results, testTitle);
                if (!match) {
                    history.push({ file: filePath, error: `Test "${testTitle}" not found` });
                    continue;
                }

                const status = summarizeTestStatus(match.test);
                history.push({
                    file: path.basename(filePath),
                    title: match.title,
                    status: status.status,
                    duration: status.duration,
                    retries: status.retries,
                    errors: status.errors,
                });
            }

            const validRuns = history.filter((h) => !h.error);
            const durations = validRuns.map((h) => h.duration).filter(Boolean);
            const flakySignals = {
                hasRetries: validRuns.some((h) => h.retries > 0),
                passedAfterRetry: validRuns.some((h) => h.retries > 0 && h.status === 'passed'),
                timingVarianceMs: Math.round(computeVariance(durations)),
                commonErrors: groupErrors(validRuns),
                likelyCauses: [
                    validRuns.some((h) => h.retries > 0) ? 'Intermittent failure — possible race condition or timing issue' : null,
                    computeVariance(durations) > 1000000 ? 'High duration variance — network or load sensitivity' : null,
                    groupErrors(validRuns).length > 0 ? `Recurring error: ${groupErrors(validRuns)[0]?.message}` : null,
                    'Brittle XPath/CSS selector',
                    'waitForTimeout masking real wait conditions',
                    'Shared test data under parallel execution',
                ].filter(Boolean),
                recommendations: [
                    'Enable trace: retain-on-failure and inspect action timeline',
                    'Replace XPath with getByRole/getByPlaceholder',
                    'Use healing.fixture.js to capture failure context',
                    'Run with --repeat-each=10 locally to reproduce',
                ],
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ testTitle, history, flakySignals }, null, 2),
                }],
            };
        }
    );

    server.registerTool(
        'create_bug_report',
        {
            description: 'Format a test failure into a Jira-ready bug report with repro steps',
            inputSchema: z.object({
                reportPath: z.string().optional().describe('Path to bug report JSON. Uses latest if omitted.'),
            }),
        },
        async ({ reportPath }) => {
            let report;
            let sourcePath;

            if (reportPath) {
                sourcePath = path.resolve(PROJECT_ROOT, reportPath);
                if (!fs.existsSync(sourcePath)) {
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ error: `Report not found: ${sourcePath}` }, null, 2),
                        }],
                    };
                }
                report = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
            } else {
                const latest = loadLatestBugReport(PATHS.bugReportsDir, fs);
                if (!latest) {
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                error: 'No bug reports found. Run tests with bugReportReporter enabled.',
                                expectedDir: PATHS.bugReportsDir,
                            }, null, 2),
                        }],
                    };
                }
                report = latest.report;
                sourcePath = latest.path;
            }

            if (report.failureContextDir) {
                const networkPath = path.join(report.failureContextDir, 'network.json');
                if (fs.existsSync(networkPath)) {
                    report.networkIssues = JSON.parse(fs.readFileSync(networkPath, 'utf-8'));
                }
            }

            const jiraMarkdown = formatJiraBugReport(report);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        sourceReport: sourcePath,
                        jiraMarkdown,
                        rawReport: report,
                    }, null, 2),
                }],
            };
        }
    );

    server.registerTool(
        'summarize_suite',
        {
            description: 'Summarize test run results in plain English for stakeholders',
            inputSchema: z.object({
                resultsPath: z.string().optional().describe('Path to test-results.json'),
            }),
        },
        async ({ resultsPath }) => {
            const filePath = resultsPath
                ? path.resolve(PROJECT_ROOT, resultsPath)
                : PATHS.testResults;

            const results = loadJsonResults(filePath, fs);
            if (!results) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: 'No test results found. Run: npm run test:ci',
                            expectedPath: filePath,
                        }, null, 2),
                    }],
                };
            }

            const summary = summarizeSuite(results);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(summary, null, 2),
                }],
            };
        }
    );

    server.registerTool(
        'list_bug_reports',
        {
            description: 'List all auto-generated bug reports from failed tests',
            inputSchema: z.object({}),
        },
        async () => {
            if (!fs.existsSync(PATHS.bugReportsDir)) {
                return { content: [{ type: 'text', text: '[]' }] };
            }

            const reports = fs.readdirSync(PATHS.bugReportsDir)
                .filter((f) => f.endsWith('.json'))
                .map((f) => {
                    const filePath = path.join(PATHS.bugReportsDir, f);
                    const report = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    return {
                        file: f,
                        path: `bug-reports/${f}`,
                        title: report.title,
                        timestamp: report.timestamp,
                        actual: report.actual?.split('\n')[0],
                    };
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return { content: [{ type: 'text', text: JSON.stringify(reports, null, 2) }] };
        }
    );

    server.registerTool(
        'list_failure_contexts',
        {
            description: 'Find failure-context directories from recent test runs (for heal_locator)',
            inputSchema: z.object({}),
        },
        async () => {
            const contexts = [];

            function walk(dir, depth = 0) {
                if (!fs.existsSync(dir) || depth > 6) {
                    return;
                }

                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name === 'failure-context' && fs.existsSync(path.join(fullPath, 'meta.json'))) {
                            const meta = JSON.parse(fs.readFileSync(path.join(fullPath, 'meta.json'), 'utf-8'));
                            contexts.push({
                                path: fullPath,
                                url: meta.url,
                                timestamp: meta.timestamp,
                            });
                        } else {
                            walk(fullPath, depth + 1);
                        }
                    }
                }
            }

            walk(PATHS.testResultsDir);
            contexts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return { content: [{ type: 'text', text: JSON.stringify(contexts, null, 2) }] };
        }
    );
}
