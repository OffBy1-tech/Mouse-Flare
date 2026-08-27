#!/usr/bin/env node
// Regenerates CHANGELOG.md from GitHub Releases. Usage:
//   gh api repos/OffBy1-tech/Mouse-Flare/releases --paginate | ./scripts/generate_changelog.js > CHANGELOG.md
// Skips drafts and the rolling `latest` dev-build release.

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  // `gh api --paginate` concatenates one JSON array per page: "[...][...]".
  const releases = JSON.parse('[' + input.replace(/\]\s*\[/g, '],[') + ']').flat();

  const lines = [
    '# Changelog',
    '',
    'All notable releases of Mouseflare. Generated from [GitHub Releases](https://github.com/OffBy1-tech/Mouse-Flare/releases).',
    '',
  ];

  for (const r of releases) {
    if (r.draft || r.tag_name === 'latest') continue;
    const date = (r.published_at || r.created_at).slice(0, 10);
    lines.push(`## ${r.name} (${date})`, '', r.body.replace(/\r\n/g, '\n').trim(), '', '');
  }

  process.stdout.write(lines.join('\n'));
});
