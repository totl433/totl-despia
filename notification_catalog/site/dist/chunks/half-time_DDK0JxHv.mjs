const id = "notifications/half-time.md";
						const collection = "docs";
						const slug = "notifications/half-time";
						const body = "\n# Half-Time Notification\n\n**Notification Key:** `half-time`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `halftime:{api_match_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 600 seconds |\n| Collapse ID | `halftime:{api_match_id}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_scores` |\n\nNote: Half-time has no preference key - always sent.\n\n## Trigger\n\nTriggered when match status changes to `PAUSED`.\n\n## Audience\n\nUsers with picks for the fixture.\n";
						const data = {title:"Half-Time",description:"Notification sent at half-time with current score",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/half-time.md",
							rawData: "\ntitle: Half-Time\ndescription: Notification sent at half-time with current score\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
