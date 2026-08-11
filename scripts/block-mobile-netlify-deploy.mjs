console.error(
  [
    '',
    'BLOCKED: this is the native TestFlight branch, not the web production branch.',
    'Do not deploy it to Netlify or playtotl.com.',
    'Build TestFlight from apps/mobile with EAS only.',
    '',
  ].join('\n')
);

process.exit(1);
