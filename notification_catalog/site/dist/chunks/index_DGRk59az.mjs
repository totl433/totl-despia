import { v as createVNode, F as Fragment, _ as __astro_tag_component__ } from './astro_B9tGE1JN.mjs';
import { a as $$Image } from './pages/404_Blwuvgqv.mjs';
import 'clsx';

const frontmatter = {
  "title": "TOTL Notification Catalog",
  "description": "Source of truth for all push notifications in the TOTL app",
  "head": []
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "quick-links",
    "text": "Quick Links"
  }, {
    "depth": 2,
    "slug": "notification-types",
    "text": "Notification Types"
  }, {
    "depth": 2,
    "slug": "key-features",
    "text": "Key Features"
  }];
}
const __usesAstroImage = true;
function _createMdxContent(props) {
  const _components = {
    a: "a",
    code: "code",
    h2: "h2",
    li: "li",
    p: "p",
    strong: "strong",
    table: "table",
    tbody: "tbody",
    td: "td",
    th: "th",
    thead: "thead",
    tr: "tr",
    ul: "ul",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: ["This is the ", createVNode(_components.strong, {
        children: "source of truth"
      }), " for all push notifications in the TOTL application."]
    }), "\n", createVNode(_components.h2, {
      id: "quick-links",
      children: "Quick Links"
    }), "\n", createVNode(_components.ul, {
      children: ["\n", createVNode(_components.li, {
        children: [createVNode(_components.a, {
          href: "/architecture/",
          children: "Architecture"
        }), " - Understand how the notification system works"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.a, {
          href: "/notifications/goal-scored/",
          children: "Notifications"
        }), " - Browse all notification types"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.a, {
          href: "/templates/en/",
          children: "Templates"
        }), " - View notification message templates"]
      }), "\n"]
    }), "\n", createVNode(_components.h2, {
      id: "notification-types",
      children: "Notification Types"
    }), "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n", createVNode(_components.table, {
      children: [createVNode(_components.thead, {
        children: createVNode(_components.tr, {
          children: [createVNode(_components.th, {
            children: "Type"
          }), createVNode(_components.th, {
            children: "Status"
          }), createVNode(_components.th, {
            children: "Description"
          })]
        })
      }), createVNode(_components.tbody, {
        children: [createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "goal-scored"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "Goal scored in a match"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "goal-disallowed"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "VAR disallowed goal"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "kickoff"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "Match kickoff (1st/2nd half)"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "half-time"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "Half-time score update"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "final-whistle"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "Full-time result with pick outcome"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "gameweek-complete"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "All matches in GW finished"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "chat-message"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "League chat message"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "final-submission"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "All league members submitted picks"
          })]
        }), createVNode(_components.tr, {
          children: [createVNode(_components.td, {
            children: createVNode(_components.code, {
              dir: "auto",
              children: "new-gameweek"
            })
          }), createVNode(_components.td, {
            children: "\u2705 Active"
          }), createVNode(_components.td, {
            children: "New gameweek fixtures published"
          })]
        })]
      })]
    }), "\n", createVNode(_components.h2, {
      id: "key-features",
      children: "Key Features"
    }), "\n", createVNode(_components.ul, {
      children: ["\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Idempotency"
        }), ": Every notification has a deterministic ", createVNode(_components.code, {
          dir: "auto",
          children: "event_id"
        }), " to prevent duplicates"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Preference Enforcement"
        }), ": All user preferences are enforced server-side"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Grouping"
        }), ": OneSignal ", createVNode(_components.code, {
          dir: "auto",
          children: "collapse_id"
        }), ", ", createVNode(_components.code, {
          dir: "auto",
          children: "thread_id"
        }), ", and ", createVNode(_components.code, {
          dir: "auto",
          children: "android_group"
        }), " are set on every push"]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Audit Log"
        }), ": Every send attempt is logged in ", createVNode(_components.code, {
          dir: "auto",
          children: "notification_send_log"
        })]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Cooldowns"
        }), ": Per-user cooldowns prevent notification spam"]
      }), "\n"]
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
const url = "src/content/docs/index.mdx";
const file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/index.mdx";
const Content = (props = {}) => MDXContent({
											...props,
											components: { Fragment, ...props.components, "astro-image":  props.components?.img ?? $$Image },
										});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/src/content/docs/index.mdx";

export { Content, __usesAstroImage, Content as default, file, frontmatter, getHeadings, url };
