import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"new-gameweek-notification\">New Gameweek Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">new-gameweek</code><br>\n<strong>Owner:</strong> admin-triggered<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">new_gw:{gw}</code></td></tr><tr><td>Dedupe Scope</td><td>global</td></tr><tr><td>TTL</td><td>86400 seconds</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">new-gameweek</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">new_gw:{gw}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">totl_gameweek</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_gameweek</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered manually by admin when new gameweek fixtures are published.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>All subscribed users.</p>";

				const frontmatter = {"title":"New Gameweek","description":"Broadcast notification when new gameweek fixtures are published","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/new-gameweek.md";
				const url = undefined;
				function rawContent() {
					return "\n# New Gameweek Notification\n\n**Notification Key:** `new-gameweek`  \n**Owner:** admin-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `new_gw:{gw}` |\n| Dedupe Scope | global |\n| TTL | 86400 seconds |\n| Preference Key | `new-gameweek` |\n| Collapse ID | `new_gw:{gw}` |\n| Thread ID | `totl_gameweek` |\n| Android Group | `totl_gameweek` |\n\n## Trigger\n\nTriggered manually by admin when new gameweek fixtures are published.\n\n## Audience\n\nAll subscribed users.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"new-gameweek-notification","text":"New Gameweek Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
