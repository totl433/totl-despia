import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"kickoff-notification\">Kickoff Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">kickoff</code><br>\n<strong>Owner:</strong> score-webhook<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">kickoff:{api_match_id}:{half}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>300 seconds</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">score-updates</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">kickoff:{api_match_id}:{half}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">match:{api_match_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_scores</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when match status changes to <code dir=\"auto\">IN_PLAY</code>.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>Users with picks for the fixture.</p>";

				const frontmatter = {"title":"Kickoff","description":"Notification sent when a match kicks off (1st or 2nd half)","notification_key":"kickoff","owner":"score-webhook","status":"active","channels":["push"],"audience":"users_with_picks_for_fixture","source":"supabase_webhook","trigger":{"name":"live_scores_status_change","event_id_format":"kickoff:{api_match_id}:{half}"},"dedupe":{"scope":"per_user_per_event","ttl_seconds":300},"cooldown":{"per_user_seconds":0},"quiet_hours":{"start":null,"end":null},"preferences":{"preference_key":"score-updates","default":true},"onesignal":{"collapse_id_format":"kickoff:{api_match_id}:{half}","thread_id_format":"match:{api_match_id}","android_group_format":"totl_scores"},"deep_links":{"url_format":null},"rollout":{"enabled":true,"percentage":100}};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/kickoff.md";
				const url = undefined;
				function rawContent() {
					return "\n# Kickoff Notification\n\n**Notification Key:** `kickoff`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `kickoff:{api_match_id}:{half}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 300 seconds |\n| Preference Key | `score-updates` |\n| Collapse ID | `kickoff:{api_match_id}:{half}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_scores` |\n\n## Trigger\n\nTriggered when match status changes to `IN_PLAY`.\n\n## Audience\n\nUsers with picks for the fixture.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"kickoff-notification","text":"Kickoff Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
