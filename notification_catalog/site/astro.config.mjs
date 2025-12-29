import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'TOTL Notification Catalog',
      description: 'Source of truth for all push notifications in the TOTL app',
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Architecture', link: '/architecture/' },
            { label: '🧪 Test Console', link: '/test/' },
          ],
        },
        {
          label: 'Score Notifications',
          items: [
            { label: 'Goal Scored', link: '/notifications/goal-scored/' },
            { label: 'Goal Disallowed', link: '/notifications/goal-disallowed/' },
            { label: 'Kickoff', link: '/notifications/kickoff/' },
            { label: 'Half-Time', link: '/notifications/half-time/' },
            { label: 'Final Whistle', link: '/notifications/final-whistle/' },
            { label: 'Gameweek Complete', link: '/notifications/gameweek-complete/' },
          ],
        },
        {
          label: 'Other Notifications',
          items: [
            { label: 'Chat Message', link: '/notifications/chat-message/' },
            { label: 'Final Submission', link: '/notifications/final-submission/' },
            { label: 'New Gameweek', link: '/notifications/new-gameweek/' },
            { label: 'Prediction Reminder', link: '/notifications/prediction-reminder/' },
          ],
        },
        {
          label: 'Templates',
          items: [
            { label: 'English Templates', link: '/templates/en/' },
          ],
        },
      ],
    }),
  ],
});

