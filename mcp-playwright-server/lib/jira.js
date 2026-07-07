export function formatJiraBugReport(report) {
    const steps = (report.stepsToReproduce ?? [])
        .map((step, index) => `# ${step}`)
        .join('\n') || '# (No steps captured — check trace attachment)';

    const attachments = (report.attachments ?? [])
        .map((a) => `* ${a.name}: \`${a.path}\``)
        .join('\n') || '_No attachments_';

    const networkSection = report.networkIssues?.length
        ? `
h2. Network Issues at Failure
{code}
${JSON.stringify(report.networkIssues, null, 2)}
{code}`
        : '';

    return `
h2. Summary
${report.title}

h2. Environment
* *Project:* ${report.environment?.project ?? 'N/A'}
* *Base URL:* ${report.environment?.baseURL ?? 'N/A'}
* *CI:* ${report.environment?.ci ? 'Yes' : 'No'}
* *Test file:* ${report.file ?? 'N/A'}:${report.line ?? ''}
* *Duration:* ${report.duration ?? 0}ms
* *Retry attempt:* ${report.retry ?? 0}

h2. Steps to Reproduce
${steps}

h2. Expected Result
${report.expected}

h2. Actual Result
{code}
${report.actual ?? 'Unknown failure'}
{code}

h2. Failure Artifacts
${attachments}
${report.failureContextDir ? `* Failure context directory: \`${report.failureContextDir}\`` : ''}
${networkSection}

h2. Timestamp
${report.timestamp}
`.trim();
}

export function loadLatestBugReport(bugReportsDir, fs) {
    if (!fs.existsSync(bugReportsDir)) {
        return null;
    }

    const files = fs.readdirSync(bugReportsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({
            name: f,
            path: `${bugReportsDir}/${f}`,
            mtime: fs.statSync(`${bugReportsDir}/${f}`).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
        return null;
    }

    const latest = files[0];
    return {
        path: latest.path,
        report: JSON.parse(fs.readFileSync(latest.path, 'utf-8')),
    };
}
