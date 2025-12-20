import { i as createAstro, d as createComponent, m as maybeRenderHead, u as unescapeHTML, l as renderSlot, g as renderComponent, h as renderTemplate, k as addAttribute, F as Fragment, s as spreadAttributes, v as createVNode, _ as __astro_tag_component__ } from './astro_B9tGE1JN.mjs';
import { b as $$Icon, a as $$Image } from './pages/404_Blwuvgqv.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                                                            */
/* empty css                                                                */
import { select } from 'hast-util-select';
import { rehype } from 'rehype';
import { visit, CONTINUE, SKIP } from 'unist-util-visit';
/* empty css                                                            */
/* empty css                                                                */

const $$Astro$4 = createAstro();
const $$Card = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Card;
  const { icon, title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<article class="card sl-flex astro-v5tidmuc"> <p class="title sl-flex astro-v5tidmuc"> ${icon && renderTemplate`${renderComponent($$result, "Icon", $$Icon, { "name": icon, "class": "icon astro-v5tidmuc", "size": "1.333em" })}`} <span class="astro-v5tidmuc">${unescapeHTML(title)}</span> </p> <div class="body astro-v5tidmuc">${renderSlot($$result, $$slots["default"])}</div> </article> `;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/user-components/Card.astro", void 0);

const $$Astro$3 = createAstro();
const $$CardGrid = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$CardGrid;
  const { stagger = false } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute([["card-grid", { stagger }], "astro-zntqmydn"], "class:list")}>${renderSlot($$result, $$slots["default"])}</div> `;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/user-components/CardGrid.astro", void 0);

const TabItemTagname = "starlight-tab-item";
const focusableElementSelectors = [
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "area[href]",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]:not([disabled])"
].map((selector) => `${selector}:not([hidden]):not([tabindex="-1"])`).join(",");
let count = 0;
const getIDs = () => {
  const id = count++;
  return { panelId: "tab-panel-" + id, tabId: "tab-" + id };
};
const tabsProcessor = rehype().data("settings", { fragment: true }).use(function tabs() {
  return (tree, file) => {
    file.data.panels = [];
    let isFirst = true;
    visit(tree, "element", (node) => {
      if (node.tagName !== TabItemTagname || !node.properties) {
        return CONTINUE;
      }
      const { dataLabel } = node.properties;
      const ids = getIDs();
      file.data.panels?.push({
        ...ids,
        label: String(dataLabel)
      });
      delete node.properties.dataLabel;
      node.tagName = "section";
      node.properties.id = ids.panelId;
      node.properties["aria-labelledby"] = ids.tabId;
      node.properties.role = "tabpanel";
      const focusableChild = select(focusableElementSelectors, node);
      if (!focusableChild) {
        node.properties.tabindex = 0;
      }
      if (isFirst) {
        isFirst = false;
      } else {
        node.properties.hidden = true;
      }
      return SKIP;
    });
  };
});
const processPanels = (html) => {
  const file = tabsProcessor.processSync({ value: html });
  return {
    /** Data for each tab panel. */
    panels: file.data.panels,
    /** Processed HTML for the tab panels. */
    html: file.toString()
  };
};

const $$Astro$2 = createAstro();
const $$Tabs = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Tabs;
  const panelHtml = await Astro2.slots.render("default");
  const { html, panels } = processPanels(panelHtml);
  return renderTemplate`${renderComponent($$result, "starlight-tabs", "starlight-tabs", { "class": "astro-esqgolmp" }, { "default": () => renderTemplate` ${panels && renderTemplate`${maybeRenderHead()}<div class="tablist-wrapper not-content astro-esqgolmp"> <ul role="tablist" class="astro-esqgolmp"> ${panels.map(({ label, panelId, tabId }, idx) => renderTemplate`<li role="presentation" class="tab astro-esqgolmp"> <a role="tab"${addAttribute("#" + panelId, "href")}${addAttribute(tabId, "id")}${addAttribute(idx === 0 && "true", "aria-selected")}${addAttribute(idx !== 0 ? -1 : 0, "tabindex")} class="astro-esqgolmp"> ${label} </a> </li>`)} </ul> </div>`} ${renderComponent($$result, "Fragment", Fragment, {}, { "default": async ($$result2) => renderTemplate`${unescapeHTML(html)}` })} ` })}  `;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/user-components/Tabs.astro", void 0);

