const id = "notifications/new-gameweek.md";
						const collection = "docs";
						const slug = "notifications/new-gameweek";
						const body = "\n# New Gameweek Notification\n\n**Notification Key:** `new-gameweek`  \n**Owner:** admin-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `new_gw:{gw}` |\n| Dedupe Scope | global |\n| TTL | 86400 seconds |\n| Preference Key | `new-gameweek` |\n| Collapse ID | `new_gw:{gw}` |\n| Thread ID | `totl_gameweek` |\n| Android Group | `totl_gameweek` |\n\n## Trigger\n\nTriggered manually by admin when new gameweek fixtures are published.\n\n## Audience\n\nAll subscribed users.\n";
						const data = {title:"New Gameweek",description:"Broadcast notification when new gameweek fixtures are published",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/new-gameweek.md",
							rawData: "\ntitle: New Gameweek\ndescription: Broadcast notification when new gameweek fixtures are published\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
