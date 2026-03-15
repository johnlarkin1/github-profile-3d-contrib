import * as client from './github-graphql';
import * as type from './type';

export interface RepoLanguageBreakdown {
    repoName: string;
    commits: number;
    languages: Array<{
        name: string;
        bytes: number;
        percentage: number;
        weightedContributions: number;
    }>;
    totalBytes: number;
}

export interface LanguageReportData {
    repoBreakdowns: RepoLanguageBreakdown[];
    aggregatedLanguages: Array<{
        language: string;
        totalWeightedContributions: number;
        percentage: number;
        repos: Array<{ name: string; contributions: number; bytes: number }>;
    }>;
    excludedLanguages: string[];
    totalReposAnalyzed: number;
    totalReposSkipped: number;
}

export const generateLanguageReport = (
    response: client.ResponseType,
    excludedLanguages: Set<string>,
    expandedExclusions: Set<string>,
): LanguageReportData => {
    const user = response.data!.user;
    const repos = user.contributionsCollection.commitContributionsByRepository;

    const repoBreakdowns: RepoLanguageBreakdown[] = [];
    let totalReposSkipped = 0;

    // Per-language accumulator
    const langAccum: {
        [lang: string]: {
            totalWeighted: number;
            repos: Array<{ name: string; contributions: number; bytes: number }>;
        };
    } = {};

    for (const repo of repos) {
        const repoName = repo.repository.nameWithOwner;
        const commits = repo.contributions.totalCount;
        const languages = repo.repository.languages;

        if (!languages || languages.totalSize === 0) {
            totalReposSkipped++;
            continue;
        }

        const includedEdges = languages.edges.filter(
            (edge) =>
                !expandedExclusions.has(edge.node.name.toLowerCase()),
        );

        const adjustedTotalSize = includedEdges.reduce(
            (sum, edge) => sum + edge.size,
            0,
        );

        if (adjustedTotalSize === 0) {
            totalReposSkipped++;
            continue;
        }

        const breakdown: RepoLanguageBreakdown = {
            repoName,
            commits,
            totalBytes: adjustedTotalSize,
            languages: includedEdges.map((edge) => {
                const pct = edge.size / adjustedTotalSize;
                const weighted = pct * commits;
                return {
                    name: edge.node.name,
                    bytes: edge.size,
                    percentage: pct * 100,
                    weightedContributions: weighted,
                };
            }),
        };
        repoBreakdowns.push(breakdown);

        // Accumulate per-language
        for (const lang of breakdown.languages) {
            if (!langAccum[lang.name]) {
                langAccum[lang.name] = { totalWeighted: 0, repos: [] };
            }
            langAccum[lang.name].totalWeighted += lang.weightedContributions;
            langAccum[lang.name].repos.push({
                name: repoName,
                contributions: lang.weightedContributions,
                bytes: lang.bytes,
            });
        }
    }

    // Sort repos by commit count descending
    repoBreakdowns.sort((a, b) => b.commits - a.commits);

    // Build aggregated view
    const totalWeighted = Object.values(langAccum).reduce(
        (sum, l) => sum + l.totalWeighted,
        0,
    );

    const aggregatedLanguages = Object.entries(langAccum)
        .map(([language, data]) => ({
            language,
            totalWeightedContributions: data.totalWeighted,
            percentage: totalWeighted > 0 ? (data.totalWeighted / totalWeighted) * 100 : 0,
            repos: data.repos.sort((a, b) => b.contributions - a.contributions),
        }))
        .sort((a, b) => b.totalWeightedContributions - a.totalWeightedContributions);

    return {
        repoBreakdowns,
        aggregatedLanguages,
        excludedLanguages: Array.from(excludedLanguages),
        totalReposAnalyzed: repoBreakdowns.length,
        totalReposSkipped,
    };
};

const formatNumber = (n: number): string => {
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2);
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatReport = (data: LanguageReportData): string => {
    const lines: string[] = [];

    lines.push('# Language Distribution Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`- **Repos analyzed:** ${data.totalReposAnalyzed}`);
    lines.push(`- **Repos skipped** (no language data or all excluded): ${data.totalReposSkipped}`);
    lines.push(`- **Excluded languages:** ${data.excludedLanguages.length > 0 ? data.excludedLanguages.join(', ') : 'none'}`);
    lines.push('');

    // === Aggregated language summary ===
    lines.push('## Language Summary (Weighted by Commits)');
    lines.push('');
    lines.push('| Rank | Language | Weighted Contributions | % | # Repos |');
    lines.push('|------|----------|----------------------|---|---------|');
    data.aggregatedLanguages.forEach((lang, i) => {
        lines.push(
            `| ${i + 1} | ${lang.language} | ${formatNumber(lang.totalWeightedContributions)} | ${lang.percentage.toFixed(1)}% | ${lang.repos.length} |`,
        );
    });
    lines.push('');

    // === Per-language detail: top repos ===
    lines.push('## Per-Language Breakdown (Top Repos)');
    lines.push('');
    for (const lang of data.aggregatedLanguages) {
        lines.push(`### ${lang.language} — ${lang.percentage.toFixed(1)}%`);
        lines.push('');
        lines.push('| Repo | Weighted Contributions | Bytes |');
        lines.push('|------|----------------------|-------|');
        // Show top 10 repos per language
        for (const repo of lang.repos.slice(0, 10)) {
            lines.push(
                `| ${repo.name} | ${formatNumber(repo.contributions)} | ${formatBytes(repo.bytes)} |`,
            );
        }
        if (lang.repos.length > 10) {
            lines.push(`| ... and ${lang.repos.length - 10} more repos | | |`);
        }
        lines.push('');
    }

    // === Per-repo detail ===
    lines.push('## Per-Repo Breakdown (Top 30 by Commits)');
    lines.push('');
    for (const repo of data.repoBreakdowns.slice(0, 30)) {
        lines.push(`### ${repo.repoName} — ${repo.commits} commits`);
        lines.push('');
        lines.push('| Language | Bytes | % of Repo | Weighted Contributions |');
        lines.push('|----------|-------|-----------|----------------------|');
        for (const lang of repo.languages) {
            lines.push(
                `| ${lang.name} | ${formatBytes(lang.bytes)} | ${lang.percentage.toFixed(1)}% | ${formatNumber(lang.weightedContributions)} |`,
            );
        }
        lines.push('');
    }
    if (data.repoBreakdowns.length > 30) {
        lines.push(`*...and ${data.repoBreakdowns.length - 30} more repos*`);
        lines.push('');
    }

    return lines.join('\n');
};
