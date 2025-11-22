import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface TestResult {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'skip';
  message: string;
  details?: any;
}

export default function TestDespia() {
  const { user, session } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [despiaDetected, setDespiaDetected] = useState<boolean | null>(null);

  useEffect(() => {
    // Quick check if Despia is available
    const checkDespia = async () => {
      let despia: any = null;
      try {
        const despiaModule = await import('despia-native');
        despia = despiaModule.default;
      } catch (e) {
        despia = (globalThis as any)?.despia || (window as any)?.despia;
      }
      setDespiaDetected(!!despia);
    };
    checkDespia();
  }, []);

  const runTests = async () => {
    setTesting(true);
    const testResults: TestResult[] = [];

    // Test 1: Despia Detection
    let despia: any = null;
    try {
      const despiaModule = await import('despia-native');
      despia = despiaModule.default;
      testResults.push({
        name: 'Despia SDK Import',
        status: 'pass',
        message: 'despia-native module loaded successfully',
        details: { keys: Object.keys(despia || {}).slice(0, 5) }
      });
    } catch (e) {
      despia = (globalThis as any)?.despia || (window as any)?.despia;
      if (despia) {
        testResults.push({
          name: 'Despia SDK Import',
          status: 'pass',
          message: 'Despia found in global scope (fallback)',
          details: { keys: Object.keys(despia || {}).slice(0, 5) }
        });
      } else {
        testResults.push({
          name: 'Despia SDK Import',
          status: 'fail',
          message: 'Despia not found - not running in native app',
          details: { error: String(e) }
        });
        setTesting(false);
        setResults(testResults);
        return; // Can't test further without Despia
      }
    }

    // Test 2: OneSignal Player ID
    const playerId = despia?.onesignalplayerid || despia?.oneSignalPlayerId || (globalThis as any)?.onesignalplayerid;
    if (playerId) {
      testResults.push({
        name: 'OneSignal Player ID',
        status: 'pass',
        message: `Player ID found: ${String(playerId).slice(0, 20)}...`,
        details: { playerId: String(playerId) }
      });
    } else {
      testResults.push({
        name: 'OneSignal Player ID',
        status: 'fail',
        message: 'OneSignal Player ID not available',
        details: { availableKeys: Object.keys(despia || {}) }
      });
    }

    // Test 3: Local Notification
    try {
      if (typeof despia === 'function') {
        // Test scheduling a notification 5 seconds from now
        despia(`sendlocalpushmsg://push.send?s=5=msg!Test notification&!#Despia Test&!#${window.location.origin}`);
        testResults.push({
          name: 'Local Notification',
          status: 'pass',
          message: 'Notification scheduled (check in 5 seconds)',
          details: { scheduled: true }
        });
      } else {
        testResults.push({
          name: 'Local Notification',
          status: 'fail',
          message: 'Despia is not a function - cannot send notifications',
          details: { type: typeof despia }
        });
      }
    } catch (e) {
      testResults.push({
        name: 'Local Notification',
        status: 'fail',
        message: `Error scheduling notification: ${String(e)}`,
        details: { error: String(e) }
      });
    }

    // Test 4: Native Storage Read
    try {
      if (typeof despia === 'function') {
        // Add timeout to prevent hanging
        const storagePromise = Promise.resolve(despia('readvalue://', ['storedValues']));
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 3 seconds')), 3000)
        );
        const storageData = await Promise.race([storagePromise, timeoutPromise]);
        testResults.push({
          name: 'Native Storage Read',
          status: 'pass',
          message: 'Storage read successful',
          details: { data: storageData || 'empty' }
        });
      } else {
        testResults.push({
          name: 'Native Storage Read',
          status: 'skip',
          message: 'Despia not a function - cannot test storage',
        });
      }
    } catch (e) {
      testResults.push({
        name: 'Native Storage Read',
        status: 'fail',
        message: `Storage read failed: ${String(e)}`,
        details: { error: String(e) }
      });
    }

    // Test 5: Native Storage Write
    try {
      if (typeof despia === 'function') {
        const testData = { test: true, timestamp: Date.now() };
        const encoded = encodeURIComponent(JSON.stringify(testData));
        // Add timeout to prevent hanging
        const writePromise = Promise.resolve(despia(`writevalue://${encoded}`));
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 3 seconds')), 3000)
        );
        await Promise.race([writePromise, timeoutPromise]);
        testResults.push({
          name: 'Native Storage Write',
          status: 'pass',
          message: 'Storage write successful',
          details: { written: testData }
        });
      } else {
        testResults.push({
          name: 'Native Storage Write',
          status: 'skip',
          message: 'Despia not a function - cannot test storage',
        });
      }
    } catch (e) {
      testResults.push({
        name: 'Native Storage Write',
        status: 'fail',
        message: `Storage write failed: ${String(e)}`,
        details: { error: String(e) }
      });
    }

    // Test 6: Push Notification Registration (if user logged in)
    if (user && session && playerId) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/.netlify/functions/registerPlayer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            playerId: playerId,
            platform: 'ios', // Could detect platform
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const result = await response.json();
        if (response.ok) {
          testResults.push({
            name: 'Push Registration',
            status: 'pass',
            message: 'Device registered successfully',
            details: result
          });
        } else {
          testResults.push({
            name: 'Push Registration',
            status: 'fail',
            message: `Registration failed: ${result.error || 'Unknown error'}`,
            details: result
          });
        }
      } catch (e: any) {
        testResults.push({
          name: 'Push Registration',
          status: 'fail',
          message: `Registration error: ${e.name === 'AbortError' ? 'Request timed out' : String(e)}`,
          details: { error: String(e) }
        });
      }
    } else {
      testResults.push({
        name: 'Push Registration',
        status: 'skip',
        message: 'User not logged in - skipping registration test',
      });
    }

    // Test 7: Check Push Permissions
    try {
      if (typeof despia === 'function') {
        // This API is synchronous, not async - it returns data directly
        const permissionData = despia('checkNativePushPermissions://', ['nativePushEnabled']);
        if (permissionData && typeof permissionData === 'object' && 'nativePushEnabled' in permissionData) {
          const isEnabled = Boolean(permissionData.nativePushEnabled);
          testResults.push({
            name: 'Push Permissions',
            status: isEnabled ? 'pass' : 'fail',
            message: isEnabled ? 'Push notifications enabled in iOS Settings' : 'Push notifications disabled - enable in iOS Settings',
            details: { enabled: isEnabled, permissionData }
          });
        } else {
          testResults.push({
            name: 'Push Permissions',
            status: 'fail',
            message: 'Could not read permission status - API returned unexpected format',
            details: { permissionData, type: typeof permissionData }
          });
        }
      } else {
        testResults.push({
          name: 'Push Permissions',
          status: 'skip',
          message: 'Cannot check permissions - Despia not available',
        });
      }
    } catch (e) {
      testResults.push({
        name: 'Push Permissions',
        status: 'fail',
        message: `Permission check failed: ${String(e)}`,
        details: { error: String(e) }
      });
    }

    // Test 8: Environment Detection
    const hostname = window.location.hostname;
    const isStaging = hostname.includes('staging') || hostname.includes('netlify.app');
    testResults.push({
      name: 'Environment',
      status: 'pass',
      message: `Running on: ${hostname}`,
      details: { 
        hostname,
        isStaging,
        isLocalhost: hostname.includes('localhost'),
        isDespia: despiaDetected
      }
    });

    setResults(testResults);
    setTesting(false);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const skipCount = results.filter(r => r.status === 'skip').length;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Despia Integration Test</h1>
          <p className="text-slate-600 mb-4">
            Test all Despia native features to verify they work correctly
          </p>

          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={runTests}
              disabled={testing}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {testing ? 'Running Tests...' : 'Run All Tests'}
            </button>

            {despiaDetected !== null && (
              <div className={`px-4 py-2 rounded-lg ${despiaDetected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {despiaDetected ? '✅ Despia Detected' : '❌ Despia Not Detected'}
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mb-4 p-4 bg-slate-100 rounded-lg">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="font-semibold">Pass:</span> <span className="text-green-600">{passCount}</span>
                </div>
                <div>
                  <span className="font-semibold">Fail:</span> <span className="text-red-600">{failCount}</span>
                </div>
                <div>
                  <span className="font-semibold">Skip:</span> <span className="text-slate-500">{skipCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`bg-white rounded-lg border p-4 ${
                  result.status === 'pass' ? 'border-green-200 bg-green-50' :
                  result.status === 'fail' ? 'border-red-200 bg-red-50' :
                  'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{result.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        result.status === 'pass' ? 'bg-green-200 text-green-800' :
                        result.status === 'fail' ? 'bg-red-200 text-red-800' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer">Details</summary>
                        <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !testing && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            Click "Run All Tests" to start testing Despia features
          </div>
        )}
      </div>
    </div>
  );
}

