export function walkSuites(suite, parentTitles, visitor) {
    const titles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs ?? []) {
        visitor({ suite, spec, titles });
    }

    for (const child of suite.suites ?? []) {
        walkSuites(child, titles, visitor);
    }
}

export function findTests(results, titleFilter) {
    const matches = [];
    const filter = titleFilter?.toLowerCase() ?? '';

    for (const rootSuite of results.suites ?? []) {
        walkSuites(rootSuite, [], ({ suite, spec, titles }) => {
            const title = [...titles, spec.title].filter(Boolean).join(' > ');

            if (filter && !title.toLowerCase().includes(filter) && !spec.title.toLowerCase().includes(filter)) {
                return;
            }

            for (const test of spec.tests ?? []) {
                matches.push({ suite, spec, test, title });
            }
        });
    }

    return matches;
}

export function findTestByTitle(results, testTitle) {
    const matches = findTests(results, testTitle);
    return matches.length > 0 ? matches[0] : null;
}

export function loadJsonResults(filePath, fs) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function summarizeTestStatus(test) {
    const results = test.results ?? [];
    const lastResult = results[results.length - 1];
    return {
        status: lastResult?.status ?? 'unknown',
        duration: results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        retries: Math.max(0, results.length - 1),
        errors: results.map((result) => result.error?.message).filter(Boolean),
    };
}

export function computeVariance(values) {
    if (values.length < 2) {
        return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

export function groupErrors(history) {
    const counts = {};
    for (const entry of history) {
        for (const error of entry.errors ?? []) {
            const key = error.split('\n')[0].slice(0, 120);
            counts[key] = (counts[key] ?? 0) + 1;
        }
    }
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([message, count]) => ({ message, count }));
}
