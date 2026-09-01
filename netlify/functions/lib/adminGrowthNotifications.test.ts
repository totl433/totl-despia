import {
  formatNewLeagueNotification,
  formatNewUserNotification,
  getAdminGrowthNotifyUserIds,
  isFirstTimeUserName,
} from './lib/adminGrowthNotifications';

describe('adminGrowthNotifications', () => {
  const originalEnv = process.env.ADMIN_GROWTH_NOTIFY_USER_IDS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_GROWTH_NOTIFY_USER_IDS;
    } else {
      process.env.ADMIN_GROWTH_NOTIFY_USER_IDS = originalEnv;
    }
  });

  it('defaults recipients to Prem Predictions admins', () => {
    delete process.env.ADMIN_GROWTH_NOTIFY_USER_IDS;
    expect(getAdminGrowthNotifyUserIds()).toEqual([
      '4542c037-5b38-40d0-b189-847b8f17c222',
      'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
      '9c0bcf50-370d-412d-8826-95371a72b4fe',
      '36f31625-6d6c-4aa4-815a-1493a812841b',
    ]);
  });

  it('detects first-time display names', () => {
    expect(
      isFirstTimeUserName({
        type: 'INSERT',
        table: 'users',
        record: { id: 'abc', name: 'Webbo' },
      })
    ).toBe(true);

    expect(
      isFirstTimeUserName({
        type: 'UPDATE',
        table: 'users',
        record: { id: 'abc', name: 'Webbo' },
        old_record: { id: 'abc', name: null },
      })
    ).toBe(true);

    expect(
      isFirstTimeUserName({
        type: 'UPDATE',
        table: 'users',
        record: { id: 'abc', name: 'Webbo2' },
        old_record: { id: 'abc', name: 'Webbo' },
      })
    ).toBe(false);
  });

  it('formats fun emoji copy', () => {
    expect(formatNewUserNotification('Gatussi')).toEqual({
      title: '🎉 New player alert!',
      body: 'Gatussi just joined TOTL — the squad grows! ⚽✨',
    });

    expect(formatNewLeagueNotification('Office Legends', 'Jof')).toEqual({
      title: '🏆 Fresh mini league!',
      body: '"Office Legends" just opened for business by Jof 👀🔥',
    });
  });
});
