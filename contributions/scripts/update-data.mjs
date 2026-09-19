import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const token = process.env.CONTRIBUTIONS_TOKEN;
if (!token) throw new Error('CONTRIBUTIONS_TOKEN is required');

const username = 'ikunkunkunkunkunkun';
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../data');
await mkdir(output, { recursive: true });

async function graphql(query) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'ikun-contribution-calendar',
    },
    body: JSON.stringify({ query }),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new Error(`GitHub GraphQL request failed: ${response.status} ${JSON.stringify(result.errors ?? result.message)}`);
  }
  return result.data.user;
}

const first = await graphql(`query { user(login: "${username}") { contributionsCollection { contributionYears } } }`);
const years = first.contributionsCollection.contributionYears.sort((a, b) => b - a);
const currentYear = new Date().getUTCFullYear();
if (!years.includes(currentYear)) years.unshift(currentYear);

for (const year of years) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;
  const user = await graphql(`query { user(login: "${username}") { contributionsCollection(from: "${from}", to: "${to}") { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`);
  const calendar = user.contributionsCollection.contributionCalendar;
  const days = calendar.weeks.flatMap(week => week.contributionDays)
    .filter(day => day.date.startsWith(`${year}-`))
    .map(({ date, contributionCount }) => ({ date, count: contributionCount }));
  if (days.length < 1 || days.length > 366 || days.some(day => !Number.isInteger(day.count) || day.count < 0)) {
    throw new Error(`Invalid contribution calendar for ${year}`);
  }
  const data = { year, total: calendar.totalContributions, days };
  await writeFile(resolve(output, `${year}.json`), JSON.stringify(data) + '\n');
  console.log(`${year}: ${calendar.totalContributions} contributions, ${days.length} days`);
}

await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ username, years, updatedAt: new Date().toISOString() }) + '\n');