const $$Astro$1 = createAstro();
const $$TabItem = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$TabItem;
  const { label } = Astro2.props;
  if (!label) {
    throw new Error("Missing prop `label` on `<TabItem>` component.");
  }
  return renderTemplate`${renderComponent($$result, "TabItemTagname", TabItemTagname, { "data-label": label }, { "default": ($$result2) => renderTemplate` ${renderSlot($$result2, $$slots["default"])} ` })}`;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/user-components/TabItem.astro", void 0);

const $$Astro = createAstro();
const $$LinkCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$LinkCard;
  const { title, description, ...attributes } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="astro-mf7fz2mj"> <span class="sl-flex stack astro-mf7fz2mj"> <a${spreadAttributes(attributes, void 0, { "class": "astro-mf7fz2mj" })}> <span class="title astro-mf7fz2mj">${unescapeHTML(title)}</span> </a> ${description && renderTemplate`<span class="description astro-mf7fz2mj">${unescapeHTML(description)}</span>`} </span> ${renderComponent($$result, "Icon", $$Icon, { "name": "right-arrow", "size": "1.333em", "class": "icon rtl:flip astro-mf7fz2mj" })} </div> `;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/user-components/LinkCard.astro", void 0);

const frontmatter = {
  "title": "Test Notifications",
  "description": "Send test notifications to specific users",
  "head": []
};
function getHeadings() {
  return [{
    "depth": 1,
    "slug": "-notification-testing-console",
    "text": "\u{1F9EA} Notification Testing Console"
  }, {
    "depth": 2,
    "slug": "how-it-works",
    "text": "How It Works"
  }, {
    "depth": 3,
    "slug": "notes",
    "text": "Notes"
  }, {
    "depth": 3,
    "slug": "finding-user-uuids",
    "text": "Finding User UUIDs"
  }];
}
const __usesAstroImage = true;
function _createMdxContent(props) {
  const _components = {
    button: "button",
    code: "code",
    div: "div",
    figcaption: "figcaption",
    figure: "figure",
    h1: "h1",
    h2: "h2",
    h3: "h3",
    hr: "hr",
    li: "li",
    link: "link",
    ol: "ol",
    p: "p",
    pre: "pre",
    script: "script",
    span: "span",
    strong: "strong",
    ul: "ul",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.h1, {
      id: "-notification-testing-console",
      children: "\u{1F9EA} Notification Testing Console"
    }), "\n", createVNode(_components.p, {
      children: "Send test push notifications to any user. Perfect for debugging and QA testing."
    }), "\n", createVNode("div", {
      id: "notification-tester",
      style: "margin-top: 2rem;",
      children: [createVNode("div", {
        style: "margin-bottom: 1.5rem;",
        children: [createVNode("label", {
          for: "notification-type",
          style: "display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--sl-color-white);",
          children: createVNode(_components.p, {
            children: "Notification Type"
          })
        }), createVNode("select", {
          id: "notification-type",
          style: "width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; background: var(--sl-color-gray-6); border: 1px solid var(--sl-color-gray-5); color: var(--sl-color-white); font-size: 1rem; cursor: pointer;",
          children: [createVNode("option", {
            value: "",
            children: "\u2014 Select notification type \u2014"
          }), createVNode("optgroup", {
            label: "Score Notifications",
            children: [createVNode("option", {
              value: "goal-scored",
              children: "\u26BD Goal Scored"
            }), createVNode("option", {
              value: "goal-disallowed",
              children: "\u274C Goal Disallowed"
            }), createVNode("option", {
              value: "kickoff",
              children: "\u{1F7E2} Kickoff"
            }), createVNode("option", {
              value: "half-time",
              children: "\u23F8\uFE0F Half-Time"
            }), createVNode("option", {
              value: "final-whistle",
              children: "\u{1F3C1} Final Whistle"
            }), createVNode("option", {
              value: "gameweek-complete",
              children: "\u{1F389} Gameweek Complete"
            })]
          }), createVNode("optgroup", {
            label: "Other Notifications",
            children: [createVNode("option", {
              value: "chat-message",
              children: "\u{1F4AC} Chat Message"
            }), createVNode("option", {
              value: "final-submission",
              children: "\u2705 Final Submission"
            }), createVNode("option", {
              value: "new-gameweek",
              children: "\u{1F195} New Gameweek"
            })]
          })]
        })]
      }), createVNode("div", {
        style: "margin-bottom: 1.5rem;",
        children: [createVNode("label", {
          for: "user-uuid",
          style: "display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--sl-color-white);",
          children: createVNode(_components.p, {
            children: "User UUID"
          })
        }), createVNode("input", {
          type: "text",
          id: "user-uuid",
          placeholder: "e.g., 123e4567-e89b-12d3-a456-426614174000",
          style: "width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; background: var(--sl-color-gray-6); border: 1px solid var(--sl-color-gray-5); color: var(--sl-color-white); font-size: 1rem; font-family: monospace;"
        }), createVNode("p", {
          style: "margin-top: 0.25rem; font-size: 0.85rem; color: var(--sl-color-gray-3);",
          children: createVNode(_components.p, {
            children: "The Supabase user ID to send the notification to"
          })
        })]
      }), createVNode("div", {
        style: "margin-bottom: 1.5rem;",
        children: [createVNode("button", {
          id: "fill-btn",
          style: "padding: 0.5rem 1rem; border-radius: 0.5rem; background: var(--sl-color-gray-5); color: var(--sl-color-white); font-weight: 500; font-size: 0.9rem; border: 1px solid var(--sl-color-gray-4); cursor: pointer; transition: all 0.2s; margin-right: 0.5rem;",
          children: createVNode(_components.p, {
            children: "\u26A1 Fill Test Data"
          })
        }), createVNode("button", {
          id: "clear-btn",
          style: "padding: 0.5rem 1rem; border-radius: 0.5rem; background: transparent; color: var(--sl-color-gray-3); font-weight: 500; font-size: 0.9rem; border: 1px solid var(--sl-color-gray-5); cursor: pointer; transition: all 0.2s;",
          children: createVNode(_components.p, {
            children: "\u{1F5D1}\uFE0F Clear All"
          })
        })]
      }), createVNode("div", {
        id: "params-container",
        style: "margin-bottom: 1.5rem; display: none;",
        children: [createVNode("div", {
          style: "display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;",
          children: [createVNode("span", {
            style: "font-weight: 600; color: var(--sl-color-white);",
            children: "Parameters"
          }), createVNode("span", {
            style: "font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--sl-color-accent); color: white; border-radius: 0.25rem;",
            children: "Required"
          })]
        }), createVNode("div", {
          id: "params-fields",
          style: "display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
        })]
      }), createVNode("div", {
        id: "env-selector",
        style: "margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); font-size: 0.85rem;",
        children: [createVNode("label", {
          style: "color: var(--sl-color-gray-2); margin-right: 0.5rem;",
          children: "Target Server:"
        }), createVNode("select", {
          id: "env-target",
          style: "padding: 0.25rem 0.5rem; border-radius: 0.25rem; background: var(--sl-color-gray-6); border: 1px solid var(--sl-color-gray-5); color: var(--sl-color-white); font-size: 0.85rem;",
          children: [createVNode("option", {
            value: "staging",
            children: "\u{1F7E1} Staging (totl-staging.netlify.app)"
          }), createVNode("option", {
            value: "prod",
            children: "\u{1F7E2} Production (totl.app)"
          }), createVNode("option", {
            value: "local",
            children: "\u26AA Local (localhost:8888)"
          })]
        })]
      }), createVNode("button", {
        id: "send-btn",
        disabled: true,
        style: "width: 100%; padding: 1rem 1.5rem; border-radius: 0.5rem; background: var(--sl-color-accent); color: white; font-weight: 600; font-size: 1rem; border: none; cursor: pointer; transition: all 0.2s; opacity: 0.5;",
        children: createVNode(_components.p, {
          children: "\u{1F680} Send Test Notification"
        })
      }), createVNode("div", {
        id: "result-container",
        style: "margin-top: 1.5rem; display: none;",
        children: createVNode("div", {
          id: "result-content",
          style: "padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.9rem;"
        })
      })]
    }), "\n", createVNode("script", {
      children: `
