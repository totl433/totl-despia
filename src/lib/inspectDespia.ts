// Utility to inspect Despia API and discover available methods/properties
// Run this in the browser console or call from a component to see what Despia exposes

export async function inspectDespia(): Promise<{
  found: boolean;
  location: string;
  properties: string[];
  methods: string[];
  storage?: any;
  fullObject?: any;
}> {
  let despia: any = null;
  let location = 'not found';

  // Try importing despia-native
  try {
    const despiaModule = await import('despia-native');
    despia = despiaModule.default;
    location = 'despia-native module';
  } catch (e) {
    // Try global locations
    if ((globalThis as any)?.despia) {
      despia = (globalThis as any).despia;
      location = 'globalThis.despia';
    } else if (typeof window !== 'undefined' && (window as any)?.despia) {
      despia = (window as any).despia;
      location = 'window.despia';
    } else if ((globalThis as any)?.__DESPIA__) {
      despia = (globalThis as any).__DESPIA__;
      location = 'globalThis.__DESPIA__';
    } else if (typeof window !== 'undefined' && (window as any)?.__DESPIA__) {
      despia = (window as any).__DESPIA__;
      location = 'window.__DESPIA__';
    }
  }

  if (!despia) {
    return {
      found: false,
      location: 'not found',
      properties: [],
      methods: [],
    };
  }

  // Inspect the object
  const properties: string[] = [];
  const methods: string[] = [];
  let storage: any = undefined;

  // Get all keys
  const keys = Object.keys(despia);
  keys.forEach(key => {
    const value = despia[key];
    const type = typeof value;
    
    if (type === 'function') {
      methods.push(key);
    } else {
      properties.push(key);
    }

    // Check for storage
    if (key.toLowerCase().includes('storage')) {
      storage = value;
    }
  });

  // Check nested objects
  if (despia.storage) {
    storage = despia.storage;
    properties.push('storage (object)');
  }

  // Check if it's a function itself (Despia command interface)
  if (typeof despia === 'function') {
    methods.push('(callable function)');
  }

  return {
    found: true,
    location,
    properties,
    methods,
    storage,
    fullObject: despia, // For deep inspection
  };
}

// Console-friendly version
export function logDespiaInfo() {
  inspectDespia().then(info => {
    console.group('🔍 Despia API Inspection');
    console.log('Found:', info.found);
    console.log('Location:', info.location);
    console.log('Properties:', info.properties);
    console.log('Methods:', info.methods);
    
    if (info.storage) {
      console.group('📦 Storage Object:');
      console.log('Type:', typeof info.storage);
      if (typeof info.storage === 'object') {
        console.log('Storage keys:', Object.keys(info.storage));
        console.log('Storage methods:', Object.keys(info.storage).filter(k => typeof info.storage[k] === 'function'));
      }
      console.groupEnd();
    }
    
    if (info.fullObject) {
      console.group('📋 Full Object:');
      console.log(info.fullObject);
      console.groupEnd();
    }
    
    console.groupEnd();
  });
}

