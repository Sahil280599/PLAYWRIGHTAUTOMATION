import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const PATHS = {
    testResults: path.join(PROJECT_ROOT, 'test-results.json'),
    pagesDir: path.join(PROJECT_ROOT, 'Pages'),
    testsDir: path.join(PROJECT_ROOT, 'tests'),
    bugReportsDir: path.join(PROJECT_ROOT, 'bug-reports'),
    testResultsDir: path.join(PROJECT_ROOT, 'test-results'),
};
