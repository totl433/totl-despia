import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"gameweek-complete-notification\">Gameweek Complete Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">gameweek-complete</code><br>\n<strong>Owner:</strong> score-webhook<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">gw_complete:{gw}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>7200 seconds</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">gw-results</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">gw_complete:{gw}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">totl_gameweek</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_results</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when all fixtures in a gameweek are marked as <code dir=\"auto\">FINISHED</code>.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>All users with picks in the gameweek.</p>";

				const frontmatter = {"title":"Gameweek Complete","description":"Notification sent when all matches in a gameweek have finished","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/gameweek-complete.md";
				const url = undefined;
				function rawContent() {
					return "\n# Gameweek Complete Notification\n\n**Notification Key:** `gameweek-complete`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `gw_complete:{gw}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 7200 seconds |\n| Preference Key | `gw-results` |\n| Collapse ID | `gw_complete:{gw}` |\n| Thread ID | `totl_gameweek` |\n| Android Group | `totl_results` |\n\n## Trigger\n\nTriggered when all fixtures in a gameweek are marked as `FINISHED`.\n\n## Audience\n\nAll users with picks in the gameweek.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"gameweek-complete-notification","text":"Gameweek Complete Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
