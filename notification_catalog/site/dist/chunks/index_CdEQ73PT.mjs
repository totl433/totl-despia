const id = "templates/en/index.md";
						const collection = "docs";
						const slug = "templates/en";
						const body = "\n# Notification Templates (English)\n\n## Goal Scored\n```\nTitle: {teamName} scores!\nBody: {minute}' {scorer}\n      {homeTeam} [{homeScore}] - {awayScore} {awayTeam}\n```\n\n## Goal Disallowed\n```\nTitle: 🚫 Goal Disallowed\nBody: {minute}' {scorer}'s goal for {teamName} was disallowed by VAR\n      {homeTeam} {homeScore}-{awayScore} {awayTeam}\n```\n\n## Kickoff (First Half)\n```\nTitle: ⚽ {homeTeam} vs {awayTeam}\nBody: Kickoff!\n```\n\n## Kickoff (Second Half)\n```\nTitle: ⚽ {homeTeam} vs {awayTeam}\nBody: Second half underway\n```\n\n## Half-Time\n```\nTitle: ⏸️ Half-Time\nBody: {homeTeam} {homeScore}-{awayScore} {awayTeam} {minute}'\n```\n\n## Final Whistle (Correct Pick)\n```\nTitle: FT: {homeTeam} {homeScore}-{awayScore} {awayTeam}\nBody: ✅ Got it right! {percentage}% of players got this fixture correct\n```\n\n## Final Whistle (Wrong Pick)\n```\nTitle: FT: {homeTeam} {homeScore}-{awayScore} {awayTeam}\nBody: ❌ Wrong pick {percentage}% of players got this fixture correct\n```\n\n## Gameweek Complete\n```\nTitle: 🎉 Gameweek {gw} Complete!\nBody: All games finished. Check your results!\n```\n\n## Chat Message\n```\nTitle: {senderName}\nBody: {messageContent}\n```\n\n## Final Submission\n```\nTitle: All predictions submitted! 🎉\nBody: Everyone in {leagueName} has submitted for {matchdayLabel}. Check out who picked what!\n```\n\n## New Gameweek (Admin Custom)\n```\nTitle: ⚽ Gameweek {gw} is live!\nBody: Fixtures are now available. Make your picks before kickoff!\n```\n\n";
						const data = {title:"English Templates",description:"Message templates for all notification types",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/templates/en/index.md",
							rawData: "\ntitle: English Templates\ndescription: Message templates for all notification types\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
