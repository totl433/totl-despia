// src/lib/notifications.ts
// Local push notification system using Despia SDK

import despia from 'despia-native';

/**
 * Send a local push notification
 * @param seconds - Delay in seconds before showing the notification
 * @param title - Notification title
 * @param message - Notification message
 * @param url - Optional deep link URL
 */
export function sendLocalNotification(
  seconds: number,
  title: string,
  message: string,
  url?: string
) {
  try {
    const urlParam = url || window.location.origin;
    despia(`sendlocalpushmsg://push.send?s=${seconds}=msg!${message}&!#${title}&!#${urlParam}`);
  } catch (error) {
    console.error('[Notifications] Error sending local notification:', error);
  }
}

/**
 * Schedule a deadline reminder notification
 * @param deadlineTime - ISO string of deadline time
 * @param gameweek - Gameweek number
 * @param hoursBefore - Hours before deadline to send reminder (default: 2)
 */
export function scheduleDeadlineReminder(
  deadlineTime: string,
  gameweek: number,
  hoursBefore: number = 2
) {
  const deadline = new Date(deadlineTime);
  const reminderTime = new Date(deadline.getTime() - hoursBefore * 60 * 60 * 1000);
  const now = new Date();
  const secondsUntilReminder = Math.max(0, Math.floor((reminderTime.getTime() - now.getTime()) / 1000));
  
  if (secondsUntilReminder > 0 && secondsUntilReminder < 7 * 24 * 60 * 60) { // Max 7 days
    sendLocalNotification(
      secondsUntilReminder,
      `GW${gameweek} Deadline Reminder`,
      `Don't forget to submit your predictions! Deadline in ${hoursBefore} hour${hoursBefore > 1 ? 's' : ''}.`,
      `${window.location.origin}/test-api-predictions`
    );
  }
}

// Track scheduled "Gameweek Starting Soon" notifications to prevent duplicates
const GWS_STARTING_SOON_KEY_PREFIX = 'scheduled_gw_starting_soon_';

/**
 * Schedule a "Game Week Starting Soon" notification
 * @param firstKickoffTime - ISO string of first kickoff time
 * @param gameweek - Gameweek number
 */
export function scheduleGameweekStartingSoon(
  firstKickoffTime: string,
  gameweek: number
) {
  // Create a unique key for this gameweek notification
  const notificationKey = `gw${gameweek}-${firstKickoffTime}`;
  const storageKey = `${GWS_STARTING_SOON_KEY_PREFIX}${notificationKey}`;
  const now = Date.now();
  
  // Check localStorage first (persists across re-renders and page reloads)
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const lastScheduled = parseInt(stored, 10);
      // If scheduled within the last 24 hours, skip (gameweek should have started by then)
      if (lastScheduled && (now - lastScheduled) < 24 * 60 * 60 * 1000) {
        console.log('[Notifications] Skipping duplicate "Gameweek Starting Soon" notification (from localStorage):', {
          gameweek,
          firstKickoffTime,
          timeSinceLastScheduled: Math.floor((now - lastScheduled) / 1000),
          seconds: 'seconds'
        });
        return;
      }
    }
  } catch (e) {
    // localStorage might not be available, continue with scheduling
    console.warn('[Notifications] localStorage not available for gameweek starting soon check');
  }
  
  const kickoff = new Date(firstKickoffTime);
  const notificationTime = new Date(kickoff.getTime() - 10 * 60 * 1000); // 10 minutes before
  const nowDate = new Date();
  const secondsUntilNotification = Math.max(0, Math.floor((notificationTime.getTime() - nowDate.getTime()) / 1000));
  
  if (secondsUntilNotification > 0 && secondsUntilNotification < 7 * 24 * 60 * 60) { // Max 7 days
    console.log('[Notifications] Scheduling "Gameweek Starting Soon" notification:', {
      gameweek,
      firstKickoffTime,
      secondsUntilNotification,
      scheduledAt: new Date().toISOString()
    });
    
    sendLocalNotification(
      secondsUntilNotification,
      `Gameweek ${gameweek} Starting Soon! ⚽`,
      `The action begins in 10 minutes! Get ready for some football magic! 🎯`,
      `${window.location.origin}/league/api-test`
    );
    
    // Record that we've scheduled this notification in localStorage (persists across re-renders)
    try {
      localStorage.setItem(storageKey, now.toString());
      // Clean up old entries (older than 7 days) to prevent localStorage bloat
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GWS_STARTING_SOON_KEY_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            const timestamp = parseInt(value, 10);
            if (timestamp < sevenDaysAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      // localStorage might be full or unavailable, that's okay
      console.warn('[Notifications] Could not save gameweek starting soon to localStorage:', e);
    }
  }
}

// Track scheduled "Game Starting Now" notifications to prevent duplicates
// Use localStorage to persist across page reloads and prevent duplicates
const STORAGE_KEY_PREFIX = 'scheduled_game_notification_';

/**
 * Schedule a live game notification
 * @param kickoffTime - ISO string of kickoff time
 * @param homeTeam - Home team name
 * @param awayTeam - Away team name
 */
