/**
 * Standardized error handling for chat-related functionality
 */

export interface ChatError {
  message: string;
  retryable: boolean;
  context?: string;
}

/**
 * Determines if an error should be retried
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // Network errors are retryable
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }
  
  // Supabase connection errors are retryable
  if (error.code === 'PGRST116' || error.message?.includes('connection')) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
    return true;
  }
  
  // Auth errors are NOT retryable
  if (error.status === 401 || error.status === 403) {
    return false;
  }
  
  // 5xx errors are retryable
  if (error.status >= 500) {
    return true;
  }
  
  return false;
}

/**
 * Handles chat errors and returns user-friendly messages
 */
export function handleChatError(error: any, context: string = 'chat'): ChatError {
  const retryable = isRetryableError(error);
  
  // Log error for debugging
  console.error(`[${context}] Error:`, error);
  
  // Network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || !navigator.onLine) {
    return {
      message: 'Connection failed. Please check your internet.',
      retryable: true,
      context,
    };
  }
  
  // Supabase errors
  if (error?.code?.startsWith('PGRST') || error?.message?.includes('Supabase')) {
    return {
      message: 'Failed to load messages. Please try again.',
      retryable: retryable,
      context,
    };
  }
  
  // Send errors
  if (context.includes('send') || context.includes('message')) {
    return {
      message: 'Failed to send message. Please try again.',
      retryable: retryable,
      context,
    };
  }
  
  // Generic error
  return {
    message: error?.message || 'Something went wrong. Please try again.',
    retryable: retryable,
    context,
  };
}

/**
 * Gets a user-friendly error message from an error
 */
export function getUserFriendlyMessage(error: any, context?: string): string {
  return handleChatError(error, context).message;
}
