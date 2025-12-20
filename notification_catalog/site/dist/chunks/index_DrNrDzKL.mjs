const id = "index.mdx";
						const collection = "docs";
						const slug = "index";
						const body = "\nThis is the **source of truth** for all push notifications in the TOTL application.\n\n## Quick Links\n\n- [Architecture](/architecture/) - Understand how the notification system works\n- [Notifications](/notifications/goal-scored/) - Browse all notification types\n- [Templates](/templates/en/) - View notification message templates\n\n## Notification Types\n\n| Type | Status | Description |\n|------|--------|-------------|\n| `goal-scored` | ✅ Active | Goal scored in a match |\n| `goal-disallowed` | ✅ Active | VAR disallowed goal |\n| `kickoff` | ✅ Active | Match kickoff (1st/2nd half) |\n| `half-time` | ✅ Active | Half-time score update |\n| `final-whistle` | ✅ Active | Full-time result with pick outcome |\n| `gameweek-complete` | ✅ Active | All matches in GW finished |\n| `chat-message` | ✅ Active | League chat message |\n| `final-submission` | ✅ Active | All league members submitted picks |\n| `new-gameweek` | ✅ Active | New gameweek fixtures published |\n\n## Key Features\n\n- **Idempotency**: Every notification has a deterministic `event_id` to prevent duplicates\n- **Preference Enforcement**: All user preferences are enforced server-side\n- **Grouping**: OneSignal `collapse_id`, `thread_id`, and `android_group` are set on every push\n- **Audit Log**: Every send attempt is logged in `notification_send_log`\n- **Cooldowns**: Per-user cooldowns prevent notification spam\n";
						const data = {title:"TOTL Notification Catalog",description:"Source of truth for all push notifications in the TOTL app",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/index.mdx",
							rawData: "\ntitle: TOTL Notification Catalog\ndescription: Source of truth for all push notifications in the TOTL app\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
