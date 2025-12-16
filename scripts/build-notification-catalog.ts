/**
 * Build Notification Catalog
 * 
 * Parses frontmatter from notification markdown files and generates
 * a JSON catalog for use by the backend dispatcher.
 * 
 * Usage: npx tsx scripts/build-notification-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple frontmatter parser (no external dependencies)
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content };
  }
  
  const frontmatterStr = match[1];
  const bodyContent = content.slice(match[0].length).trim();
  
  // Parse YAML-like frontmatter
  const frontmatter: Record<string, any> = {};
  let currentKey = '';
  let currentValue: any = null;
  let indent = 0;
  let nestedObj: Record<string, any> | null = null;
  
  const lines = frontmatterStr.split('\n');
  
  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;
    
    // Check if this is a list item
    const listMatch = line.match(/^(\s*)- (.+)$/);
    if (listMatch && currentKey && Array.isArray(currentValue)) {
      currentValue.push(listMatch[2].trim());
      continue;
    }
    
    // Check for key-value pair
    const kvMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*):(.*)$/);
    if (kvMatch) {
      const lineIndent = kvMatch[1].length;
      const key = kvMatch[2];
      let value: any = kvMatch[3].trim();
      
      // Save previous value if exists
      if (currentKey && lineIndent === 0) {
        if (nestedObj) {
          frontmatter[currentKey] = nestedObj;
          nestedObj = null;
        } else {
          frontmatter[currentKey] = currentValue;
        }
      }
      
      // Handle nested object
      if (lineIndent > 0 && currentKey) {
        if (!nestedObj) {
          nestedObj = {};
        }
        // Parse the value
        if (value === '') {
          nestedObj[key] = null;
        } else if (value === 'true') {
          nestedObj[key] = true;
        } else if (value === 'false') {
          nestedObj[key] = false;
        } else if (value === 'null') {
          nestedObj[key] = null;
        } else if (/^\d+$/.test(value)) {
          nestedObj[key] = parseInt(value, 10);
        } else if (/^".*"$/.test(value)) {
          nestedObj[key] = value.slice(1, -1);
        } else {
          nestedObj[key] = value;
        }
        continue;
      }
      
      // Parse top-level value
      if (value === '') {
        // Could be a list or nested object - will be handled in subsequent lines
        currentKey = key;
        currentValue = [];
        indent = lineIndent;
      } else if (value === 'true') {
        currentKey = key;
        currentValue = true;
      } else if (value === 'false') {
        currentKey = key;
        currentValue = false;
      } else if (value === 'null') {
        currentKey = key;
        currentValue = null;
      } else if (/^\d+$/.test(value)) {
        currentKey = key;
        currentValue = parseInt(value, 10);
      } else if (/^".*"$/.test(value)) {
        currentKey = key;
        currentValue = value.slice(1, -1);
      } else {
        currentKey = key;
        currentValue = value;
      }
    }
  }
  
  // Save last value
  if (currentKey) {
    if (nestedObj) {
      frontmatter[currentKey] = nestedObj;
    } else {
      frontmatter[currentKey] = currentValue;
    }
  }
  
  return { frontmatter, content: bodyContent };
}

// Required fields for validation
const REQUIRED_FIELDS = [
  'notification_key',
  'owner',
  'status',
  'channels',
  'audience',
  'source',
  'trigger',
  'dedupe',
  'preferences',
  'onesignal',
  'rollout',
];

interface NotificationCatalogEntry {
  notification_key: string;
  owner: string;
  status: 'active' | 'deprecated' | 'disabled';
  channels: string[];
  audience: string;
  source: string;
  trigger: {
    name: string;
    event_id_format: string;
  };
  dedupe: {
    scope: string;
    ttl_seconds: number;
  };
  cooldown: {
    per_user_seconds: number;
  };
  quiet_hours: {
    start: string | null;
    end: string | null;
  };
  preferences: {
    preference_key: string | null;
    default: boolean;
  };
  onesignal: {
    collapse_id_format: string;
    thread_id_format: string;
    android_group_format: string;
  };
  deep_links: {
    url_format: string | null;
  };
  rollout: {
    enabled: boolean;
    percentage: number;
  };
}

function validateEntry(entry: any, filename: string): string[] {
  const errors: string[] = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined) {
      errors.push(`${filename}: Missing required field '${field}'`);
    }
  }
  
  // Validate nested fields
  if (entry.trigger && !entry.trigger.event_id_format) {
    errors.push(`${filename}: Missing 'trigger.event_id_format'`);
  }
  
  if (entry.onesignal) {
    if (!entry.onesignal.collapse_id_format) {
      errors.push(`${filename}: Missing 'onesignal.collapse_id_format'`);
    }
    if (!entry.onesignal.thread_id_format) {
      errors.push(`${filename}: Missing 'onesignal.thread_id_format'`);
    }
    if (!entry.onesignal.android_group_format) {
      errors.push(`${filename}: Missing 'onesignal.android_group_format'`);
    }
  }
  
  return errors;
}

async function main() {
  const notificationsDir = path.join(__dirname, '../notification_catalog/site/src/content/docs/notifications');
  const outputDir = path.join(__dirname, '../notification_catalog/generated');
  const outputFile = path.join(outputDir, 'catalog.json');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Read all notification markdown files
  const files = fs.readdirSync(notificationsDir).filter(f => f.endsWith('.md'));
  
  if (files.length === 0) {
    console.error('❌ No notification markdown files found');
    process.exit(1);
  }
  
  console.log(`📂 Found ${files.length} notification files`);
  
  const catalog: Record<string, NotificationCatalogEntry> = {};
  const allErrors: string[] = [];
  
  for (const file of files) {
    const filepath = path.join(notificationsDir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const { frontmatter } = parseFrontmatter(content);
    
    // Skip files without notification_key (like index files)
    if (!frontmatter.notification_key) {
      console.log(`⏭️  Skipping ${file} (no notification_key)`);
      continue;
    }
    
    // Validate
    const errors = validateEntry(frontmatter, file);
    if (errors.length > 0) {
      allErrors.push(...errors);
    }
    
    // Add to catalog
    catalog[frontmatter.notification_key] = frontmatter as NotificationCatalogEntry;
    console.log(`✅ Parsed ${file} → ${frontmatter.notification_key}`);
  }
  
  if (allErrors.length > 0) {
    console.error('\n❌ Validation errors:');
    for (const error of allErrors) {
      console.error(`   ${error}`);
    }
    process.exit(1);
  }
  
  // Write catalog
  fs.writeFileSync(outputFile, JSON.stringify(catalog, null, 2));
  console.log(`\n✅ Generated ${outputFile}`);
  console.log(`   ${Object.keys(catalog).length} notification types`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

