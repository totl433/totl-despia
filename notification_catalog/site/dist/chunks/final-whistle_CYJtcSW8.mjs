const id = "notifications/final-whistle.md";
						const collection = "docs";
						const slug = "notifications/final-whistle";
						const body = "\n# Final Whistle Notification\n\n**Notification Key:** `final-whistle`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `ft:{api_match_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 3600 seconds |\n| Preference Key | `final-whistle` |\n| Collapse ID | `ft:{api_match_id}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_results` |\n\n## Trigger\n\nTriggered when match status changes to `FINISHED`.\n\n## Audience\n\nUsers with picks for the fixture, personalized by pick result (correct/wrong).\n";
						const data = {title:"Final Whistle",description:"Notification sent when a match finishes with pick result",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/final-whistle.md",
							rawData: "\ntitle: Final Whistle\ndescription: Notification sent when a match finishes with pick result\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
