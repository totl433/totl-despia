import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"chat-message-notification\">Chat Message Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">chat-message</code><br>\n<strong>Owner:</strong> client-triggered<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">chat:{league_id}:{message_id}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>60 seconds</td></tr><tr><td>Cooldown</td><td>30 seconds per user</td></tr><tr><td>Quiet Hours</td><td>23:00 - 07:00</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">chat-messages</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">chat:{league_id}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">league:{league_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_chat</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when a user sends a message in league chat.</p>\n<h2 id=\"audience\">Audience</h2>\n<ul>\n<li>All league members except the sender</li>\n<li>Filtered by <code dir=\"auto\">chat-messages</code> preference</li>\n<li>Filtered by league mute settings</li>\n</ul>";

				const frontmatter = {"title":"Chat Message","description":"Notification sent when someone sends a message in league chat","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/chat-message.md";
				const url = undefined;
				function rawContent() {
					return "\n# Chat Message Notification\n\n**Notification Key:** `chat-message`  \n**Owner:** client-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `chat:{league_id}:{message_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 60 seconds |\n| Cooldown | 30 seconds per user |\n| Quiet Hours | 23:00 - 07:00 |\n| Preference Key | `chat-messages` |\n| Collapse ID | `chat:{league_id}` |\n| Thread ID | `league:{league_id}` |\n| Android Group | `totl_chat` |\n\n## Trigger\n\nTriggered when a user sends a message in league chat.\n\n## Audience\n\n- All league members except the sender\n- Filtered by `chat-messages` preference\n- Filtered by league mute settings\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"chat-message-notification","text":"Chat Message Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
