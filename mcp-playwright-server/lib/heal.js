const ROLE_MAP = {
    button: 'getByRole',
    link: 'getByRole',
    textbox: 'getByRole',
    checkbox: 'getByRole',
    combobox: 'getByRole',
    heading: 'getByRole',
};

function walkA11y(node, matches = []) {
    if (!node) {
        return matches;
    }

    matches.push({
        role: node.role,
        name: node.name,
        value: node.value,
    });

    for (const child of node.children ?? []) {
        walkA11y(child, matches);
    }

    return matches;
}

function suggestFromA11y(nodes, brokenSelector) {
    const suggestions = [];
    const selectorLower = brokenSelector.toLowerCase();

    for (const node of nodes) {
        if (!node.role || !node.name) {
            continue;
        }

        const role = node.role.toLowerCase();
        const name = node.name;
        const nameLower = name.toLowerCase();

        if (
            selectorLower.includes(nameLower) ||
            nameLower.includes('login') && selectorLower.includes('login') ||
            nameLower.includes('username') && selectorLower.includes('username') ||
            nameLower.includes('password') && selectorLower.includes('password')
        ) {
            if (role === 'textbox' || role === 'searchbox') {
                suggestions.push({
                    strategy: 'getByPlaceholder',
                    code: `page.getByPlaceholder('${name}')`,
                    confidence: 'high',
                    reason: `Matched textbox name "${name}" from accessibility tree`,
                });
                suggestions.push({
                    strategy: 'getByRole',
                    code: `page.getByRole('textbox', { name: '${name}' })`,
                    confidence: 'medium',
                    reason: `Role textbox with accessible name "${name}"`,
                });
            } else if (ROLE_MAP[role]) {
                suggestions.push({
                    strategy: 'getByRole',
                    code: `page.getByRole('${role}', { name: '${name}' })`,
                    confidence: 'high',
                    reason: `Role ${role} with accessible name "${name}"`,
                });
            }
        }
    }

    const seen = new Set();
    return suggestions.filter((s) => {
        if (seen.has(s.code)) {
            return false;
        }
        seen.add(s.code);
        return true;
    });
}

function suggestFromDom(dom, brokenSelector) {
    const suggestions = [];
    const placeholderMatch = brokenSelector.match(/placeholder=['"]([^'"]+)['"]/i) ||
        dom.match(/placeholder="([^"]+)"/i);

    if (placeholderMatch) {
        const placeholder = placeholderMatch[1];
        suggestions.push({
            strategy: 'getByPlaceholder',
            code: `page.getByPlaceholder('${placeholder}')`,
            confidence: 'high',
            reason: `Placeholder "${placeholder}" found in DOM`,
        });
    }

    if (/button|login/i.test(brokenSelector)) {
        suggestions.push({
            strategy: 'getByRole',
            code: `page.getByRole('button', { name: 'Login' })`,
            confidence: 'medium',
            reason: 'Common login button pattern',
        });
    }

    const testIdMatch = dom.match(/data-testid="([^"]+)"/);
    if (testIdMatch) {
        suggestions.push({
            strategy: 'getByTestId',
            code: `page.getByTestId('${testIdMatch[1]}')`,
            confidence: 'high',
            reason: `data-testid="${testIdMatch[1]}" found in DOM`,
        });
    }

    return suggestions;
}

export function buildHealReport({ brokenSelector, failureContextDir, fs, path }) {
    const a11yPath = path.join(failureContextDir, 'a11y.json');
    const domPath = path.join(failureContextDir, 'dom.html');
    const metaPath = path.join(failureContextDir, 'meta.json');
    const networkPath = path.join(failureContextDir, 'network.json');

    if (!fs.existsSync(a11yPath) || !fs.existsSync(domPath)) {
        return {
            error: `Failure context not found at ${failureContextDir}. Run a failing test with healing.fixture.js first.`,
        };
    }

    const a11y = JSON.parse(fs.readFileSync(a11yPath, 'utf-8'));
    const dom = fs.readFileSync(domPath, 'utf-8');
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
    const network = fs.existsSync(networkPath) ? JSON.parse(fs.readFileSync(networkPath, 'utf-8')) : [];

    const a11yNodes = walkA11y(a11y);
    const suggestions = [
        ...suggestFromA11y(a11yNodes, brokenSelector),
        ...suggestFromDom(dom, brokenSelector),
    ];

    return {
        brokenSelector,
        failureUrl: meta.url,
        recommendations: [
            'Prefer getByRole / getByPlaceholder over XPath',
            'Avoid waitForTimeout — use waitForSelector or waitForLoadState',
            'Use data-testid attributes when roles are ambiguous',
        ],
        suggestions: suggestions.length > 0 ? suggestions : [{
            strategy: 'manual_review',
            code: null,
            confidence: 'low',
            reason: 'No automatic match found — review failure-screenshot and a11y.json',
        }],
        networkIssues: network.slice(0, 10),
        artifacts: {
            screenshot: path.join(failureContextDir, 'failure.png'),
            dom: domPath,
            a11y: a11yPath,
        },
    };
}
