import { d as createComponent, m as maybeRenderHead, u as unescapeHTML, h as renderTemplate } from './astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';

const html = "<h1 id=\"goal-scored-notification\">Goal Scored Notification</h1>\n<p><strong>Notification Key:</strong> <code dir=\"auto\">goal-scored</code><br>\n<strong>Owner:</strong> score-webhook<br>\n<strong>Status:</strong> Active</p>\n<h2 id=\"configuration\">Configuration</h2>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>Event ID Format</td><td><code dir=\"auto\">goal:{api_match_id}:{scorer_normalized}:{minute}</code></td></tr><tr><td>Dedupe Scope</td><td>per_user_per_event</td></tr><tr><td>TTL</td><td>120 seconds</td></tr><tr><td>Preference Key</td><td><code dir=\"auto\">score-updates</code></td></tr><tr><td>Collapse ID</td><td><code dir=\"auto\">goal:{api_match_id}</code></td></tr><tr><td>Thread ID</td><td><code dir=\"auto\">match:{api_match_id}</code></td></tr><tr><td>Android Group</td><td><code dir=\"auto\">totl_scores</code></td></tr></tbody></table>\n<h2 id=\"trigger\">Trigger</h2>\n<p>Triggered when live_scores is updated with a new goal.</p>\n<h2 id=\"audience\">Audience</h2>\n<p>Users with picks for the fixture.</p>";

				const frontmatter = {"title":"Goal Scored","description":"Notification sent when a goal is scored in a match","notification_key":"goal-scored","owner":"score-webhook","status":"active","channels":["push"],"audience":"users_with_picks_for_fixture","source":"supabase_webhook","trigger":{"name":"live_scores_update","event_id_format":"goal:{api_match_id}:{scorer_normalized}:{minute}"},"dedupe":{"scope":"per_user_per_event","ttl_seconds":120},"cooldown":{"per_user_seconds":0},"quiet_hours":{"start":null,"end":null},"preferences":{"preference_key":"score-updates","default":true},"onesignal":{"collapse_id_format":"goal:{api_match_id}","thread_id_format":"match:{api_match_id}","android_group_format":"totl_scores"},"deep_links":{"url_format":null},"rollout":{"enabled":true,"percentage":100}};
				const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/notifications/goal-scored.md";
				const url = undefined;
				function rawContent() {
					return "\n# Goal Scored Notification\n\n**Notification Key:** `goal-scored`  \n**Owner:** score-webhook  \n**Status:** Active  \n\n## Configuration\n\n| Field | Value |\n|-------|-------|\n| Event ID Format | `goal:{api_match_id}:{scorer_normalized}:{minute}` |\n| Dedupe Scope | per_user_per_event |\n| TTL | 120 seconds |\n| Preference Key | `score-updates` |\n| Collapse ID | `goal:{api_match_id}` |\n| Thread ID | `match:{api_match_id}` |\n| Android Group | `totl_scores` |\n\n## Trigger\n\nTriggered when live_scores is updated with a new goal.\n\n## Audience\n\nUsers with picks for the fixture.\n";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [{"depth":1,"slug":"goal-scored-notification","text":"Goal Scored Notification"},{"depth":2,"slug":"configuration","text":"Configuration"},{"depth":2,"slug":"trigger","text":"Trigger"},{"depth":2,"slug":"audience","text":"Audience"}];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`${maybeRenderHead()}${unescapeHTML(html)}`;
				});

export { Content, compiledContent, Content as default, file, frontmatter, getHeadings, rawContent, url };