(function() {
// Test data for quick fill
const testData = {
  'goal-scored': {
    api_match_id: 12345,
    fixture_index: 0,
    gw: 16,
    scorer: 'Marcus Rashford',
    minute: 52,
    team_name: 'Man United',
    home_team: 'Man United',
    away_team: 'Liverpool',
    home_score: 2,
    away_score: 1,
  },
  'goal-disallowed': {
    api_match_id: 12345,
    minute: 67,
    team_name: 'Arsenal',
  },
  'kickoff': {
    api_match_id: 12345,
    fixture_index: 0,
    gw: 16,
    half: 1,
    home_team: 'Chelsea',
    away_team: 'Tottenham',
  },
  'half-time': {
    api_match_id: 12345,
    fixture_index: 0,
    gw: 16,
    home_team: 'Chelsea',
    away_team: 'Tottenham',
    home_score: 1,
    away_score: 1,
  },
  'final-whistle': {
    api_match_id: 12345,
    fixture_index: 0,
    gw: 16,
    home_team: 'Chelsea',
    away_team: 'Tottenham',
    home_score: 2,
    away_score: 0,
  },
  'gameweek-complete': {
    gw: 16,
  },
  'chat-message': {
    league_id: 'test-league-123',
    message_id: 'msg-456',
    sender_name: 'John',
    content: 'Good luck this week everyone! \u{1F340}',
  },
  'final-submission': {
    league_id: 'test-league-123',
    gw: 16,
  },
  'new-gameweek': {
    gw: 17,
  },
};

// Parameter definitions for each notification type
const paramDefs = {
  'goal-scored': [
    { name: 'api_match_id', label: 'Match ID', type: 'number', placeholder: '12345' },
    { name: 'fixture_index', label: 'Fixture Index', type: 'number', placeholder: '0' },
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
    { name: 'scorer', label: 'Scorer Name', type: 'text', placeholder: 'Marcus Rashford' },
    { name: 'minute', label: 'Minute', type: 'number', placeholder: '52' },
    { name: 'team_name', label: 'Scoring Team', type: 'text', placeholder: 'Man United' },
    { name: 'home_team', label: 'Home Team', type: 'text', placeholder: 'Man United' },
    { name: 'away_team', label: 'Away Team', type: 'text', placeholder: 'Liverpool' },
    { name: 'home_score', label: 'Home Score', type: 'number', placeholder: '2' },
    { name: 'away_score', label: 'Away Score', type: 'number', placeholder: '1' },
  ],
  'goal-disallowed': [
    { name: 'api_match_id', label: 'Match ID', type: 'number', placeholder: '12345' },
    { name: 'minute', label: 'Minute', type: 'number', placeholder: '67' },
    { name: 'team_name', label: 'Team Name', type: 'text', placeholder: 'Arsenal' },
  ],
  'kickoff': [
    { name: 'api_match_id', label: 'Match ID', type: 'number', placeholder: '12345' },
    { name: 'fixture_index', label: 'Fixture Index', type: 'number', placeholder: '0' },
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
    { name: 'half', label: 'Half (1 or 2)', type: 'number', placeholder: '1' },
    { name: 'home_team', label: 'Home Team', type: 'text', placeholder: 'Chelsea' },
    { name: 'away_team', label: 'Away Team', type: 'text', placeholder: 'Tottenham' },
  ],
  'half-time': [
    { name: 'api_match_id', label: 'Match ID', type: 'number', placeholder: '12345' },
    { name: 'fixture_index', label: 'Fixture Index', type: 'number', placeholder: '0' },
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
    { name: 'home_team', label: 'Home Team', type: 'text', placeholder: 'Chelsea' },
    { name: 'away_team', label: 'Away Team', type: 'text', placeholder: 'Tottenham' },
    { name: 'home_score', label: 'Home Score', type: 'number', placeholder: '1' },
    { name: 'away_score', label: 'Away Score', type: 'number', placeholder: '1' },
  ],
  'final-whistle': [
    { name: 'api_match_id', label: 'Match ID', type: 'number', placeholder: '12345' },
    { name: 'fixture_index', label: 'Fixture Index', type: 'number', placeholder: '0' },
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
    { name: 'home_team', label: 'Home Team', type: 'text', placeholder: 'Chelsea' },
    { name: 'away_team', label: 'Away Team', type: 'text', placeholder: 'Tottenham' },
    { name: 'home_score', label: 'Home Score', type: 'number', placeholder: '2' },
    { name: 'away_score', label: 'Away Score', type: 'number', placeholder: '0' },
  ],
  'gameweek-complete': [
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
  ],
  'chat-message': [
    { name: 'league_id', label: 'League ID', type: 'text', placeholder: 'league-uuid-here' },
    { name: 'message_id', label: 'Message ID', type: 'text', placeholder: 'msg-123' },
    { name: 'sender_name', label: 'Sender Name', type: 'text', placeholder: 'John' },
    { name: 'content', label: 'Message Content', type: 'text', placeholder: 'Good luck this week!' },
  ],
  'final-submission': [
    { name: 'league_id', label: 'League ID', type: 'text', placeholder: 'league-uuid-here' },
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '16' },
  ],
  'new-gameweek': [
    { name: 'gw', label: 'Gameweek', type: 'number', placeholder: '17' },
  ],
};

const typeSelect = document.getElementById('notification-type');
const userInput = document.getElementById('user-uuid');
const paramsContainer = document.getElementById('params-container');
const paramsFields = document.getElementById('params-fields');
const sendBtn = document.getElementById('send-btn');
const fillBtn = document.getElementById('fill-btn');
const clearBtn = document.getElementById('clear-btn');
const resultContainer = document.getElementById('result-container');
const resultContent = document.getElementById('result-content');

// Validate UUID format
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Update send button state
function updateSendButton() {
  const hasType = typeSelect.value !== '';
  const hasUUID = isValidUUID(userInput.value.trim());
  sendBtn.disabled = !(hasType && hasUUID);
  sendBtn.style.opacity = sendBtn.disabled ? '0.5' : '1';
  sendBtn.style.cursor = sendBtn.disabled ? 'not-allowed' : 'pointer';
}

// Render parameter fields
function renderParams(type) {
  const params = paramDefs[type] || [];
  
  if (params.length === 0) {
    paramsContainer.style.display = 'none';
    return;
  }
  
  paramsContainer.style.display = 'block';
  paramsFields.innerHTML = params.map(p => \`
    <div>
      <label for="param-\${p.name}" style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: var(--sl-color-gray-2);">
        \${p.label}
      </label>
      <input 
        type="\${p.type}" 
        id="param-\${p.name}" 
        data-param="\${p.name}"
        placeholder="\${p.placeholder}"
        style="width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.375rem; background: var(--sl-color-gray-6); border: 1px solid var(--sl-color-gray-5); color: var(--sl-color-white); font-size: 0.9rem;"
      />
    </div>
  \`).join('');
}

// Collect parameter values
function collectParams() {
  const params = {};
  document.querySelectorAll('[data-param]').forEach(input => {
    const name = input.dataset.param;
    const value = input.value.trim();
    if (value) {
      params[name] = input.type === 'number' ? Number(value) : value;
    }
  });
  return params;
}

// Show result
function showResult(success, data) {
  resultContainer.style.display = 'block';
  
  if (success) {
    resultContent.style.background = 'rgba(34, 197, 94, 0.15)';
    resultContent.style.border = '1px solid rgba(34, 197, 94, 0.3)';
    resultContent.innerHTML = \`
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <span style="font-size: 1.25rem;">\u2705</span>
        <strong style="color: #22c55e;">Notification Sent!</strong>
      </div>
      <div style="color: var(--sl-color-gray-2); font-size: 0.85rem;">
        <p style="margin: 0.25rem 0;"><strong>Type:</strong> \${data.notification_type}</p>
        <p style="margin: 0.25rem 0;"><strong>Title:</strong> \${data.title}</p>
        <p style="margin: 0.25rem 0;"><strong>Body:</strong> \${data.body}</p>
        <p style="margin: 0.25rem 0;"><strong>Event ID:</strong> <code>\${data.event_id}</code></p>
        \${data.user_result?.onesignal_notification_id 
          ? \`<p style="margin: 0.25rem 0;"><strong>OneSignal ID:</strong> <code>\${data.user_result.onesignal_notification_id}</code></p>\`
          : ''
        }
        <p style="margin: 0.25rem 0;"><strong>Result:</strong> \${data.user_result?.result || 'unknown'}</p>
      </div>
    \`;
  } else {
    resultContent.style.background = 'rgba(239, 68, 68, 0.15)';
    resultContent.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    resultContent.innerHTML = \`
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <span style="font-size: 1.25rem;">\u274C</span>
        <strong style="color: #ef4444;">Failed to Send</strong>
      </div>
      <div style="color: var(--sl-color-gray-2); font-size: 0.85rem;">
        <p style="margin: 0.25rem 0;"><strong>Error:</strong> \${data.error || 'Unknown error'}</p>
        \${data.details ? \`<p style="margin: 0.25rem 0;"><strong>Details:</strong> \${data.details}</p>\` : ''}
        \${data.user_result?.reason ? \`<p style="margin: 0.25rem 0;"><strong>Reason:</strong> \${data.user_result.reason}</p>\` : ''}
      </div>
    \`;
  }
}

// Send notification
async function sendNotification() {
  const notificationType = typeSelect.value;
  const userId = userInput.value.trim();
  const params = collectParams();

  // Update button state
  sendBtn.disabled = true;
  sendBtn.innerHTML = '\u23F3 Sending...';
  sendBtn.style.opacity = '0.7';
  resultContainer.style.display = 'none';

  // Get target server from dropdown
  const envTarget = document.getElementById('env-target');
  const selectedEnv = envTarget.value;
  
  let baseUrl = '';
  if (selectedEnv === 'staging') {
    baseUrl = 'https://totl-staging.netlify.app';
  } else if (selectedEnv === 'prod') {
    baseUrl = 'https://totl.app';
  } else if (selectedEnv === 'local') {
    baseUrl = 'http://localhost:8888';
  }

  try {
    const response = await fetch(baseUrl + '/.netlify/functions/sendTestNotification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_type: notificationType,
        user_id: userId,
        params,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      showResult(true, data);
    } else {
      showResult(false, data);
    }
  } catch (error) {
    showResult(false, { error: error.message });
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '\u{1F680} Send Test Notification';
    updateSendButton();
  }
}

// Fill with test data
function fillTestData() {
  const type = typeSelect.value;
  if (!type) {
    // If no type selected, select goal-scored as default
    typeSelect.value = 'goal-scored';
    renderParams('goal-scored');
  }
  
  const currentType = typeSelect.value;
  const data = testData[currentType];
  
  if (data) {
    // Fill parameter fields
    Object.entries(data).forEach(([key, value]) => {
      const input = document.querySelector(\`[data-param="\${key}"]\`);
      if (input) {
        input.value = value;
      }
    });
  }
  
  // Fill a placeholder UUID if empty (user should replace with real one)
  if (!userInput.value.trim()) {
    userInput.value = '00000000-0000-0000-0000-000000000000';
    userInput.select(); // Highlight so user knows to replace it
  }
  
  updateSendButton();
}

// Clear all fields
function clearAll() {
  typeSelect.value = '';
  userInput.value = '';
  paramsContainer.style.display = 'none';
  paramsFields.innerHTML = '';
  resultContainer.style.display = 'none';
  updateSendButton();
}

// Event listeners
typeSelect.addEventListener('change', (e) => {
  renderParams(e.target.value);
  updateSendButton();
});

userInput.addEventListener('input', updateSendButton);

sendBtn.addEventListener('click', sendNotification);
fillBtn.addEventListener('click', fillTestData);
clearBtn.addEventListener('click', clearAll);

// Initialize
updateSendButton();
})();
`
    }), "\n", createVNode(_components.hr, {}), "\n", createVNode(_components.h2, {
      id: "how-it-works",
      children: "How It Works"
    }), "\n", createVNode(_components.ol, {
      children: ["\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Select a notification type"
        }), " from the dropdown"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Enter the target user\u2019s UUID"
        }), " (from Supabase)"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Fill in the parameters"
        }), " relevant to that notification type"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Click Send"
        }), " to trigger the notification"]
      }), "\n"]
    }), "\n", createVNode(_components.h3, {
      id: "notes",
      children: "Notes"
    }), "\n", createVNode(_components.ul, {
      children: ["\n", createVNode(_components.li, {
        children: ["Test notifications ", createVNode(_components.strong, {
          children: "bypass preference and cooldown checks"
        }), " so they always send"]
      }), "\n", createVNode(_components.li, {
        children: ["Each test notification gets a unique ", createVNode(_components.code, {
          dir: "auto",
          children: "event_id"
        }), " with a timestamp suffix"]
      }), "\n", createVNode(_components.li, {
        children: ["All test notifications include ", createVNode(_components.code, {
          dir: "auto",
          children: "is_test: true"
        }), " in their data payload"]
      }), "\n", createVNode(_components.li, {
        children: ["Check the ", createVNode(_components.code, {
          dir: "auto",
          children: "notification_send_log"
        }), " table to see the audit trail"]
      }), "\n"]
    }), "\n", createVNode(_components.h3, {
      id: "finding-user-uuids",
      children: "Finding User UUIDs"
    }), "\n", createVNode(_components.p, {
      children: "To find a user\u2019s UUID, query Supabase:"
    }), "\n", createVNode(_components.div, {
      class: "expressive-code",
      children: [createVNode(_components.link, {
        rel: "stylesheet",
        href: "/_astro/ec.0epgx.css"
      }), createVNode(_components.script, {
        type: "module",
        src: "/_astro/ec.sgewm.js"
      }), createVNode(_components.figure, {
        class: "frame not-content",
        children: [createVNode(_components.figcaption, {
          class: "header"
        }), createVNode(_components.pre, {
          tabindex: "0",
          dir: "ltr",
          children: createVNode(_components.code, {
            children: createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "SELECT"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " id, email "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "FROM"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#82AAFF",
                  "--1": "#3B61B0"
                },
                children: "auth"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: "."
              }), createVNode(_components.span, {
                style: {
                  "--0": "#82AAFF",
                  "--1": "#3B61B0"
                },
                children: "users"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "WHERE"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " email ILIKE "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D9F5DD",
                  "--1": "#111111"
                },
                children: "'"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#ECC48D",
                  "--1": "#984E4D"
                },
                children: "%example%"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D9F5DD",
                  "--1": "#111111"
                },
                children: "'"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: ";"
              })]
            })
          })
        }), createVNode(_components.div, {
          class: "copy",
          children: createVNode(_components.button, {
            title: "Copy to clipboard",
            "data-copied": "Copied!",
            "data-code": "SELECT id, email FROM auth.users WHERE email ILIKE '%example%';",
            children: createVNode(_components.div, {})
          })
        })]
      })]
    }), "\n", createVNode(_components.p, {
      children: ["Or check the ", createVNode(_components.code, {
        dir: "auto",
        children: "push_subscriptions"
      }), " table:"]
    }), "\n", createVNode(_components.div, {
      class: "expressive-code",
      children: createVNode(_components.figure, {
        class: "frame not-content",
        children: [createVNode(_components.figcaption, {
          class: "header"
        }), createVNode(_components.pre, {
          tabindex: "0",
          dir: "ltr",
          children: createVNode(_components.code, {
            children: [createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "SELECT DISTINCT"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " user_id, created_at"
              })]
            }), createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "FROM"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " push_subscriptions"
              })]
            }), createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "WHERE"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " is_active "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " true"
              })]
            }), createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "ORDER BY"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " created_at "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "DESC"
              })]
            }), createVNode(_components.div, {
              class: "ec-line",
              children: [createVNode(_components.span, {
                style: {
                  "--0": "#C792EA",
                  "--1": "#8844AE"
                },
                children: "LIMIT"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: " "
              }), createVNode(_components.span, {
                style: {
                  "--0": "#F78C6C",
                  "--1": "#AA0982"
                },
                children: "10"
              }), createVNode(_components.span, {
                style: {
                  "--0": "#D6DEEB",
                  "--1": "#403F53"
                },
                children: ";"
              })]
            })]
          })
        }), createVNode(_components.div, {
          class: "copy",
          children: createVNode(_components.button, {
            title: "Copy to clipboard",
            "data-copied": "Copied!",
            "data-code": "SELECT DISTINCT user_id, created_at\x7FFROM push_subscriptions\x7FWHERE is_active = true\x7FORDER BY created_at DESC\x7FLIMIT 10;",
            children: createVNode(_components.div, {})
          })
        })]
      })
    })]
  });
}
function MDXContent(props = {}) {
  const {
    wrapper: MDXLayout
  } = props.components || {};
  return MDXLayout ? createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
__astro_tag_component__(getHeadings, "astro:jsx");
__astro_tag_component__(MDXContent, "astro:jsx");
const url = "src/content/docs/test.mdx";
const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/test.mdx";
const Content = (props = {}) => MDXContent({
											...props,
											components: { Fragment, ...props.components, "astro-image":  props.components?.img ?? $$Image },
										});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/test.mdx";

export { Content, __usesAstroImage, Content as default, file, frontmatter, getHeadings, url };
