import * as client from './github-graphql';
import * as type from './type';

const OTHER_COLOR = '#444444';

// Language alias mapping: maps variant languages to their canonical form for exclusion
// When a user excludes "typescript", it also excludes "tsx"
// Keys are lowercase canonical names, values are arrays of lowercase aliases
const LANGUAGE_ALIASES: { [canonical: string]: string[] } = {
    typescript: ['tsx'],
    javascript: ['jsx'],
    python: ['cython', 'jupyter notebook'],
    c: ['c++', 'objective-c', 'objective-c++'],
    'c++': ['c', 'objective-c', 'objective-c++'],
    shell: ['bash', 'zsh', 'fish', 'powershell', 'batchfile'],
    html: ['html+erb', 'html+django', 'html+php'],
    css: ['scss', 'sass', 'less', 'stylus'],
};

// Build reverse lookup: alias -> canonical
const buildAliasLookup = (): Map<string, string[]> => {
    const lookup = new Map<string, string[]>();
    for (const [canonical, aliases] of Object.entries(LANGUAGE_ALIASES)) {
        // Add canonical -> [canonical, ...aliases]
        lookup.set(canonical, [canonical, ...aliases]);
        // Add each alias -> [canonical, ...aliases]
        for (const alias of aliases) {
            lookup.set(alias, [canonical, ...aliases]);
        }
    }
    return lookup;
};

const ALIAS_LOOKUP = buildAliasLookup();

// Expand a set of excluded languages to include their aliases
const expandExcludedLanguages = (excludedLanguages: Set<string>): Set<string> => {
    const expanded = new Set<string>();
    for (const lang of excludedLanguages) {
        const lowerLang = lang.toLowerCase();
        expanded.add(lowerLang);
        // If this language has aliases, add them all
        const related = ALIAS_LOOKUP.get(lowerLang);
        if (related) {
            for (const alias of related) {
                expanded.add(alias);
            }
        }
    }
    return expanded;
};

const toNumberContributionLevel = (level: type.ContributionLevel): number => {
    switch (level) {
        case 'NONE':
            return 0;
        case 'FIRST_QUARTILE':
            return 1;
        case 'SECOND_QUARTILE':
            return 2;
        case 'THIRD_QUARTILE':
            return 3;
        case 'FOURTH_QUARTILE':
            return 4;
    }
};

const compare = (num1: number, num2: number): number => {
    if (num1 < num2) {
        return -1;
    } else if (num1 > num2) {
        return 1;
    } else {
        return 0;
    }
};

export const aggregateUserInfo = (
    response: client.ResponseType,
    excludedLanguages: Set<string> = new Set(),
): type.UserInfo => {
    if (!response.data) {
        if (response.errors && response.errors.length) {
            throw new Error(response.errors[0].message);
        } else {
            throw new Error('JSON\n' + JSON.stringify(response, null, 2));
        }
    }

    // Expand excluded languages to include their aliases
    const expandedExclusions = expandExcludedLanguages(excludedLanguages);

    const user = response.data.user;
    const calendar = user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week) => week.contributionDays)
        .map((week) => ({
            contributionCount: week.contributionCount,
            contributionLevel: toNumberContributionLevel(
                week.contributionLevel,
            ),
            date: new Date(week.date),
        }));
    const contributesLanguage: { [language: string]: { color: string; contributions: number } } = {};
    user.contributionsCollection.commitContributionsByRepository
        .filter((repo) => repo.repository.languages && repo.repository.languages.totalSize > 0)
        .forEach((repo) => {
            const languages = repo.repository.languages!;
            const contributions = repo.contributions.totalCount;

            // Filter out excluded languages (using expanded set with aliases)
            const includedEdges = languages.edges.filter(
                (edge) => !expandedExclusions.has(edge.node.name.toLowerCase()),
            );

            // Recalculate total size from included languages only
            const adjustedTotalSize = includedEdges.reduce((sum, edge) => sum + edge.size, 0);

            if (adjustedTotalSize === 0) {
                return; // Skip repo if all languages excluded
            }

            includedEdges.forEach((edge) => {
                const language = edge.node.name;
                const color = edge.node.color || OTHER_COLOR;
                const proportionalContributions = (edge.size / adjustedTotalSize) * contributions;

                const info = contributesLanguage[language];
                if (info) {
                    info.contributions += proportionalContributions;
                } else {
                    contributesLanguage[language] = {
                        color: color,
                        contributions: proportionalContributions,
                    };
                }
            });
        });
    const languages: Array<type.LangInfo> = Object.entries(contributesLanguage)
        .map(([language, info]) => ({
            language: language,
            color: info.color,
            contributions: Math.round(info.contributions),
        }))
        .filter((info) => info.contributions > 0)
        .sort((obj1, obj2) => -compare(obj1.contributions, obj2.contributions));

    const totalForkCount = user.repositories.nodes
        .map((node) => node.forkCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const totalStargazerCount = user.repositories.nodes
        .map((node) => node.stargazerCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const userInfo: type.UserInfo = {
        isHalloween:
            user.contributionsCollection.contributionCalendar.isHalloween,
        contributionCalendar: calendar,
        contributesLanguage: languages,
        totalContributions:
            user.contributionsCollection.contributionCalendar
                .totalContributions,
        totalCommitContributions:
            user.contributionsCollection.totalCommitContributions,
        totalIssueContributions:
            user.contributionsCollection.totalIssueContributions,
        totalPullRequestContributions:
            user.contributionsCollection.totalPullRequestContributions,
        totalPullRequestReviewContributions:
            user.contributionsCollection.totalPullRequestReviewContributions,
        totalRepositoryContributions:
            user.contributionsCollection.totalRepositoryContributions,
        totalForkCount: totalForkCount,
        totalStargazerCount: totalStargazerCount,
    };
    return userInfo;
};
