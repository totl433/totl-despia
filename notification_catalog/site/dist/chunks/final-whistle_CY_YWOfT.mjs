import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"final-whistle-notification\">Final Whistle Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">final-whistle</code><br>\n<strong>Owner:</strong> score-webhook<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">ft:{api_match_id}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>3600 seconds</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">final-whistle</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">ft:{api_match_id}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">match:{api_match_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_results</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when match status changes to <code dir=\"auto\">FINISHED</code>.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>Users with picks for the fixture, personalized by pick result (correct/wrong).</p>";

				const frontmatter = {"title":"Final Whistle","description":"Notification sent when a match finishes with pick result","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/final-whistle.md";
				const url = undefined;
				function rawContent() {
					return "\n# Final Whistle Notification\n\n**Notification Key:** `final-whistle`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `ft:{api_match_id}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 3600 seconds |\n| Preference Key | `final-whistle` |\n| Collapse ID | `ft:{api_match_id}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_results` |\n\n## Trigger\n\nTriggered when match status changes to `FINISHED`.\n\n## Audience\n\nUsers with picks for the fixture, personalized by pick result (correct/wrong).\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"final-whistle-notification","text":"Final Whistle Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
