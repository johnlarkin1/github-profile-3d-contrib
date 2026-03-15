import * as aggregate from '../src/aggregate-user-info'
import * as type from '../src/type';
import { dummyData } from './dummy-data';

describe('github-graphql', () => {
    it('fetchData', () => {
        const userInfo = aggregate.aggregateUserInfo(dummyData);

        expect(userInfo.contributionCalendar.length).toEqual(371);

        const languages: Array<type.LangInfo> = [
            {
                "language": "Jupyter Notebook",
                "color": "#DA5B0B",
                "contributions": 108,
                "repoCount": 1
            },
            {
                "language": "Perl",
                "color": "#0298c3",
                "contributions": 73,
                "repoCount": 1
            },
            {
                "language": "Kotlin",
                "color": "#F18E33",
                "contributions": 58,
                "repoCount": 1
            },
            {
                "language": "TypeScript",
                "color": "#2b7489",
                "contributions": 31,
                "repoCount": 2
            },
            {
                "language": "Java",
                "color": "#b07219",
                "contributions": 28,
                "repoCount": 2
            },
            {
                "language": "Go",
                "color": "#00ADD8",
                "contributions": 20,
                "repoCount": 2
            },
            {
                "language": "Python",
                "color": "#3572A5",
                "contributions": 10,
                "repoCount": 1
            },
            {
                "language": "JavaScript",
                "color": "#f1e05a",
                "contributions": 7,
                "repoCount": 1
            },
            {
                "language": "C",
                "color": "#555555",
                "contributions": 4,
                "repoCount": 1
            },
            {
                "language": "Ruby",
                "color": "#701516",
                "contributions": 1,
                "repoCount": 1
            }
        ];
        expect(userInfo.contributesLanguage).toEqual(languages);

        expect(userInfo.totalContributions).toEqual(366);
        expect(userInfo.totalCommitContributions).toEqual(344);
        expect(userInfo.totalIssueContributions).toEqual(4);
        expect(userInfo.totalPullRequestContributions).toEqual(12);
        expect(userInfo.totalPullRequestReviewContributions).toEqual(0);
        expect(userInfo.totalRepositoryContributions).toEqual(6);
        expect(userInfo.totalForkCount).toEqual(0);
        expect(userInfo.totalStargazerCount).toEqual(6);
    });

    it('excludes single language', () => {
        const excludedLanguages = new Set(['perl']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // Perl should not be in the results
        const perlEntry = userInfo.contributesLanguage.find(l => l.language === 'Perl');
        expect(perlEntry).toBeUndefined();

        // Other languages should still be present
        const kotlinEntry = userInfo.contributesLanguage.find(l => l.language === 'Kotlin');
        expect(kotlinEntry).toBeDefined();
    });

    it('excludes multiple languages', () => {
        const excludedLanguages = new Set(['perl', 'java', 'ruby']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        expect(userInfo.contributesLanguage.find(l => l.language === 'Perl')).toBeUndefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Java')).toBeUndefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Ruby')).toBeUndefined();

        // Non-excluded languages should still be present
        expect(userInfo.contributesLanguage.find(l => l.language === 'TypeScript')).toBeDefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Python')).toBeDefined();
    });

    it('handles case-insensitive language exclusion', () => {
        const excludedLanguages = new Set(['PERL', 'Java', 'RUBY']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        expect(userInfo.contributesLanguage.find(l => l.language === 'Perl')).toBeUndefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Java')).toBeUndefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Ruby')).toBeUndefined();
    });

    it('handles empty exclusion set (backward compatibility)', () => {
        const excludedLanguages = new Set<string>();
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // Should produce same results as no exclusion
        const userInfoNoParam = aggregate.aggregateUserInfo(dummyData);
        expect(userInfo.contributesLanguage).toEqual(userInfoNoParam.contributesLanguage);
    });

    it('handles non-existent language gracefully', () => {
        const excludedLanguages = new Set(['nonexistentlanguage']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // Should produce same results as no exclusion
        const userInfoNoParam = aggregate.aggregateUserInfo(dummyData);
        expect(userInfo.contributesLanguage).toEqual(userInfoNoParam.contributesLanguage);
    });

    it('recalculates proportions when excluding languages', () => {
        // When we exclude languages, the remaining languages should have their
        // proportions recalculated based on the adjusted total size
        const excludedLanguages = new Set(['perl']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // The total contributions across all languages should remain roughly the same
        // (some difference due to rounding)
        const totalContribs = userInfo.contributesLanguage.reduce(
            (sum, lang) => sum + lang.contributions,
            0
        );

        // Without Perl, contributions should be redistributed
        // The sum should still reflect the actual number of commits
        expect(totalContribs).toBeGreaterThan(0);
    });

    it('excludes Python alias Jupyter Notebook when Python is excluded', () => {
        // Jupyter Notebook is an alias for Python
        const excludedLanguages = new Set(['python']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // Both Python and Jupyter Notebook should be excluded
        expect(userInfo.contributesLanguage.find(l => l.language === 'Python')).toBeUndefined();
        expect(userInfo.contributesLanguage.find(l => l.language === 'Jupyter Notebook')).toBeUndefined();

        // Other languages should still be present
        expect(userInfo.contributesLanguage.find(l => l.language === 'TypeScript')).toBeDefined();
    });

    it('excludes JavaScript alias (JSX) when JavaScript is excluded', () => {
        // JSX is an alias for JavaScript - test demonstrates the alias system
        // Even if JSX isn't in the dummy data, the exclusion should work
        const excludedLanguages = new Set(['javascript']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // JavaScript should be excluded
        expect(userInfo.contributesLanguage.find(l => l.language === 'JavaScript')).toBeUndefined();

        // Other languages should still be present
        expect(userInfo.contributesLanguage.find(l => l.language === 'TypeScript')).toBeDefined();
    });

    it('applies language color overrides', () => {
        const languageColors = new Map([['python', '#ff6600']]);
        const userInfo = aggregate.aggregateUserInfo(dummyData, new Set(), languageColors);

        const pythonEntry = userInfo.contributesLanguage.find(l => l.language === 'Python');
        expect(pythonEntry).toBeDefined();
        expect(pythonEntry!.color).toBe('#ff6600');

        // Non-overridden languages keep their API colors
        const perlEntry = userInfo.contributesLanguage.find(l => l.language === 'Perl');
        expect(perlEntry).toBeDefined();
        expect(perlEntry!.color).toBe('#0298c3');
    });

    it('applies color overrides case-insensitively', () => {
        const languageColors = new Map([['typescript', '#00ff00']]);
        const userInfo = aggregate.aggregateUserInfo(dummyData, new Set(), languageColors);

        const tsEntry = userInfo.contributesLanguage.find(l => l.language === 'TypeScript');
        expect(tsEntry).toBeDefined();
        expect(tsEntry!.color).toBe('#00ff00');
    });

    it('applies multiple color overrides', () => {
        const languageColors = new Map([
            ['python', '#ff6600'],
            ['go', '#00ff00'],
        ]);
        const userInfo = aggregate.aggregateUserInfo(dummyData, new Set(), languageColors);

        expect(userInfo.contributesLanguage.find(l => l.language === 'Python')!.color).toBe('#ff6600');
        expect(userInfo.contributesLanguage.find(l => l.language === 'Go')!.color).toBe('#00ff00');
        // Others unchanged
        expect(userInfo.contributesLanguage.find(l => l.language === 'Java')!.color).toBe('#b07219');
    });

    it('excludes C alias C++ when C is excluded', () => {
        // C and C++ are aliased together
        const excludedLanguages = new Set(['c']);
        const userInfo = aggregate.aggregateUserInfo(dummyData, excludedLanguages);

        // C should be excluded
        expect(userInfo.contributesLanguage.find(l => l.language === 'C')).toBeUndefined();

        // Other languages should still be present
        expect(userInfo.contributesLanguage.find(l => l.language === 'TypeScript')).toBeDefined();
    });
});
