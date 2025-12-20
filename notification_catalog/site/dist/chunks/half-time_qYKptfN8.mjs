import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"half-time-notification\">Half-Time Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">half-time</code><br>\n<strong>Owner:</strong> score-webhook<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">halftime:{api_match_id}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>600 seconds</td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">halftime:{api_match_id}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">match:{api_match_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_scores</code></td></tr></tbody></table>\n<p>Note: Half-time has no preference key - always sent.</p>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when match status changes to <code dir=\"auto\">PAUSED</code>.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>Users with picks for the fixture.</p>";

				const frontmatter = {"title":"Half-Time","description":"Notification sent at half-time with current score","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/half-time.md";
				const url = undefined;
				function rawContent() {
					return "\n# Half-Time Notification\n\n**Notification Key:** `half-time`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `halftime:{api_match_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 600 seconds |\n| Collapse ID | `halftime:{api_match_id}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_scores` |\n\nNote: Half-time has no preference key - always sent.\n\n## Trigger\n\nTriggered when match status changes to `PAUSED`.\n\n## Audience\n\nUsers with picks for the fixture.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"half-time-notification","text":"Half-Time Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
