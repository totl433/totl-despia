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

/**
 * Schedule a "Game Week Starting Soon" notification
 * @param firstKickoffTime - ISO string of first kickoff time
 * @param gameweek - Gameweek number
 */
export function scheduleGameweekStartingSoon(
  firstKickoffTime: string,
  gameweek: number
) {
  const kickoff = new Date(firstKickoffTime);
  const notificationTime = new Date(kickoff.getTime() - 10 * 60 * 1000); // 10 minutes before
  const now = new Date();
  const secondsUntilNotification = Math.max(0, Math.floor((notificationTime.getTime() - now.getTime()) / 1000));
  
  if (secondsUntilNotification > 0 && secondsUntilNotification < 7 * 24 * 60 * 60) { // Max 7 days
    sendLocalNotification(
      secondsUntilNotification,
      `Gameweek ${gameweek} Starting Soon! ⚽`,
      `The action begins in 10 minutes! Get ready for some football magic! 🎯`,
      `${window.location.origin}/league/api-test`
    );
  }
}

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
  const kickoff = new Date(kickoffTime);
  const now = new Date();
  const secondsUntilKickoff = Math.max(0, Math.floor((kickoff.getTime() - now.getTime()) / 1000));
  
  if (secondsUntilKickoff > 0 && secondsUntilKickoff < 7 * 24 * 60 * 60) { // Max 7 days
    sendLocalNotification(
      secondsUntilKickoff,
      `Game Starting Now!`,
      `${homeTeam} vs ${awayTeam} is kicking off now!`,
      `${window.location.origin}/league/api-test`
    );
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
  
  // Determine if user got it right
  let personalMessage = '';
  if (isFinishedGame && userPick) {
    let correctResult: "H" | "D" | "A" | null = null;
    if (homeScore > awayScore) correctResult = 'H';
    else if (awayScore > homeScore) correctResult = 'A';
    else if (homeScore === awayScore) correctResult = 'D';
    
    if (correctResult === userPick) {
      personalMessage = 'Correct! 🎯';
    } else {
      personalMessage = 'Wrong pick';
    }
  }
  
  // Create a more engaging message for goal notifications
  const message = personalMessage 
    ? `${minuteText} - ${personalMessage}`
    : `⚽ GOAL! ${minuteText}`;
  
  console.log('[Notifications] Sending score update notification:', {
    title: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
    message,
    minute: minuteText,
    isFinished,
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
    console.log('[Notifications] Score update notification sent successfully');
  } catch (error) {
    console.error('[Notifications] Error sending score update notification:', error);
  }
}

