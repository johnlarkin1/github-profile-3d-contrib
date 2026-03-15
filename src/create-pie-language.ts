import * as d3 from 'd3';
import * as type from './type';

const OTHER_NAME = 'other';
const OTHER_COLOR = '#444444';

const formatPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    const percent = (value / total) * 100;
    if (percent < 1 && percent > 0) {
        return '< 1%';
    }
    return `${Math.round(percent)}%`;
};

export const createPieLanguage = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    x: number,
    y: number,
    width: number,
    height: number,
    settings: type.PieLangSettings,
    isForcedAnimation: boolean,
): void => {
    if (userInfo.totalContributions === 0) {
        return;
    }

    const maxLang = settings.maxLanguages ?? 5;
    const languages = userInfo.contributesLanguage.slice(0, maxLang);
    const sumContrib = languages
        .map((lang) => lang.contributions)
        .reduce((a, b) => a + b, 0);
    const otherContributions = userInfo.totalCommitContributions - sumContrib;
    if (0 < otherContributions) {
        languages.push({
            language: OTHER_NAME,
            color: OTHER_COLOR,
            contributions: otherContributions,
        });
    }

    const totalForPercentage = languages.reduce(
        (sum, lang) => sum + lang.contributions,
        0
    );

    const isAnimate = settings.growingAnimation || isForcedAnimation;
    const animeSteps = 5;
    const animateOpacity = (num: number) =>
        Array<string>(languages.length + animeSteps)
            .fill('')
            .map((d, i) => (i < num ? 0 : Math.min((i - num) / animeSteps, 1)))
            .join(';');

    const radius = height / 2;
    const margin = radius / 10;

    // +1 for visual padding; minimum 8 for visual consistency
    const row = Math.max(languages.length + 1, 8);
    const offset = (row - languages.length) / 2 + 0.5;
    const fontSize = height / row / 1.5;

    const pie = d3
        .pie<type.LangInfo>()
        .value((d) => d.contributions)
        .sortValues(null);
    const pieData = pie(languages);

    const group = svg.append('g').attr('transform', `translate(${x}, ${y})`);

    const groupLabel = group
        .append('g')
        .attr('transform', `translate(${radius * 2.1}, ${0})`);

    // markers for label
    const markers = groupLabel
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d) => (d.index + offset) * (height / row) - fontSize / 2)
        .attr('width', fontSize)
        .attr('height', fontSize)
        .attr('fill', (d) => d.data.color)
        .attr('class', 'stroke-bg')
        .attr('stroke-width', '1px');
    if (isAnimate) {
        markers
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }

    // labels
    const labels = groupLabel
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('text')
        .attr('dominant-baseline', 'middle')
        .text(
            (d) => {
                const pct = formatPercentage(d.data.contributions, totalForPercentage);
                const repos = d.data.repoCount;
                if (repos && d.data.language !== OTHER_NAME) {
                    return `${d.data.language} ${pct} (${repos} ${repos === 1 ? 'repo' : 'repos'})`;
                }
                return `${d.data.language} ${pct}`;
            }
        )
        .attr('x', fontSize * 1.2)
        .attr('y', (d) => (d.index + offset) * (height / row))
        .attr('class', 'fill-fg')
        .attr('font-size', `${fontSize}px`);
    if (isAnimate) {
        labels
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }

    const arc = d3
        .arc<d3.PieArcDatum<type.LangInfo>>()
        .outerRadius(radius - margin)
        .innerRadius(radius / 2);

    // pie chart
    const paths = group
        .append('g')
        .attr('transform', `translate(${radius}, ${radius})`)
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('path')
        .attr('d', arc)
        .style('fill', (d) => d.data.color) // style -> attr ?
        .attr('class', 'stroke-bg')
        .attr('stroke-width', '2px');
    paths
        .append('title')
        .text(
            (d) =>
                `${d.data.language}: ${d.data.contributions} commits (${formatPercentage(d.data.contributions, totalForPercentage)})`
        );
    if (isAnimate) {
        paths
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }
};