export function scheduleLiveGameNotification(
  kickoffTime: string,
  homeTeam: string,
  awayTeam: string
) {
  // Create a unique key for this game
  const notificationKey = `${kickoffTime}-${homeTeam}-${awayTeam}`;
  const storageKey = `${STORAGE_KEY_PREFIX}${notificationKey}`;
  const now = Date.now();
  
  // Check localStorage first (persists across re-renders and page reloads)
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const lastScheduled = parseInt(stored, 10);
      // If scheduled within the last 24 hours, skip (game should have started by then)
      if (lastScheduled && (now - lastScheduled) < 24 * 60 * 60 * 1000) {
        console.log('[Notifications] Skipping duplicate "Game Starting Now" notification (from localStorage):', {
          homeTeam,
          awayTeam,
          kickoffTime,
          timeSinceLastScheduled: Math.floor((now - lastScheduled) / 1000),
          seconds: 'seconds'
        });
        return;
      }
    }
  } catch (e) {
    // localStorage might not be available, continue with in-memory check
    console.warn('[Notifications] localStorage not available, using in-memory check only');
  }
  
  const kickoff = new Date(kickoffTime);
  const secondsUntilKickoff = Math.max(0, Math.floor((kickoff.getTime() - now) / 1000));
  
  if (secondsUntilKickoff > 0 && secondsUntilKickoff < 7 * 24 * 60 * 60) { // Max 7 days
    console.log('[Notifications] Scheduling "Game Starting Now" notification:', {
      homeTeam,
      awayTeam,
      kickoffTime,
      secondsUntilKickoff,
      scheduledAt: new Date().toISOString()
    });
    
    sendLocalNotification(
      secondsUntilKickoff,
      `Game Starting Now!`,
      `${homeTeam} vs ${awayTeam} is kicking off now!`,
      `${window.location.origin}/league/api-test`
    );
    
    // Record that we've scheduled this notification in localStorage (persists across re-renders)
    try {
      localStorage.setItem(storageKey, now.toString());
      // Clean up old entries (older than 7 days) to prevent localStorage bloat
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            const timestamp = parseInt(value, 10);
            if (timestamp < sevenDaysAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      // localStorage might be full or unavailable, that's okay
      console.warn('[Notifications] Could not save to localStorage:', e);
    }
  }
}

/**
 * Send a results notification when all games finish
 * @param gameweek - Gameweek number
 */
export function sendResultsNotification(gameweek: number) {
  sendLocalNotification(
    0, // Send immediately
    `Gameweek ${gameweek} Finished! 🏆`,
    `All games are done! Come see the results and find out who won!`,
    `${window.location.origin}/league/api-test`
  );
}

/**
 * Send a score update notification during live games
 * @param homeTeam - Home team name
 * @param awayTeam - Away team name
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param minute - Current minute of the game (null if finished)
 * @param isFinished - Whether the game is finished
 * @param userPick - User's pick for this game ("H", "D", or "A")
 */
// Track last notification to prevent duplicates
let lastNotificationRef: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isFinished: boolean;
  timestamp: number;
} | null = null;

export function sendScoreUpdateNotification(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  minute?: number | null,
  isFinished?: boolean,
  userPick?: "H" | "D" | "A" | null
) {
  const isFinishedGame = isFinished || minute === null;
  const minuteText = isFinishedGame ? 'FT' : (minute ? `${minute}'` : 'LIVE');
  
  // Prevent duplicate notifications (same score within 5 seconds)
  const now = Date.now();
  if (lastNotificationRef &&
      lastNotificationRef.homeTeam === homeTeam &&
      lastNotificationRef.awayTeam === awayTeam &&
      lastNotificationRef.homeScore === homeScore &&
      lastNotificationRef.awayScore === awayScore &&
      lastNotificationRef.isFinished === isFinishedGame &&
      (now - lastNotificationRef.timestamp) < 5000) {
    console.log('[Notifications] Skipping duplicate notification:', {
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      isFinished: isFinishedGame,
      timeSinceLast: now - lastNotificationRef.timestamp
    });
    return;
  }
  
  // Determine if user got it right
  let personalMessage = '';
  if (isFinishedGame && userPick) {
    let correctResult: "H" | "D" | "A" | null = null;
    if (homeScore > awayScore) correctResult = 'H';
    else if (awayScore > homeScore) correctResult = 'A';
    else if (homeScore === awayScore) correctResult = 'D';
    
    if (correctResult === userPick) {
      personalMessage = 'You got it right! 🎉';
    } else {
      personalMessage = 'Unlucky... 😔';
    }
  }
  
  // Create a more engaging message
  let message: string;
  if (isFinishedGame && personalMessage) {
    // Full-time with personal message
    message = `FT - ${personalMessage}`;
  } else if (isFinishedGame) {
    // Full-time without personal message
    message = `FT - Game finished`;
  } else {
    // Goal during live game
    message = `⚽ GOAL! ${minuteText}`;
  }
  
  console.log('[Notifications] Sending score update notification:', {
    title: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
    message,
    minute: minuteText,
    isFinished: isFinishedGame,
    userPick,
    timestamp: new Date().toISOString()
  });
  
  try {
    sendLocalNotification(
      0, // Send immediately
      `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
      message,
      `${window.location.origin}/league/api-test`
    );
    
    // Update last notification ref
    lastNotificationRef = {
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      isFinished: isFinishedGame,
      timestamp: now
    };
    
    console.log('[Notifications] Score update notification sent successfully');
  } catch (error) {
    console.error('[Notifications] Error sending score update notification:', error);
  }
}

