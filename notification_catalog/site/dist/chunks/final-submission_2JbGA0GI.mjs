import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"final-submission-notification\">Final Submission Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">final-submission</code><br>\n<strong>Owner:</strong> client-triggered<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">final_sub:{league_id}:{gw}</code></td></tr><tr><td>Dedupe Scope</td><td>per_league_per_gw</td></tr><tr><td>TTL</td><td>86400 seconds</td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">final_sub:{league_id}:{gw}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">league:{league_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_leagues</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when the last member of a league submits their picks.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>All league members.</p>";

				const frontmatter = {"title":"Final Submission","description":"Notification sent when all league members have submitted their picks","head":[]};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/final-submission.md";
				const url = undefined;
				function rawContent() {
					return "\n# Final Submission Notification\n\n**Notification Key:** `final-submission`  \n**Owner:** client-triggered  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `final_sub:{league_id}:{gw}` |\n| Dedupe Scope | per_league_per_gw |\n| TTL | 86400 seconds |\n| Collapse ID | `final_sub:{league_id}:{gw}` |\n| Thread ID | `league:{league_id}` |\n| Android Group | `totl_leagues` |\n\n## Trigger\n\nTriggered when the last member of a league submits their picks.\n\n## Audience\n\nAll league members.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"final-submission-notification","text":"Final Submission Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
