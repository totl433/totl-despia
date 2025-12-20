const id = "notifications/gameweek-complete.md";
						const collection = "docs";
						const slug = "notifications/gameweek-complete";
						const body = "\n# Gameweek Complete Notification\n\n**Notification Key:** `gameweek-complete`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `gw_complete:{gw}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 7200 seconds |\n| Preference Key | `gw-results` |\n| Collapse ID | `gw_complete:{gw}` |\n| Thread ID | `totl_gameweek` |\n| Android Group | `totl_results` |\n\n## Trigger\n\nTriggered when all fixtures in a gameweek are marked as `FINISHED`.\n\n## Audience\n\nAll users with picks in the gameweek.\n";
						const data = {title:"Gameweek Complete",description:"Notification sent when all matches in a gameweek have finished",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/gameweek-complete.md",
							rawData: "\ntitle: Gameweek Complete\ndescription: Notification sent when all matches in a gameweek have finished\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
