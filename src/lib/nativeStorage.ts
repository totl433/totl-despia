// Native storage abstraction for Despia
// Falls back to localStorage in web environment, uses native storage in mobile
// Based on Despia documentation: https://lovable.despia.com/default-guide/native-features/local-storage-bucket

type StorageInterface = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

// Get Despia instance
async function getDespia(): Promise<any> {
  // Try importing despia-native first (recommended method)
  try {
    const despiaModule = await import('despia-native');
    if (despiaModule.default) {
      return despiaModule.default;
    }
  } catch (e) {
    // Module not available, try global locations
  }

  // Fallback to global locations
  if (typeof window !== 'undefined') {
    return (window as any).despia || (window as any).__DESPIA__;
  }
  return (globalThis as any).despia || (globalThis as any).__DESPIA__;
}

// Check if we're in a native environment
async function isNative(): Promise<boolean> {
  const despia = await getDespia();
  return !!despia && typeof despia === 'function';
}

// Despia storage uses a single key-value store with URL-encoded JSON
// We'll use a JSON object to store multiple keys
let cachedStorage: Record<string, string> | null = null;

async function loadStorage(): Promise<Record<string, string>> {
  if (cachedStorage !== null) {
    return cachedStorage;
  }

  const despia = await getDespia();
  if (!despia || typeof despia !== 'function') {
    return {};
  }

  try {
    // Read from Despia storage
    const data = await despia('readvalue://', ['storedValues']);
    if (data && data.storedValues) {
      const decoded = decodeURIComponent(data.storedValues);
      cachedStorage = JSON.parse(decoded);
      return cachedStorage || {};
    }
  } catch (error) {
    console.warn('Failed to read from Despia storage:', error);
  }

  cachedStorage = {};
  return {};
}

async function saveStorage(storage: Record<string, string>): Promise<void> {
  const despia = await getDespia();
  if (!despia || typeof despia !== 'function') {
    return;
  }

  try {
    const encoded = encodeURIComponent(JSON.stringify(storage));
    await despia(`writevalue://${encoded}`);
    cachedStorage = storage;
  } catch (error) {
    console.warn('Failed to write to Despia storage:', error);
  }
}

// Native storage implementation using Despia's command-based API
const nativeStorage: StorageInterface = {
  async getItem(key: string): Promise<string | null> {
    if (await isNative()) {
      try {
        const storage = await loadStorage();
        return storage[key] || null;
      } catch (error) {
        console.warn('Native storage getItem failed:', error);
        return null;
      }
    } else {
      // Fallback to localStorage for web
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (await isNative()) {
      try {
        const storage = await loadStorage();
        storage[key] = value;
        await saveStorage(storage);
      } catch (error) {
        console.warn('Native storage setItem failed:', error);
      }
    } else {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('localStorage setItem failed:', error);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (await isNative()) {
      try {
        const storage = await loadStorage();
        delete storage[key];
        await saveStorage(storage);
      } catch (error) {
        console.warn('Native storage removeItem failed:', error);
      }
    } else {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('localStorage removeItem failed:', error);
      }
    }
  },

  async clear(): Promise<void> {
    if (await isNative()) {
      try {
        await saveStorage({});
        cachedStorage = {};
      } catch (error) {
        console.warn('Native storage clear failed:', error);
      }
    } else {
      try {
        localStorage.clear();
      } catch (error) {
        console.warn('localStorage clear failed:', error);
      }
    }
  },
};

// Synchronous fallback for compatibility (web only)
export const storage = {
  async getItem(key: string): Promise<string | null> {
    return nativeStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    return nativeStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    return nativeStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    return nativeStorage.clear();
  },

  // Helper methods for JSON
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await nativeStorage.getItem(key);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    } catch (error) {
      console.warn('Storage getJSON failed, falling back to localStorage:', error);
      // Fallback to localStorage for web
      try {
        const value = localStorage.getItem(key);
        if (value === null) return null;
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
  },

  async setJSON(key: string, value: any): Promise<void> {
    try {
      await nativeStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Storage setJSON failed, falling back to localStorage:', error);
      // Fallback to localStorage for web
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('localStorage setItem also failed:', e);
      }
    }
  },
};

// Synchronous version for web compatibility (deprecated, use async version)
export const storageSync = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('localStorage setItem failed:', error);
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('localStorage removeItem failed:', error);
    }
  },
};

