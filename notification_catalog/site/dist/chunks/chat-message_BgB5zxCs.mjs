const id = "notifications/chat-message.md";
						const collection = "docs";
						const slug = "notifications/chat-message";
						const body = "\n# Chat Message Notification\n\n**Notification Key:** `chat-message`  \n**Owner:** client-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `chat:{league_id}:{message_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 60 seconds |\n| Cooldown | 30 seconds per user |\n| Quiet Hours | 23:00 - 07:00 |\n| Preference Key | `chat-messages` |\n| Collapse ID | `chat:{league_id}` |\n| Thread ID | `league:{league_id}` |\n| Android Group | `totl_chat` |\n\n## Trigger\n\nTriggered when a user sends a message in league chat.\n\n## Audience\n\n- All league members except the sender\n- Filtered by `chat-messages` preference\n- Filtered by league mute settings\n";
						const data = {title:"Chat Message",description:"Notification sent when someone sends a message in league chat",head:[]};
						const _internal = {
							type: 'content',
							filePath: "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/chat-message.md",
							rawData: "\ntitle: Chat Message\ndescription: Notification sent when someone sends a message in league chat\nhead: []",
						};

export { _internal, body, collection, data, id, slug };
