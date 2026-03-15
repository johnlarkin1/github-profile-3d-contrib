import * as core from '@actions/core';
import * as aggregate from './aggregate-user-info';
import * as template from './color-template';
import * as create from './create-svg';
import * as f from './file-writer';
import * as r from './settings-reader';
import * as client from './github-graphql';
import * as report from './create-language-report';

export const main = async (): Promise<void> => {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            core.setFailed('GITHUB_TOKEN is empty');
            return;
        }
        const userName =
            3 <= process.argv.length ? process.argv[2] : process.env.USERNAME;
        if (!userName) {
            core.setFailed('USERNAME is empty');
            return;
        }
        const maxRepos = process.env.MAX_REPOS
            ? Number(process.env.MAX_REPOS)
            : 100;
        if (Number.isNaN(maxRepos)) {
            core.setFailed('MAX_REPOS is NaN');
            return;
        }
        const year = process.env.YEAR ? Number(process.env.YEAR) : null;
        if (Number.isNaN(year)) {
            core.setFailed('YEAR is NaN');
            return;
        }
        const excludedLanguages: Set<string> = new Set(
            (process.env.EXCLUDED_LANGUAGES || '')
                .split(',')
                .map((lang) => lang.trim().toLowerCase())
                .filter((lang) => lang.length > 0),
        );

        const maxLanguages = process.env.MAX_LANGUAGES
            ? Number(process.env.MAX_LANGUAGES)
            : undefined;
        if (
            maxLanguages !== undefined &&
            (Number.isNaN(maxLanguages) || maxLanguages < 1 || maxLanguages > 20)
        ) {
            core.setFailed('MAX_LANGUAGES must be a number between 1 and 20');
            return;
        }

        // Helper to merge maxLanguages into settings
        const mergeSettings = <T>(settings: T): T => {
            if (maxLanguages === undefined) {
                return settings;
            }
            return { ...settings, maxLanguages };
        };

        const response = await client.fetchData(
            token,
            userName,
            maxRepos,
            year,
        );
        const userInfo = aggregate.aggregateUserInfo(response, excludedLanguages);

        // Generate language distribution report
        const expandedExclusions = aggregate.expandExcludedLanguages(excludedLanguages);
        const reportData = report.generateLanguageReport(response, excludedLanguages, expandedExclusions);
        const reportContent = report.formatReport(reportData);
        f.writeFile('language-report.md', reportContent);
        console.log('Language report written to profile-3d-contrib/language-report.md');

        // Also log a quick summary to the action output
        console.log('\n=== Language Distribution Summary ===');
        for (const lang of reportData.aggregatedLanguages.slice(0, 10)) {
            console.log(`  ${lang.language}: ${lang.percentage.toFixed(1)}% (${lang.repos.length} repos)`);
        }
        console.log(`  Total repos analyzed: ${reportData.totalReposAnalyzed}`);
        console.log('=====================================\n');

        if (process.env.SETTING_JSON) {
            const settingFile = r.readSettingJson(process.env.SETTING_JSON);
            const settingInfos =
                'length' in settingFile ? settingFile : [settingFile];
            for (const settingInfo of settingInfos) {
                const fileName =
                    settingInfo.fileName || 'profile-customize.svg';
                f.writeFile(
                    fileName,
                    create.createSvg(userInfo, mergeSettings(settingInfo), false),
                );
            }
        } else {
            const settings = userInfo.isHalloween
                ? template.HalloweenSettings
                : template.NormalSettings;

            f.writeFile(
                'profile-green-animate.svg',
                create.createSvg(userInfo, mergeSettings(settings), true),
            );
            f.writeFile(
                'profile-green.svg',
                create.createSvg(userInfo, mergeSettings(settings), false),
            );

            // Northern hemisphere
            f.writeFile(
                'profile-season-animate.svg',
                create.createSvg(userInfo, mergeSettings(template.NorthSeasonSettings), true),
            );
            f.writeFile(
                'profile-season.svg',
                create.createSvg(userInfo, mergeSettings(template.NorthSeasonSettings), false),
            );

            // Southern hemisphere
            f.writeFile(
                'profile-south-season-animate.svg',
                create.createSvg(userInfo, mergeSettings(template.SouthSeasonSettings), true),
            );
            f.writeFile(
                'profile-south-season.svg',
                create.createSvg(userInfo, mergeSettings(template.SouthSeasonSettings), false),
            );

            f.writeFile(
                'profile-night-view.svg',
                create.createSvg(userInfo, mergeSettings(template.NightViewSettings), true),
            );

            f.writeFile(
                'profile-night-green.svg',
                create.createSvg(userInfo, mergeSettings(template.NightGreenSettings), true),
            );

            f.writeFile(
                'profile-night-rainbow.svg',
                create.createSvg(userInfo, mergeSettings(template.NightRainbowSettings), true),
            );

            f.writeFile(
                'profile-gitblock.svg',
                create.createSvg(userInfo, mergeSettings(template.GitBlockSettings), true),
            );
        }
    } catch (error) {
        console.error(error);
        core.setFailed('error');
    }
};

void main();
