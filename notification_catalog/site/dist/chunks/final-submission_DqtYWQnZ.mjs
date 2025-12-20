const id = "notifications/final-submission.md";
						const collection = "docs";
						const slug = "notifications/final-submission";
						const body = "\n# Final Submission Notification\n\n**Notification Key:** `final-submission`  \n**Owner:** client-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `final_sub:{league_id}:{gw}` |\n| Dedupe Scope | per_league_per_gw |\n| TTL | 86400 seconds |\n| Collapse ID | `final_sub:{league_id}:{gw}` |\n| Thread ID | `league:{league_id}` |\n| Android Group | `totl_leagues` |\n\n## Trigger\n\nTriggered when the last member of a league submits their picks.\n\n## Audience\n\nAll league members.\n";
						const data = {title:"Final Submission",description:"Notification sent when all league members have submitted their picks",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/final-submission.md",
							rawData: "\ntitle: Final Submission\ndescription: Notification sent when all league members have submitted their picks\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
